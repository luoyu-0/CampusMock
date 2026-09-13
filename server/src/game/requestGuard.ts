import type { RequestHandler } from 'express';

// 单进程全局保护，不信任客户端伪造的 IP 头；宝塔代理和直连均生效。
export function createGenerationGuard(options: { concurrency?: number; perMinute?: number; timeoutMs?: number } = {}): RequestHandler {
  const positive = (value: unknown, fallback: number) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
  const concurrency = options.concurrency ?? positive(process.env.AI_MAX_CONCURRENT, 3);
  const perMinute = options.perMinute ?? positive(process.env.AI_REQUESTS_PER_MINUTE, 60);
  const timeoutMs = options.timeoutMs ?? 180000;
  let active = 0;
  let count = 0;
  let windowStart = Date.now();
  return (req, res, next) => {
    if (Date.now() - windowStart >= 60000) { count = 0; windowStart = Date.now(); }
    if (active >= concurrency || count >= perMinute) {
      res.setHeader('Retry-After', '10');
      res.status(429).json({ requestId: req.body?.requestId ?? 'unknown', error: {
        code: 'SERVER_BUSY', message: '当前写日记的人较多，请稍后再试。', retryable: true,
      } });
      return;
    }
    active++; count++;
    const controller = new AbortController();
    res.locals.aiSignal = controller.signal;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active--;
      clearTimeout(timer);
      controller.abort();
    };
    res.once('finish', release);
    res.once('close', release);
    next();
  };
}
