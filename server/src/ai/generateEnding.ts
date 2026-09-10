import { chatJSONWithRetry, type AiConfig } from "./deepseek.js";
import { buildEndingPrompt } from "./prompts/ending.js";
import type { Ending, EndingGenInput } from "./schema.js";
import { validateEndingOutput } from "./validate.js";

// 生成两周结局（标题、详情、评价、建议，一次调用）。最终值与档位由路由层按规则计算后传入。
// 可重试错误由 chatJSONWithRetry 自动重试；「已有结局直接返回」的幂等判断由路由层负责。
export async function generateEnding(input: EndingGenInput, cfg: AiConfig): Promise<Ending> {
  const { system, user } = buildEndingPrompt(input);
  const raw = await chatJSONWithRetry(cfg, system, user);
  return validateEndingOutput(raw);
}
