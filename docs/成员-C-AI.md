# 成员 C：AI 内容生成模块（server/src/ai）

模块结构、接入方法与故障复现配方见 [server/src/ai/README.md](../server/src/ai/README.md)，本文件记进度与跨成员结论。

## 进度记录

- 9.10-21：首次上传，在测试程序中已可以正常运行，调用deepseek-v4-flash，内容基本符合预期，超时处理有出现失效情况等待完善，失败重试未完成，测试程序未上传。
- 9.11：失败重试链路完成——校验失败把问题清单注入下一次提示词让模型自纠，临时性错误自动重试（至多 3 次），耗尽后可选 Safe 兜底；提示词迭代至事件 v0.3.5 / 结局 v0.1.5；玩家档案（profile）改为可选字段，未收集时模型用中性表述兜底；游戏名随项目统一改为《我的大学日记》。
- 9.11：B 已把本模块接进真实路由（替换 mock），本人用真实模型完整跑通 14 天事件与结局。联调问题「AI 报错信息透传 err.message」已由 B 在 e6fa827 落地，五个错误码前端只需看 retryable 一个布尔。
- 9.12：事件生成新增真流式链路（`chatJSONStream` 请求 + `streamParse.ts` 增量解析 + `generateEventStream` 回调版），最终仍走整体校验与同一套重试语义；SSE 路由与前端渐进渲染未动，协议草案见下节「流式生成」。
- 9.12：实测发现解析器在选项阶段块边界误判休眠（`"text"` 与 `:` 被切开时重入错位），已修；同类隐患（跨块重入丢失「字符串内」状态）一并修复。标题改逐字回调 `onTitleDelta`，选项维持整条弹出（按钮交互件逐字无意义），effects 与 resultText 明确不流式（结算数值 / 选完才看的结果叙述）。新增离线夹具测试 `src/ai/scripts/stream-parse-test.ts`（五种切块回归，不调 API）。
- 9.12：审阅 A 的 PR #21（开始页采集玩家档案）：`PlayerProfile` 合同逐项核对一致、模块零改动（字段同名必填、两项都填才随请求体顶层发送、不进快照，正好接住我们的可选 + 中性兜底分支）；档案真正生效还差 B 的待协作 23（controller 把 `body.profile` 传进两个生成函数）**——9.12 晚已闭环：B 在 PR #24 接线，`normalizeProfile` 归一后在 `controller.ts:131` / `:267` 透传，档案链路端到端生效**。另按 A 的待协作 24 选方案①：AI_CONFIG / AI_TIMEOUT / AI_UPSTREAM 的 message 全部改写为日记体玩家话（句末括号带简短原因），完整技术细节（缺哪个变量 / HTTP 状态码 / 超时毫秒）进 `console.warn`；`AI_INVALID_OUTPUT` 文案不动——它兼做模型自纠反馈。**请 A 同步 `client/src/api/mockApi.ts` fatalServer 注入里照抄的 AI_CONFIG 文案**，改为「心神不定，不知如何落笔（未配置API密钥）」，否则 mock 错误屏与真链路文字不一致（截至 9.12 晚 `mockApi.ts:67` 仍是旧文案）。
- 9.12：按玩家观感调整流式面：标题与选项文本整体回调（去掉 `onTitleDelta`，`onTitle` / `onOptionText` 闭合时一次给出，选项维持整条弹出）；`resultText` 纳入流式（新增 `onResultTextDelta` + `onResultText`，是否提前展示由前端决定）；effects 仍不推送。夹具测试抓到「结果叙述序号偏移 +1」（optionIndex 在选项文本闭合时提前自增），已修。SSE 协议草案同步更新，**B 接路由时以新表为准（旧表的 `title-delta` / `option` 单事件已废）**。
- 9.12 晚：提示词内容微调并上传（事件侧：不迎合刻板印象、要求事件起伏、禁预设家境与兴趣偏好、NPC 主导上限改整局 4 天、选项改为 3 种不同态度、引用历史须核对不歪曲；结局侧：禁写家境情况、档位说明简化），版本号未升仍为 v0.3.5 / v0.1.5。`chatJSONWithRetry` 重试循环补 `console.warn` 留痕（第几次 / 错误码 / 原因，`[ai]` 前缀）——此前重试在服务端控制台完全不可见，无法判断「生成慢」是否因重试在跑。另两条跨成员事实：A 已在渲染层修掉第 14 天「选完卡骨架屏」（`GamePage` 结算门放宽到 `pendingEnding && !waiting`，B 的 controller 未动）；流式接口至今三段都未接（服务端调用点 / NDJSON 传输 / 前端消费，见 A 文档待协作 26），本模块的流式底座仍是备料状态。

## profile（玩家档案）

生成输入的可选字段 `profile: { gender, major }`（类型 `PlayerProfile`，已从 `server/src/ai/index.ts` 导出），事件与结局生成均可传；不传时模型自动用中性表述，不报错。档案不属于快照结构。现状（9.12 起）：A 在开始页收集、随生成请求体顶层 `profile` 发送；B 在 controller 用 `normalizeProfile` 归一（两项不全视为未收集）后透传给本模块，链路已端到端生效。详见 [server/src/ai/README.md](../server/src/ai/README.md) 的「玩家档案」一节。

## 流式生成（事件）

`generateEventStream(input, cfg, handlers)`（已从 ai 出口导出）：`generateEvent` 的流式版，对模型发 `stream: true`。流式面：描述逐字（`onDescriptionDelta`）、结果叙述逐字（`onResultTextDelta` 增量 + `onResultText` 闭合，选完才看的叙述可预取缓冲，是否提前展示由前端决定）；标题与选项文本整体回调（`onTitle` 一次给出，`onOptionText` 每选项整条弹出，A→B→C 依次）；effects 是结算数值，不流式。id 由服务端分配。`onRetry(attempt)` 在第 2 次尝试开始前触发。最终返回值与 `generateEvent` 完全一致（同一套整体校验、重试语义与选项字母 id），回调可能推送最终未通过校验的内容——收到 `onRetry` 应清空上一轮已显示内容，一切以最终返回的 `GameEvent` 为准。流式过程中即时拦截提示词硬禁词（军训 / 期末），命中立即中止本次尝试并带反馈重试；结构偏离预期时增量解析自动休眠，正确性由整体校验兜底。

SSE 转发协议草案（路由层做流式接口时参考，字段名可再议）：

| 事件 | data | 语义 |
| --- | --- | --- |
| `retry` | `{"attempt":2,"reason":"…"}` | 清空已显示内容，新一轮开始 |
| `title` | `{"value":"…"}` | 标题整体（完整，定稿信号） |
| `delta` | `{"text":"…"}` | 描述增量（已反转义） |
| `option` | `{"index":0,"text":"…"}` | 选项文本完成（整条弹出，index 0～2） |
| `result-delta` | `{"index":0,"text":"…"}` | 结果叙述增量 |
| `result` | `{"index":0,"text":"…"}` | 结果叙述闭合（完整） |
| `done` | 现有 `SuccessResponse` 信封 | 生成结束，以此为准替换快照 |
| `error` | 现有 `ErrorResponse` 结构 | 重试耗尽或不可重试错误，错误码映射不变 |

接入相关事实（已探明）：`client/src/api/gameApi.ts` 现在校验响应 content-type 必须是 JSON，SSE 需要单独的请求分支；`useGame.ts` 的一次性信封逻辑可不动（`done` 携带完整信封，作为最终权威）；等待 UI 骨架屏需为渐进渲染新增状态。流式版超时按「静默时长」计（沿用 `AI_TIMEOUT_MS`），模型持续出字不算超时。离线回归解析器（不调 API）：`npx tsx src/ai/scripts/stream-parse-test.ts`。演示脚本（本地备料，真实调用）：`npx tsx src/ai/scripts/stream-demo.ts`。

## 待办

- 备用事件/结局按《我的大学日记》文风重写（暂缓，兜底文案目前是通用风格）。
