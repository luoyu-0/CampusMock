import { AiError, chatJSONWithRetry, type AiConfig } from "./deepseek.js";
import { buildFallbackEvent, type AiResult } from "./fallback.js";
import { buildEventPrompt } from "./prompts/event.js";
import type { EventGenInput, GameEvent } from "./schema.js";
import { validateEventOutput } from "./validate.js";

// 生成第 input.day 天的事件（事件 + 选项 + 效果 + 结果叙述，一次调用）。
// 校验失败会把问题清单反馈给模型重试；幂等判断与快照组装由路由层负责。
export async function generateEvent(input: EventGenInput, cfg: AiConfig): Promise<GameEvent> {
  const { system } = buildEventPrompt(input);
  const content = await chatJSONWithRetry(
    cfg,
    system,
    (feedback) => buildEventPrompt(input, feedback).user,
    validateEventOutput,
  );
  return {
    id: `ev-${input.day}-${crypto.randomUUID().slice(0, 8)}`,
    day: input.day,
    title: content.title,
    description: content.description,
    options: content.options.map((option, index) => ({
      id: String.fromCharCode(65 + index),
      ...option,
    })),
  };
}

// 失败兜底版：临时性错误重试耗尽时返回备用事件；配置类错误照常抛出，避免掩盖真实问题
export async function generateEventSafe(input: EventGenInput, cfg: AiConfig): Promise<AiResult<GameEvent>> {
  try {
    return { value: await generateEvent(input, cfg), usedFallback: false, error: null };
  } catch (err) {
    if (!(err instanceof AiError) || !err.retryable) throw err;
    return { value: buildFallbackEvent(input), usedFallback: true, error: err };
  }
}
