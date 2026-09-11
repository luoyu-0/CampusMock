export type AiErrorCode =
  | "AI_CONFIG"
  | "AI_TIMEOUT"
  | "AI_RATE_LIMIT"
  | "AI_UPSTREAM"
  | "AI_INVALID_OUTPUT";

export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  temperature: number;
  maxAttempts: number;
}

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_TEMPERATURE = 1.0;
const DEFAULT_MAX_ATTEMPTS = 3;

export function loadAiConfig(): AiConfig {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new AiError("AI_CONFIG", "缺少环境变量 DEEPSEEK_API_KEY，请在后端 .env 中配置（密钥不进入前端与存档）", false);
  }
  return {
    apiKey,
    baseUrl: process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL,
    model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
    timeoutMs: positiveIntEnv("AI_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
    temperature: positiveNumberEnv("AI_TEMPERATURE", DEFAULT_TEMPERATURE),
    maxAttempts: positiveIntEnv("AI_MAX_ATTEMPTS", DEFAULT_MAX_ATTEMPTS),
  };
}

function positiveIntEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function positiveNumberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: unknown } }[];
}

export async function chatJSON(cfg: AiConfig, system: string, user: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  // 超时必须覆盖到正文读取完成：中转站先回响应头、再流式传输正文，计时器提前清除会导致永不中止
  try {
    let res: Response;
    try {
      res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
          thinking: { type: "disabled" },
          max_tokens: 2048,
          temperature: cfg.temperature,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new AiError("AI_TIMEOUT", `模型请求超过 ${cfg.timeoutMs} ms 未响应`, true);
      }
      throw new AiError("AI_UPSTREAM", "模型请求网络错误", true);
    }

    if (!res.ok) {
      if (res.status === 429) {
        throw new AiError("AI_RATE_LIMIT", "模型调用频率受限，请稍后重试", true);
      }
      if (res.status === 401 || res.status === 403) {
        throw new AiError("AI_CONFIG", "模型服务鉴权失败，请检查 API 密钥与账户状态", false);
      }
      throw new AiError("AI_UPSTREAM", `模型服务返回状态码 ${res.status}`, res.status >= 500);
    }

    let data: ChatCompletionResponse;
    try {
      data = (await res.json()) as ChatCompletionResponse;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new AiError("AI_TIMEOUT", `模型响应超过 ${cfg.timeoutMs} ms 未完成`, true);
      }
      throw new AiError("AI_UPSTREAM", "模型响应不是合法 JSON", true);
    }

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new AiError("AI_UPSTREAM", "模型响应内容为空", true);
    }

    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw new AiError("AI_INVALID_OUTPUT", "模型输出内容不是合法 JSON", true);
    }
  } finally {
    clearTimeout(timer);
  }
}

// 可重试错误自动重试，最多 cfg.maxAttempts 次；不可重试错误立即抛出
export async function chatJSONWithRetry(cfg: AiConfig, system: string, user: string): Promise<unknown> {
  let lastError = new AiError("AI_UPSTREAM", "模型调用未执行", false);
  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      return await chatJSON(cfg, system, user);
    } catch (err) {
      lastError = err instanceof AiError ? err : new AiError("AI_UPSTREAM", "模型调用发生未知错误", false);
      if (!lastError.retryable) throw lastError;
    }
  }
  throw lastError;
}
