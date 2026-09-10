import { chatJSONWithRetry, type AiConfig } from "./deepseek.js";
import { buildEventPrompt } from "./prompts/event.js";
import type { EventGenInput, GameEvent } from "./schema.js";
import { validateEventOutput } from "./validate.js";

// 生成第 input.day 天的事件（事件 + 选项 + 效果 + 结果叙述，一次调用）。
// 可重试错误由 chatJSONWithRetry 自动重试；幂等判断与快照组装由路由层负责。
export async function generateEvent(input: EventGenInput, cfg: AiConfig): Promise<GameEvent> {
  const { system, user } = buildEventPrompt(input);

  const raw = await chatJSONWithRetry(cfg, system, user);
  const content = validateEventOutput(raw);
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
