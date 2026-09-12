import { AiError } from "./deepseek.js";
import { EFFECT_RANGES, ENDING_TEXT_LIMITS, OPTION_COUNT, TEXT_LIMITS } from "./prompts/values.js";
import { ATTRIBUTE_KEYS, type Attributes, type EventOption } from "./schema.js";

export interface EventContent {
  title: string;
  description: string;
  options: Omit<EventOption, "id">[];
}

export function validateEventOutput(raw: unknown): EventContent {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new AiError("AI_INVALID_OUTPUT", "模型输出不是 JSON 对象", true);
  }
  const obj = raw as Record<string, unknown>;
  const problems: string[] = [];

  const title = checkText(obj.title, "title", TEXT_LIMITS.title, problems);
  const description = checkText(obj.description, "description", TEXT_LIMITS.description, problems);

  const options: Omit<EventOption, "id">[] = [];
  if (!Array.isArray(obj.options)) {
    problems.push("options 不是数组");
  } else if (obj.options.length !== OPTION_COUNT) {
    problems.push(`options 应为 ${OPTION_COUNT} 个，实际 ${obj.options.length} 个`);
  } else {
    obj.options.forEach((item, index) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        problems.push(`options[${index}] 不是对象`);
        return;
      }
      const record = item as Record<string, unknown>;
      const text = checkText(record.text, `options[${index}].text`, TEXT_LIMITS.optionText, problems);
      const resultText = checkText(record.resultText, `options[${index}].resultText`, TEXT_LIMITS.resultText, problems);
      const effects = checkEffects(record.effects, index, problems);
      options.push({ text, resultText, effects });
    });
  }

  if (problems.length > 0) {
    throw new AiError("AI_INVALID_OUTPUT", `模型输出校验未通过：${problems.join("；")}`, true);
  }
  return { title, description, options };
}

export interface EndingContent {
  title: string;
  description: string;
  evaluation: string;
  advice: string;
}

export function validateEndingOutput(raw: unknown): EndingContent {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new AiError("AI_INVALID_OUTPUT", "模型输出不是 JSON 对象", true);
  }
  const obj = raw as Record<string, unknown>;
  const problems: string[] = [];

  const title = checkText(obj.title, "title", ENDING_TEXT_LIMITS.title, problems);
  const description = checkText(obj.description, "description", ENDING_TEXT_LIMITS.description, problems);
  const evaluation = checkText(obj.evaluation, "evaluation", ENDING_TEXT_LIMITS.evaluation, problems);
  const advice = checkText(obj.advice, "advice", ENDING_TEXT_LIMITS.advice, problems);

  if (problems.length > 0) {
    throw new AiError("AI_INVALID_OUTPUT", `模型输出校验未通过：${problems.join("；")}`, true);
  }
  return { title, description, evaluation, advice };
}

function checkText(value: unknown, field: string, maxLen: number, problems: string[]): string {
  if (typeof value !== "string") {
    problems.push(`${field} 缺失或不是字符串`);
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    problems.push(`${field} 为空`);
  } else if (trimmed.length > maxLen) {
    problems.push(`${field} 超过 ${maxLen} 字`);
  }
  return trimmed;
}

function checkEffects(value: unknown, index: number, problems: string[]): Attributes {
  const out: Attributes = { academics: 0, social: 0, energy: 0, money: 0 };
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    problems.push(`options[${index}].effects 缺失或不是对象`);
    return out;
  }
  const record = value as Record<string, unknown>;
  for (const key of ATTRIBUTE_KEYS) {
    const raw = record[key];
    // 只兼容明确的十进制数值，避免 Number(null)、Number('') 被误当作 0。
    const numeric = typeof raw === "string" && /^[+-]?\d+(?:\.\d+)?$/.test(raw.trim())
      ? Number(raw.trim())
      : raw;
    const range = EFFECT_RANGES[key];
    if (typeof numeric !== "number" || !Number.isFinite(numeric)) {
      problems.push(`options[${index}].effects.${key} 缺失或不是有效数值`);
      continue;
    }
    // 先校验原值范围，不能借取整掩盖越界。正负数均按绝对值四舍五入。
    if (numeric < range.min || numeric > range.max) {
      problems.push(`options[${index}].effects.${key}=${numeric} 超出范围 ${range.min}~${range.max}`);
      continue;
    }
    out[key] = Math.sign(numeric) * Math.round(Math.abs(numeric)) || 0;
  }
  return out;
}
