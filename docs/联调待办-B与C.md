# 联调待办（成员 A 实测 → 成员 B / C）

> 2026-09-11 成员 A 用真实 Express 跑完整局时发现，按文件与行号可复现。两条都**不需要前端改动**，请 B/C 认领后直接改自己那边，不必等我。
> 结论级变更请照 [成员开发记录说明](成员开发记录说明.md) 最后一条同步回 [接口约定](接口约定.md)，本文只作交接现场记录。

## 一、成员 C 的 AI 模块没有接进路由（阻塞验收，建议今晚上线）

**现状**

- `server/src/game/controller.ts:70` 调的是同文件第 7 行的 `mockGenerateEvent`；`controller.ts:137` 调同文件第 37 行的 `mockGenerateEnding`。
- 全仓库 `grep "from '.*ai/" server/src` 无结果 —— PR #10 只把 `server/src/ai/` 和 `constants.ts` 的类型对齐并进主干，没有任何调用方。

**后果**：验收项「事件与结局内容来自模型输出」「内容多样性与前后承接」端到端过不了。玩家/评委看得见的具体现象是：14 天每天描述都是同一句「你走在校园里，遇到了一件需要自己决定的小事」，三个选项恒定不变，结局四段文字也恒定。

**接线需要动的三处**（`controller.ts` 里逻辑已经齐了，只换生成来源）

1. **入参映射**：`ai/schema.ts` 的 `EventGenInput.history` 是 `HistoryDigestItem[]`，字段名是 **`chosenOptionText`**；快照里 `HistoryRecord` 存的是 **`chosenText`**。两边其余字段（`day/eventTitle/resultText/effects`）同名，`day`/`attributes` 直接取，`history` 需要一次 map，别整体塞进去。
2. **结局入参**：`EndingGenInput` 要 `attributes` + `grades` + `history`，`grades` 用 `service.ts` 现成的 `getGrades(snapshot.attributes)`；模型只返回四段文字，`finalAttributes/grades` 仍由路由层写入（`controller.ts:142-145` 已经是这个写法）。
3. **错误码要透传 `retryable`**：`loadAiConfig()` 在缺 `DEEPSEEK_API_KEY` 时抛的是 `AiError("AI_CONFIG", …, retryable=false)`，而两个 `catch` 块（`controller.ts:80-83`、`:149-151`）会把任何异常统一压成 `AI_GENERATION_FAILED / retryable: true`。后果落在界面上很具体：**密钥没配时玩家看到的是「重试这一步」，点多少次都是同一个错**，而前端错误屏的可重试与否完全照 `error.retryable` 走。建议 catch 里判 `error instanceof AiError` 就 `sendError(res, requestId, error.code, error.message, error.retryable)`，非 AiError 才回退到 `AI_GENERATION_FAILED`。C 的五个码 `AI_CONFIG / AI_TIMEOUT / AI_RATE_LIMIT / AI_UPSTREAM / AI_INVALID_OUTPUT` 前端不需要逐个写文案，只有 `retryable` 一个布尔决定界面形态。

**环境**：`.env` 读取没问题（`server/src/index.ts:7-12` 会取 `仓库根/.env` 或 `server/.env`，先命中者生效），`.env.example` 里 `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL` 已列；`DEEPSEEK_BASE_URL / AI_TIMEOUT_MS / AI_TEMPERATURE / AI_MAX_ATTEMPTS` 有默认值，未列进 example 也跑得起来。

**接线后请给 A 一个失败样例**：超时和无效输出这两种（`AI_TIMEOUT` / `AI_INVALID_OUTPUT`）在真链路上造不出来，走查面板的失败注入只在前端假 API 模式下生效。有了可复现的失败场景，A 才能补验错误屏。

## 二、服务端不校验 `revision`，过期请求只有客户端在挡

**复现**（服务起在 3000 时可直接贴；注意快照的 `options` 至少要两个，只给一个会被 `INVALID_SNAPSHOT` 挡下，复现不到 revision 这一层）

```bash
curl -s -X POST http://localhost:3000/api/events/choose -H 'content-type: application/json' -d '{"requestId":"rev-check","snapshot":{"schemaVersion":1,"rulesVersion":1,"gameId":"11111111-1111-4111-8111-111111111111","revision":99,"phase":"pendingChoice","attributes":{"academics":0,"social":0,"energy":7,"money":1000},"history":[],"currentEvent":{"id":"ev-1","day":1,"title":"t","description":"d","options":[{"id":"A","text":"x","effects":{"academics":1,"social":0,"energy":0,"money":0},"resultText":"r"},{"id":"B","text":"y","effects":{"academics":0,"social":1,"energy":0,"money":0},"resultText":"s"}]},"ending":null},"eventId":"ev-1","optionId":"A"}'
```

实测返回 **HTTP 200**：`baseRevision: 99`、`revision: 100`、`phase: showResult`，并且真的写入了一条 `history`。也就是说 `revision: 99` 这种与状态完全对不上的修订号，服务端照单全收。

**为什么现在没出事**：`client/src/state/useGame.ts` 在接纳响应前比了五样 —— 请求令牌、`requestId`、`gameId`、当前 `revision`、响应 `baseRevision`，所以浏览器路径上过期响应会被丢掉并提示「这一步的响应回来晚了」。而且"同一事件重复提交"服务端是挡住的（`controller.ts:94` 按 `eventId` 命中历史就直接回原快照）。

真正的缺口在别处：服务端按设计是无状态的（玩家浏览器持有存档），所以它**无从知道"最新进度"是哪一份**，旧快照和当前快照在它眼里完全同形，都会被接受并各自产出一份自洽但互相分叉的结果。也正因此，能做的校验只有"自洽"这一种，方案一才便宜 —— 不需要服务端存状态，只要比对 `revision` 与 `history.length`。

**请 B 二选一并写进接口约定**（A 这边两种都不需要改代码）

- 在 `validateSnapshot` 里补一条：`revision` 应与状态自洽（每转换一次 +1，所以 `pendingChoice` 时 `revision === 2 * history.length + 1`），或
- 明确写「服务端信任客户端提供的 `revision`」，那么防分叉就只剩 `controller.ts:94` 那一条按 `eventId` 的去重，接口约定里要把这个边界写清楚。

## 三、顺带三条给团队

1. **两个错误屏现在很难演**：失败注入（`setFault`）只在前端假 API 里生效，默认 `VITE_API_MODE=server` 时那两颗按钮是 disabled。真链路上要复现「可重试」只能把 Express 停掉（拿到 `NETWORK_ERROR`，已实测成立），要复现「不可重试」目前只能喂一份坏存档。演示时需要一条现成路径的话，用 `VITE_API_MODE=mock` 起前端最快 —— 要不要写进 `Deploy.md` 由负责人定。
2. **顶格长文案已经预先验过，模型接线后不必再操心排版**：走查面板新增 `⑥ 顶格长文案`、`⑦ 顶格结局`，字量照 `ai/prompts/values.ts` 的 `TEXT_LIMITS` / `ENDING_TEXT_LIMITS` 逐项顶满。**如果 C 之后放宽这两个上限**（注释里写着"草案值，实测后调整"），请同步 A 一次，夹具要跟着改，否则验的就不是真实最坏情况。
3. **别在服务端加数值上下界**：`接口约定.md` 已写明「所有属性与增减均为整数，**允许最终值为负**」，C 的提示词里也专门有「金钱已为负」的情境分支。实测连续选消耗精力的选项 14 次会得到 `精力 −7`、`学业 28` 且服务端不钳制 —— 这是符合约定的，界面的负号显示已按 `formatValue`（U+2212）核对过，不要为"看起来奇怪"而改掉规则。
