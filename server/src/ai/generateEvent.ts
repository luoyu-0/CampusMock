import { AiError, chatJSONStream, chatJSONWithRetry, type AiConfig } from "./deepseek.js";
import { buildFallbackEvent, type AiResult } from "./fallback.js";
import { buildEventPrompt } from "./prompts/event.js";
import type { EventGenInput, GameEvent } from "./schema.js";
import { checkStreamViolation, createEventStreamParser } from "./streamParse.js";
import { validateEventOutput, type EventContent } from "./validate.js";

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
  return toGameEvent(content, input.day);
}

// 校验通过后的统一收尾：分配事件 id 与选项字母 id。
// 字母 id 是选项的唯一标识（不在界面显示），choose 接口、前端按钮与存档校验都按它匹配。
function toGameEvent(content: EventContent, day: number): GameEvent {
  return {
    id: `ev-${day}-${crypto.randomUUID().slice(0, 8)}`,
    day,
    title: content.title,
    description: content.description,
    options: content.options.map((option, index) => ({
      id: String.fromCharCode(65 + index),
      ...option,
    })),
  };
}

export interface EventStreamHandlers {
  onRetry?(attempt: number): void; // 第 2 次尝试开始前通知，调用方应清空上一轮已显示的内容
  onTitle?(title: string): void; // 标题闭合（整体一次）
  onDescriptionDelta?(delta: string): void;
  onOptionText?(index: number, text: string): void; // 选项文本闭合（整条弹出）
  onResultTextDelta?(index: number, delta: string): void; // 结果叙述增量（已反转义）
  onResultText?(index: number, text: string): void; // 结果叙述闭合（完整）
}

// 违禁词按增量流检查：1 字回看拦住跨增量切开的词；每条增量流（描述 / 各结果叙述）持独立回看状态
function makeDeltaChecker(): (delta: string) => void {
  let tail = "";
  return (delta) => {
    const violation = checkStreamViolation(tail + delta);
    if (violation) throw new AiError("AI_INVALID_OUTPUT", violation, true);
    tail = delta.slice(-1);
  };
}

// 结果叙述按选项序号各持独立回看状态，互不串扰
function makeIndexedDeltaChecker(): (index: number, delta: string) => void {
  const checkers = new Map<number, (delta: string) => void>();
  return (index, delta) => {
    let check = checkers.get(index);
    if (!check) {
      check = makeDeltaChecker();
      checkers.set(index, check);
    }
    check(delta);
  };
}

// 流式版 generateEvent：标题与选项文本整体回调，描述 / 结果叙述逐字增量推送。
// 最终仍以整体 JSON 解析 + 校验为准，重试语义与 generateEvent 一致；
// 违禁词（军训 / 期末）在流式过程中命中会立即中止本次尝试并以反馈重试。
export async function generateEventStream(
  input: EventGenInput,
  cfg: AiConfig,
  handlers?: EventStreamHandlers,
): Promise<GameEvent> {
  const { system } = buildEventPrompt(input);
  let lastError = new AiError("AI_UPSTREAM", "模型调用未执行", false);
  let feedback: string | null = null;

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    if (attempt > 1) handlers?.onRetry?.(attempt);
    try {
      const checkDescriptionDelta = makeDeltaChecker();
      const checkResultDelta = makeIndexedDeltaChecker();
      const parser = createEventStreamParser({
        onTitle: (title) => {
          const violation = checkStreamViolation(title);
          if (violation) throw new AiError("AI_INVALID_OUTPUT", violation, true);
          handlers?.onTitle?.(title);
        },
        onDescriptionDelta: (delta) => {
          checkDescriptionDelta(delta);
          handlers?.onDescriptionDelta?.(delta);
        },
        onOptionText: (index, text) => {
          const violation = checkStreamViolation(text);
          if (violation) throw new AiError("AI_INVALID_OUTPUT", violation, true);
          handlers?.onOptionText?.(index, text);
        },
        onResultTextDelta: (index, delta) => {
          checkResultDelta(index, delta);
          handlers?.onResultTextDelta?.(index, delta);
        },
        // 闭合值不再重复查违禁词：增量检查已覆盖全部文本
        onResultText: (index, text) => {
          handlers?.onResultText?.(index, text);
        },
      });
      const raw = await chatJSONStream(
        cfg,
        system,
        buildEventPrompt(input, feedback).user,
        (chunk) => parser.feed(chunk),
      );
      let content: unknown;
      try {
        content = JSON.parse(raw);
      } catch {
        throw new AiError("AI_INVALID_OUTPUT", "模型输出内容不是合法 JSON", true);
      }
      return toGameEvent(validateEventOutput(content), input.day);
    } catch (err) {
      lastError = err instanceof AiError ? err : new AiError("AI_UPSTREAM", "思路突然断了，一时理不清（未知错误）", false);
      if (!lastError.retryable) throw lastError;
      if (lastError.code === "AI_INVALID_OUTPUT") feedback = lastError.message;
    }
  }
  throw lastError;
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
