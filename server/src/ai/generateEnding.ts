import { AiError, chatJSONWithRetry, type AiConfig } from "./deepseek.js";
import { FALLBACK_ENDING, type AiResult } from "./fallback.js";
import { buildEndingPrompt } from "./prompts/ending.js";
import type { Ending, EndingGenInput } from "./schema.js";
import { validateEndingOutput } from "./validate.js";

// 生成两周结局（标题、详情、评价、建议，一次调用）。最终值与档位由路由层按规则计算后传入。
// 校验失败会把问题清单反馈给模型重试；「已有结局直接返回」的幂等判断由路由层负责。
export async function generateEnding(input: EndingGenInput, cfg: AiConfig): Promise<Ending> {
  const { system } = buildEndingPrompt(input);
  return chatJSONWithRetry(cfg, system, (feedback) => buildEndingPrompt(input, feedback).user, validateEndingOutput);
}

// 失败兜底版：临时性错误重试耗尽时返回备用结局；配置类错误照常抛出，避免掩盖真实问题
export async function generateEndingSafe(input: EndingGenInput, cfg: AiConfig): Promise<AiResult<Ending>> {
  try {
    return { value: await generateEnding(input, cfg), usedFallback: false, error: null };
  } catch (err) {
    if (!(err instanceof AiError) || !err.retryable) throw err;
    return { value: { ...FALLBACK_ENDING }, usedFallback: true, error: err };
  }
}
