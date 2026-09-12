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

// 玩家可见文案（《我的大学日记》日记体）：路由层对 AiError 是 err.message 原样透传上屏，句末括号带简短原因。
// 原因随场景不同的（CONFIG / UPSTREAM）常量只留句子、括号由抛出点拼接；单因的（TIMEOUT / NETWORK）括号直接带在常量里。
// 完整技术细节进 console.warn（[ai] 前缀）
const CONFIG_MESSAGE = "心神不定，不知如何落笔";
const TIMEOUT_MESSAGE = "落笔前想的太多，有些出神了（超时）";
const NETWORK_MESSAGE = "回忆有些模糊，可能得再仔细想想（网络错误）";
const UPSTREAM_MESSAGE = "写着写着，笔没了墨";

export function loadAiConfig(): AiConfig {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[ai] AI_CONFIG：缺少环境变量 DEEPSEEK_API_KEY（密钥不进入前端与存档）");
    throw new AiError("AI_CONFIG", `${CONFIG_MESSAGE}（未配置API密钥）`, false);
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
        console.warn(`[ai] AI_TIMEOUT：请求 ${cfg.timeoutMs} ms 未响应`);
        throw new AiError("AI_TIMEOUT", TIMEOUT_MESSAGE, true);
      }
      console.warn("[ai] AI_UPSTREAM：请求网络错误");
      throw new AiError("AI_UPSTREAM", NETWORK_MESSAGE, true);
    }

    if (!res.ok) {
      if (res.status === 429) {
        throw new AiError("AI_RATE_LIMIT", "思绪有些纷乱，先休息一下吧（模型限流）", true);
      }
      if (res.status === 401 || res.status === 403) {
        console.warn(`[ai] AI_CONFIG：模型服务鉴权失败（HTTP ${res.status}），请检查 DEEPSEEK_API_KEY 与账户状态`);
        throw new AiError("AI_CONFIG", `${CONFIG_MESSAGE}（密钥无效或账户异常）`, false);
      }
      console.warn(`[ai] AI_UPSTREAM：上游返回 HTTP ${res.status}`);
      throw new AiError("AI_UPSTREAM", `${UPSTREAM_MESSAGE}（HTTP ${res.status}）`, res.status >= 500);
    }

    let data: ChatCompletionResponse;
    try {
      data = (await res.json()) as ChatCompletionResponse;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.warn(`[ai] AI_TIMEOUT：响应读取超过 ${cfg.timeoutMs} ms 未完成`);
        throw new AiError("AI_TIMEOUT", TIMEOUT_MESSAGE, true);
      }
      console.warn("[ai] AI_UPSTREAM：响应不是合法 JSON（常见于中转站返回了非 JSON 错误页）");
      throw new AiError("AI_UPSTREAM", `${UPSTREAM_MESSAGE}（响应格式异常）`, true);
    }

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      console.warn("[ai] AI_UPSTREAM：响应正文为空");
      throw new AiError("AI_UPSTREAM", `${UPSTREAM_MESSAGE}（响应为空）`, true);
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

interface ChatCompletionChunk {
  choices?: { delta?: { content?: unknown } }[];
}

// 流式版 chatJSON：请求体加 stream:true，每收到一段正文增量就回调 onDelta，最终返回完整原始文本。
// 超时按「静默时长」计：每收到增量就重置计时器，只要模型还在出字就不算超时。
// onDelta 里可以抛错提前终止（如流式违禁词检查），异常会原样上抛、由调用方决定语义，这里只负责关掉连接。
export async function chatJSONStream(
  cfg: AiConfig,
  system: string,
  user: string,
  onDelta: (chunk: string) => void,
): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  };

  try {
    arm();
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
          stream: true,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.warn(`[ai] AI_TIMEOUT：请求 ${cfg.timeoutMs} ms 未响应`);
        throw new AiError("AI_TIMEOUT", TIMEOUT_MESSAGE, true);
      }
      console.warn("[ai] AI_UPSTREAM：请求网络错误");
      throw new AiError("AI_UPSTREAM", NETWORK_MESSAGE, true);
    }

    if (!res.ok) {
      if (res.status === 429) {
        throw new AiError("AI_RATE_LIMIT", "思绪有些纷乱，先休息一下吧（模型限流）", true);
      }
      if (res.status === 401 || res.status === 403) {
        console.warn(`[ai] AI_CONFIG：模型服务鉴权失败（HTTP ${res.status}），请检查 DEEPSEEK_API_KEY 与账户状态`);
        throw new AiError("AI_CONFIG", `${CONFIG_MESSAGE}（密钥无效或账户异常）`, false);
      }
      console.warn(`[ai] AI_UPSTREAM：上游返回 HTTP ${res.status}`);
      throw new AiError("AI_UPSTREAM", `${UPSTREAM_MESSAGE}（HTTP ${res.status}）`, res.status >= 500);
    }
    if (!res.body) {
      console.warn("[ai] AI_UPSTREAM：响应没有正文");
      throw new AiError("AI_UPSTREAM", `${UPSTREAM_MESSAGE}（响应为空）`, true);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    // 解析一帧 SSE：取 data 行里 choices[0].delta.content；[DONE] 表示生成结束
    const consumeFrame = (frame: string): { content: string; finished: boolean } => {
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return { content: "", finished: true };
        try {
          const parsed = JSON.parse(payload) as ChatCompletionChunk;
          const delta = parsed.choices?.[0]?.delta?.content;
          return { content: typeof delta === "string" ? delta : "", finished: false };
        } catch {
          return { content: "", finished: false };
        }
      }
      return { content: "", finished: false };
    };

    try {
      reading: while (true) {
        arm();
        const { done, value } = await reader.read();
        if (done) break;
        buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const { content, finished } = consumeFrame(frame);
          if (finished) break reading;
          if (content) {
            full += content;
            onDelta(content);
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.warn(`[ai] AI_TIMEOUT：流式响应超过 ${cfg.timeoutMs} ms 无增量`);
        throw new AiError("AI_TIMEOUT", TIMEOUT_MESSAGE, true);
      }
      throw err;
    }

    if (full.trim() === "") {
      console.warn("[ai] AI_UPSTREAM：流式响应正文为空");
      throw new AiError("AI_UPSTREAM", `${UPSTREAM_MESSAGE}（响应为空）`, true);
    }
    return full;
  } finally {
    if (timer) clearTimeout(timer);
    // 提前退出（含 onDelta 抛错）时中止连接避免套接字悬挂；正常读完后 abort 无副作用
    controller.abort();
  }
}

// 统一重试入口（最多 cfg.maxAttempts 次）：可重试错误自动重试，不可重试错误立即抛出。
// validate 失败（AI_INVALID_OUTPUT）时把问题清单注入下一次 user 提示词，让模型针对性自纠。
export async function chatJSONWithRetry<T>(
  cfg: AiConfig,
  system: string,
  buildUser: (feedback: string | null) => string,
  validate: (raw: unknown) => T,
): Promise<T> {
  let lastError = new AiError("AI_UPSTREAM", "模型调用未执行", false);
  let feedback: string | null = null;
  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      const raw = await chatJSON(cfg, system, buildUser(feedback));
      return validate(raw);
    } catch (err) {
      lastError = err instanceof AiError ? err : new AiError("AI_UPSTREAM", "思路突然断了，一时理不清（未知错误）", false);
      // 重试对玩家与接口响应都不可见，这里失败原因的唯一留痕点
      console.warn(`[ai] 第 ${attempt}/${cfg.maxAttempts} 次生成失败（${lastError.code}）：${lastError.message}`);
      if (!lastError.retryable) throw lastError;
      if (lastError.code === "AI_INVALID_OUTPUT") feedback = lastError.message;
    }
  }
  throw lastError;
}
