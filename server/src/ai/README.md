# AI 内容生成模块（src/ai）

《我的大学日记》的事件与结局生成模块（成员 C 负责）：构建提示词 → 调用 DeepSeek 兼容 API（JSON 输出模式）→ 运行时校验 → 返回结构化内容。无运行时依赖，仅使用 Node 内置 fetch。迭代与实测记录见 [成员C-AI.md](../../docs/成员-C-AI.md)。

## 结构

```text
server/
├── package.json / tsconfig.json   # 后端工作区共享配置（独立开发时代的专用 scripts 已不在这个检出里，见「自测命令」）
└── src/ai/
    ├── index.ts                   # 唯一出口：路由层只从这里 import
    ├── generateEvent.ts           # generateEvent / generateEventStream / generateEventSafe：提示词 → 调用 → 校验 → 分配事件 id 与选项编号 A/B/C（Stream 版边生成边回调推送增量）
    ├── generateEnding.ts          # generateEnding / generateEndingSafe：提示词 → 调用 → 校验 → 结局四字段
    ├── deepseek.ts                # loadAiConfig（读 .env）+ chatJSON / chatJSONStream 请求封装 + chatJSONWithRetry 重试 + AiError
    ├── streamParse.ts             # 流式增量解析：把模型输出的 JSON 文本实时切成标题与选项文本整体 / 描述增量 / 结果叙述增量（结构偏离自动休眠）
    ├── fallback.ts                # 备用内容：临时性故障重试耗尽时的兜底事件池与结局（数值字数合规）
    ├── validate.ts                # 输出校验：字段/长度/整数/效果范围，违规整体拒绝、不截断
    ├── schema.ts                  # 类型：四维属性、GameEvent、Ending、生成输入
    ├── prompts/
    │   ├── event.ts / ending.ts   # 事件、结局的系统提示词（随实测迭代）
    │   ├── common.ts              # 共用片段：属性标签、效果摘要、历史列表格式化
    │   └── values.ts              # 硬性约束数值（选项数、字数上限、效果范围），提示词与校验共用，改数值只改这里
    └── scripts/
        ├── stream-parse-test.ts   # 流式解析器离线夹具测试：五种切块回归，零 API 依赖
        └── stream-demo.ts         # 流式生成演示（本地备料不提交）：标题与选项整体 / 描述逐字 / 结果叙述逐字，兼验证中转站 stream 支持
```

## 接入到后端（成员 B）

### 环境变量

`.env` 放在 `server/` 下，密钥只进后端，不进前端与 Git：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 无（**必填**，缺失抛 `AI_CONFIG`） | 模型密钥 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | 可指向中转站等 OpenAI 兼容地址 |
| `DEEPSEEK_MODEL` | `deepseek-chat` | 使用思考型模型时建议调大超时 |
| `AI_TIMEOUT_MS` / `AI_TEMPERATURE` / `AI_MAX_ATTEMPTS` | `60000` / `1.0` / `3` | 值写纯文本数字（如 `240000`，不要 `120_000`） |

### 调用方式

路由层只需两个函数；输入从游戏快照提取，输出已通过校验，可直接组装进快照下发。注意快照历史是 `HistoryRecord[]`（字段 `chosenText`），生成输入要的是 `HistoryDigestItem[]`（字段 `chosenOptionText`），用 `historyFromRecords` 一次转换，不要把快照历史整体塞进去。

```ts
import { generateEvent, generateEnding, historyFromRecords, loadAiConfig, AiError } from "../ai/index.js";

const cfg = loadAiConfig(); // 建议启动时调用一次，密钥缺失即刻抛 AI_CONFIG

// 每天 1 次（替换 controller.ts 里的 mockGenerateEvent）
const event = await generateEvent(
  {
    day: snapshot.day,
    attributes: snapshot.attributes,
    history: historyFromRecords(snapshot.history),
    profile, // 可选 PlayerProfile { gender, major }：不传时模型用中性表述（见下节「玩家档案」）
  },
  cfg,
);
// → GameEvent：id、day、title、description、options（A/B/C 编号、effects、resultText 均已就绪）

// 两周结束 1 次（替换 mockGenerateEnding）
const ending = await generateEnding(
  {
    attributes: snapshot.attributes,
    grades: getGrades(snapshot.attributes), // service.ts 现成的档位计算
    history: historyFromRecords(snapshot.history),
    profile, // 可选：不传时模型用中性表述
  },
  cfg,
);
// → Ending：title、description、evaluation、advice
```

接线路由只换生成来源，结算、幂等、快照组装逻辑都不用动；事件字段结构与前端完全一致（成员 A 已核对），前端无需改动。交接现场记录见成员 A 的 `docs/联调待办-B与C.md`。

### 玩家档案（profile）

生成输入（事件、结局皆同）带可选字段 `profile: { gender, major }`，类型 `PlayerProfile` 已从 ai 出口导出，用于让内容贴合玩家身份。不传时模型收到的用户消息是「玩家档案：未收集。请使用中性表述，不要假设玩家的性别与专业，也不要杜撰性别、专业等固定信息」，system 提示词另有硬约束：档案给出的性别与专业是玩家固定信息，不得更改、不得杜撰矛盾信息。

档案不是快照的一部分（快照结构里没有该字段），模块对它只拼接进提示词、不做校验。现状：前端在开始页收集、随生成请求体顶层 `profile` 发送，路由层归一化（两项不全视为未收集）后透传，链路已端到端生效。自测：同一开局快照带/不带 profile 各生成一次第 1 天事件，两次 description 对性别与专业的贴合度应有明显差异，不带的那次不得出现具体性别或专业字样。

### 错误处理

事件生成遇到超时、限流、无效输出时立即抛出错误，由玩家手动重试，每次操作只调用一次模型。以下自动重试策略仅适用于结局：可重试错误在函数内自动重试（最多 `AI_MAX_ATTEMPTS` 次）：**校验失败会把问题清单注入下一次提示词让模型自纠**，最终失败才抛出；每次尝试失败都会在服务端控制台留一行 `[ai]` 日志（第几次、错误码、原因），判断「生成慢」是否因重试在跑就从这里看；路由层按 `code` 映射到接口约定的错误响应。

```ts
try {
  await generateEvent(input, cfg);
} catch (err) {
  if (err instanceof AiError) {
    err.code;      // AI_CONFIG | AI_TIMEOUT | AI_RATE_LIMIT | AI_UPSTREAM | AI_INVALID_OUTPUT
    err.retryable; // true → 提示玩家重试；false → 配置类问题，重试无效
  }
}
```

路由 catch 建议**直接透传**，不要把异常统一压成 `AI_GENERATION_FAILED / retryable: true`——否则密钥没配时前端会永远显示「可重试」，玩家点多少次都是同一个错。前端界面形态只由 `retryable` 决定，五个 code 不需要逐个写文案：

```ts
// controller.ts 的 catch；sendError 以路由层现有错误响应函数为准
catch (err) {
  if (err instanceof AiError) {
    sendError(res, requestId, err.code, err.message, err.retryable);
  } else {
    sendError(res, requestId, "AI_GENERATION_FAILED", "内容生成失败，请稍后重试", true);
  }
}
```

接路由建议用原始版本（错误如实上屏）；Safe 兜底是可选的降级策略，适合「临时故障不想中断游戏」的场景（见下）。

若希望临时性故障（超时/限流/上游 5xx/输出不合法）不中断游戏，可改用 Safe 版本：事件单次调用失败或结局重试耗尽后返回备用内容（游戏路由不使用 Safe 入口）（`usedFallback=true` 并附原始错误），**配置类错误仍然抛出**：

```ts
import { generateEventSafe } from "../ai/index.js";

const result = await generateEventSafe(input, cfg);
if (result.usedFallback) {
  console.warn(`AI 生成失败，已启用备用事件：[${result.error?.code}]`);
}
const event = result.value; // 结构与 generateEvent 返回值一致
```

### 流式生成（可选）

`generateEventStream` 是 `generateEvent` 的流式版：对模型发 `stream: true`，描述与结果叙述逐字增量回调，标题与选项文本整体回调，最终返回值与 `generateEvent` 完全一致（同一套整体校验 + id 分配，重试语义也一致）。不需要流式就继续用 `generateEvent`，两版互不影响。

```ts
import { generateEventStream } from "../ai/index.js";

const event = await generateEventStream(input, cfg, {
  onTitle: (title) => {},                  // 标题闭合（整体一次）
  onDescriptionDelta: (delta) => {},       // 描述增量（已反转义）
  onOptionText: (index, text) => {},       // 选项文本整条弹出（index 0～2，A→B→C 依次）
  onResultTextDelta: (index, delta) => {}, // 结果叙述增量（选完才看的叙述，可预取缓冲）
  onResultText: (index, text) => {},       // 结果叙述闭合（完整）
});
```

要点：回调推送的内容尚未通过最终校验，以最终返回的 `GameEvent` 为准；流式面为描述 / 结果叙述（逐字增量），标题与选项文本整体回调，effects 是结算数值不推送；resultText 是否提前展示由前端自行决定（可只缓冲所选选项）；流式中即时拦截提示词硬禁词（军训 / 期末）并结束本次生成，等待玩家手动重试；超时按「静默时长」计（沿用 `AI_TIMEOUT_MS`），模型持续出字不算超时；增量解析遇结构偏离自动休眠，正确性由整体校验兜底。转成 SSE 对外暴露的协议草案见 [成员C-AI.md](../../docs/成员-C-AI.md) 的「流式生成」一节。解析器离线回归（不调 API）：`npx tsx src/ai/scripts/stream-parse-test.ts`。演示脚本（本地备料）：`npx tsx src/ai/scripts/stream-demo.ts`。

### 职责边界

本模块只做「输入快照 → 校验后的生成内容」的转换：不写存档、不改游戏进度；「快照已有未结算事件 / 已有结局则直接返回」的幂等判断由路由层完成。

## 失败样例复现（联调验错误屏）

前端的失败注入只在 mock API 模式生效；走真实链路验「可重试 / 不可重试」两种错误屏，用下面三条配方（`.env` 由成员本人手改，测完还原）。假中转站脚本与 npm scripts 属成员 C 本地备料，未随仓库上传，需要时向成员 C 索取或由其本地演示：

| 要复现的错误 | 配方 | 预期 |
| --- | --- | --- |
| `AI_TIMEOUT`（可重试） | `.env` 设 `AI_TIMEOUT_MS=1`（纯数字） | 事件请求超时后立即报错，`retryable=true` |
| `AI_INVALID_OUTPUT`（可重试） | `npm run fake:relay` 起本地假中转站（默认 8787），`.env` 改 `DEEPSEEK_BASE_URL=http://127.0.0.1:8787/v1` 后重启后端 | 每次「模型输出」都缺 options，事件校验拒绝后立即报 `AI_INVALID_OUTPUT`，`retryable=true` |
| `AI_CONFIG`（不可重试） | 假中转站换 `npm run fake:relay -- --mode 401`（或把 `DEEPSEEK_API_KEY` 改成无效值打真站） | 401 → `AI_CONFIG`，不重试直接报错，`retryable=false` |

测完把 `.env` 还原：思考型模型建议 `AI_TIMEOUT_MS=240000`，`DEEPSEEK_BASE_URL` 改回中转站地址。

## 自测命令

仓库未配置 npm scripts，在 `server/` 下直接用 npx（先 `npm install` 装好 typescript 与 tsx）：

```bash
npx tsc --noEmit                             # 类型检查（无输出即通过）
npx tsx src/ai/scripts/stream-parse-test.ts  # 流式解析器离线夹具：五种切块回归，不调 API
npx tsx src/ai/scripts/stream-demo.ts        # 流式生成演示（本地备料，真实调用 API）
```

整局试玩、假中转站等脚本（test-retry / fake-relay / play 等）为成员 C 本地备料，未随仓库上传（见「失败样例复现」一节的说明）。
