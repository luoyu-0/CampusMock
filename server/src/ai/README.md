# AI 内容生成模块（src/ai）

《你好，我的大学》的事件与结局生成模块（成员 C 负责）：构建提示词 → 调用 DeepSeek 兼容 API（JSON 输出模式）→ 运行时校验 → 返回结构化内容。无运行时依赖，仅使用 Node 内置 fetch。迭代与实测记录见 [成员C-开发过程.md](../../成员C-开发过程.md)。

## 结构

```text
server/
├── package.json / tsconfig.json   # 模块独立开发用；并入完整后端时与路由层的配置合并
├── scripts/
│   ├── test-ai.ts                 # 验证脚本：--dry 不调 API 自测校验，test:event / test:ending 真实调用
│   └── play.ts                    # CLI 跑完整一局（14+1 次调用），存档写入 CampusMock/saves/
└── src/ai/
    ├── index.ts                   # 唯一出口：路由层只从这里 import
    ├── generateEvent.ts           # generateEvent：提示词 → 调用 → 校验 → 分配事件 id 与选项编号 A/B/C
    ├── generateEnding.ts          # generateEnding：提示词 → 调用 → 校验 → 结局四字段
    ├── deepseek.ts                # loadAiConfig（读 .env）+ chatJSON 请求封装 + chatJSONWithRetry 重试 + AiError
    ├── validate.ts                # 输出校验：字段/长度/整数/效果范围，违规整体拒绝、不截断
    ├── schema.ts                  # 类型：四维属性、GameEvent、Ending、生成输入
    └── prompts/
        ├── event.ts / ending.ts   # 事件、结局的系统提示词（随实测迭代）
        ├── common.ts              # 共用片段：属性标签、效果摘要、历史列表格式化
        └── values.ts              # 硬性约束数值（选项数、字数上限、效果范围），提示词与校验共用，改数值只改这里
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

路由层只需两个函数；输入从游戏快照提取，输出已通过校验，可直接组装进快照下发。

```ts
import { generateEvent, generateEnding, loadAiConfig, AiError } from "../ai/index.js";

const cfg = loadAiConfig(); // 建议启动时调用一次，密钥缺失即刻暴露

// 每天 1 次：{ day, attributes, history（精简经历记录） }
const event = await generateEvent(input, cfg);
// → GameEvent：id、day、title、description、options（A/B/C 编号、effects、resultText 均已就绪）

// 两周结束 1 次：{ attributes（最终四维）, grades（A~D 档位，由路由层计算）, history }
const ending = await generateEnding(input, cfg);
// → Ending：title、description、evaluation、advice
```

### 错误处理

超时、限流、无效输出等可重试错误已在函数内自动重试（最多 `AI_MAX_ATTEMPTS` 次），最终失败才抛出；路由层按 `code` 映射到接口约定的错误响应。

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

### 职责边界

本模块只做「输入快照 → 校验后的生成内容」的转换：不写存档、不改游戏进度；「快照已有未结算事件 / 已有结局则直接返回」的幂等判断由路由层完成。

## 自测命令

在 `server/` 下执行：

```bash
npm install
npm run typecheck     # 类型检查
npm run test:dry      # 不调 API：合法样例通过、坏样例被整体拒绝
npm run test:event    # 真实生成第 1 天事件
npm run test:ending   # 真实生成结局（14 天完整历史样例）
npm run play          # CLI 跑完整一局，存档写入 saves/
```
