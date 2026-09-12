// ============================================
// 接口控制器（支持 NDJSON 流式响应）
// ============================================

import { Request, Response } from 'express';
import {
  Snapshot,
  GenerateEventRequest,
  ChooseOptionRequest,
  GenerateEndingRequest,
  SuccessResponse,
  ErrorResponse,
  HistoryEntry,
  HistoryDigestItem,
  PlayerProfile,
} from './types';
import {
  validateSnapshot,
  incrementRevision,
  isGameCompleted,
  getCurrentDay,
  applyEffects,
  getGrades,
  validateEventEffects,
} from './service';
import { TOTAL_DAYS } from './constants';
import {
  generateEvent as aiGenerateEvent,
  generateEventStream,
  generateEnding as aiGenerateEnding,
  loadAiConfig,
  AiError,
} from '../ai/index';

// ============ 启动时加载 AI 配置 ============
let aiConfig: ReturnType<typeof loadAiConfig> | null = null;
try {
  aiConfig = loadAiConfig();
  console.log('[AI] Config loaded successfully');
} catch (err) {
  console.warn('[AI] Failed to load config, AI features will be unavailable:', err);
}

// ============ 工具：HistoryEntry → HistoryDigestItem ============
function toDigestItem(h: HistoryEntry): HistoryDigestItem {
  return {
    day: h.day,
    eventTitle: h.eventTitle,
    chosenOptionText: h.chosenText,
    resultText: h.resultText,
    effects: h.effects,
  };
}

// ============ 工具：校验并规范化 profile ============
function normalizeProfile(raw: unknown): PlayerProfile | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as Record<string, unknown>;
  const gender = p.gender === '男' || p.gender === '女' ? p.gender : '';
  const major = typeof p.major === 'string' ? p.major.trim() : '';
  if (!gender || !major) return undefined;
  return { gender, major };
}

// ============ 工具：错误响应（流未开始时） ============
function sendError(
  res: Response,
  requestId: string,
  code: string,
  message: string,
  retryable: boolean = true
) {
  const response: ErrorResponse = {
    requestId,
    error: { code, message, retryable },
  };
  res.status(400).json(response);
}

// ============ 工具：成功响应（流未开始时） ============
function sendSuccess(res: Response, data: SuccessResponse) {
  res.json(data);
}

// ============ 工具：处理 AiError ============
function handleAiError(res: Response, requestId: string, err: unknown) {
  if (err instanceof AiError) {
    const codeMap: Record<string, string> = {
      AI_CONFIG: 'AI_CONFIG_ERROR',
      AI_TIMEOUT: 'AI_TIMEOUT',
      AI_RATE_LIMIT: 'AI_RATE_LIMIT',
      AI_UPSTREAM: 'AI_UPSTREAM_ERROR',
      AI_INVALID_OUTPUT: 'AI_INVALID_OUTPUT',
    };
    const code = codeMap[err.code] || 'AI_GENERATION_FAILED';
    return sendError(res, requestId, code, `AI error: ${err.code}`, err.retryable);
  }
  console.error('Unknown AI error:', err);
  return sendError(res, requestId, 'AI_GENERATION_FAILED', 'AI generation failed', true);
}

// ============ 工具：写一帧 NDJSON ============
function writeFrame(res: Response, frame: Record<string, unknown>) {
  res.write(JSON.stringify(frame) + '\n');
}

// ============ 1. POST /api/events/generate（流式） ============
export async function generateEvent(req: Request, res: Response) {
  const { requestId, snapshot, profile } = req.body as GenerateEventRequest;

  if (!requestId) {
    return sendError(res, 'unknown', 'MISSING_REQUEST_ID', 'Missing requestId', false);
  }
  if (!snapshot) {
    return sendError(res, requestId, 'MISSING_SNAPSHOT', 'Missing snapshot', false);
  }

  const validation = validateSnapshot(snapshot);
  if (!validation.isValid) {
    return sendError(res, requestId, 'INVALID_SNAPSHOT', validation.reason || 'Snapshot validation failed', false);
  }

  // 幂等：已有未结算事件则直接返回（整包 JSON，不用流）
  if (snapshot.currentEvent && snapshot.phase === 'pendingChoice') {
    const response: SuccessResponse = {
      requestId,
      baseRevision: snapshot.revision,
      snapshot: { ...snapshot },
    };
    return sendSuccess(res, response);
  }

  if (isGameCompleted(snapshot)) {
    return sendError(res, requestId, 'GAME_COMPLETED', 'Game already ended', false);
  }

  if (!aiConfig) {
    return sendError(res, requestId, 'AI_CONFIG_ERROR', 'AI config not loaded, check DEEPSEEK_API_KEY', false);
  }

  const day = getCurrentDay(snapshot);
  const normalizedProfile = normalizeProfile(profile);

  // ============ 开始流式响应 ============
  // 先写头，状态码 200，Content-Type 是 NDJSON
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  // 流已开始，此后所有错误都通过终帧传递，不再改状态码
  try {
    const eventData = await generateEventStream(
      {
        day,
        attributes: snapshot.attributes,
        history: snapshot.history.map(toDigestItem),
        profile: normalizedProfile,
      },
      aiConfig,
      {
        onRetry: () => {
          // 通知前端清空草稿
          writeFrame(res, { k: 'reset' });
        },
        onTitle: (title) => {
          writeFrame(res, { k: 'title', v: title });
        },
        onDescriptionDelta: (delta) => {
          writeFrame(res, { k: 'desc', v: delta });
        },
        // onOptionText / onResultTextDelta 前端暂不画，不写帧
      }
    );

    // 校验选项效果
    for (const opt of eventData.options) {
      const effectValidation = validateEventEffects(opt.effects);
      if (!effectValidation.isValid) {
        // 流已开始，用终帧返回错误
        writeFrame(res, {
          k: 'end',
          requestId,
          error: {
            code: 'AI_INVALID_OUTPUT',
            message: effectValidation.reason || 'Effect out of range',
            retryable: true,
          },
        });
        return res.end();
      }
    }

    // 组装新快照
    let newSnapshot = incrementRevision(snapshot);
    newSnapshot = {
      ...newSnapshot,
      phase: 'pendingChoice',
      currentEvent: eventData,
    };

    // 终帧
    const response: SuccessResponse = {
      requestId,
      baseRevision: snapshot.revision,
      snapshot: newSnapshot,
    };
    writeFrame(res, { k: 'end', ...response });
    res.end();
  } catch (err) {
    // 流已开始，错误也通过终帧传
    const errorResponse = buildAiErrorResponse(requestId, err);
    writeFrame(res, { k: 'end', ...errorResponse });
    res.end();
  }
}

// ============ 工具：把 AiError 转成错误响应体 ============
function buildAiErrorResponse(requestId: string, err: unknown): ErrorResponse {
  if (err instanceof AiError) {
    const codeMap: Record<string, string> = {
      AI_CONFIG: 'AI_CONFIG_ERROR',
      AI_TIMEOUT: 'AI_TIMEOUT',
      AI_RATE_LIMIT: 'AI_RATE_LIMIT',
      AI_UPSTREAM: 'AI_UPSTREAM_ERROR',
      AI_INVALID_OUTPUT: 'AI_INVALID_OUTPUT',
    };
    const code = codeMap[err.code] || 'AI_GENERATION_FAILED';
    return {
      requestId,
      error: { code, message: `AI error: ${err.code}`, retryable: err.retryable },
    };
  }
  console.error('Unknown AI error:', err);
  return {
    requestId,
    error: { code: 'AI_GENERATION_FAILED', message: 'AI generation failed', retryable: true },
  };
}

// ============ 2. POST /api/events/choose（普通 JSON） ============
export function chooseOption(req: Request, res: Response) {
  const { requestId, snapshot, eventId, optionId } = req.body as ChooseOptionRequest;

  if (!requestId || !snapshot || !eventId || !optionId) {
    return sendError(res, requestId || 'unknown', 'MISSING_PARAMS', 'Missing required params', false);
  }

  const validation = validateSnapshot(snapshot);
  if (!validation.isValid) {
    return sendError(res, requestId, 'INVALID_SNAPSHOT', validation.reason || 'Snapshot validation failed', false);
  }

  if (isGameCompleted(snapshot)) {
    return sendError(res, requestId, 'GAME_COMPLETED', 'Game already ended', false);
  }

  if (!snapshot.currentEvent || snapshot.phase !== 'pendingChoice') {
    return sendError(res, requestId, 'NO_PENDING_EVENT', 'No pending event', false);
  }

  if (snapshot.currentEvent.id !== eventId) {
    return sendError(res, requestId, 'EVENT_MISMATCH', 'Event ID mismatch', false);
  }

  const chosenOption = snapshot.currentEvent.options.find((opt) => opt.id === optionId);
  if (!chosenOption) {
    return sendError(res, requestId, 'INVALID_OPTION', 'Option not found', false);
  }

  const afterAttributes = applyEffects(snapshot.attributes, chosenOption.effects);

  const newHistory = [
    ...snapshot.history,
    {
      day: snapshot.history.length + 1,
      eventId: snapshot.currentEvent.id,
      optionId: chosenOption.id,
      eventTitle: snapshot.currentEvent.title,
      chosenText: chosenOption.text.split('\n')[0],
      resultText: chosenOption.resultText,
      effects: chosenOption.effects,
    },
  ];

  const isEnding = newHistory.length === TOTAL_DAYS;
  const newPhase = isEnding ? 'pendingEnding' : 'showResult';

  let newSnapshot = incrementRevision(snapshot);
  newSnapshot = {
    ...newSnapshot,
    attributes: afterAttributes,
    history: newHistory,
    phase: newPhase,
    currentEvent: snapshot.currentEvent,
  };

  const response: SuccessResponse = {
    requestId,
    baseRevision: snapshot.revision,
    snapshot: newSnapshot,
  };
  sendSuccess(res, response);
}

// ============ 3. POST /api/endings/generate（普通 JSON，暂无流式） ============
export async function generateEnding(req: Request, res: Response) {
  const { requestId, snapshot, profile } = req.body as GenerateEndingRequest;

  if (!requestId || !snapshot) {
    return sendError(res, requestId || 'unknown', 'MISSING_PARAMS', 'Missing required params', false);
  }

  const validation = validateSnapshot(snapshot);
  if (!validation.isValid) {
    return sendError(res, requestId, 'INVALID_SNAPSHOT', validation.reason || 'Snapshot validation failed', false);
  }

  if (!isGameCompleted(snapshot)) {
    return sendError(res, requestId, 'GAME_NOT_COMPLETED', 'Game not completed yet', false);
  }

  if (snapshot.ending && snapshot.phase === 'ended') {
    const response: SuccessResponse = {
      requestId,
      baseRevision: snapshot.revision,
      snapshot: { ...snapshot },
    };
    return sendSuccess(res, response);
  }

  if (snapshot.phase !== 'pendingEnding') {
    return sendError(res, requestId, 'INVALID_PHASE', 'Current phase does not allow ending generation', false);
  }

  if (!aiConfig) {
    return sendError(res, requestId, 'AI_CONFIG_ERROR', 'AI config not loaded, check DEEPSEEK_API_KEY', false);
  }

  const normalizedProfile = normalizeProfile(profile);

  try {
    const grades = getGrades(snapshot.attributes);

    const endingData = await aiGenerateEnding(
      {
        attributes: snapshot.attributes,
        grades,
        history: snapshot.history.map(toDigestItem),
        profile: normalizedProfile,
      },
      aiConfig
    );

    let newSnapshot = incrementRevision(snapshot);
    newSnapshot = {
      ...newSnapshot,
      phase: 'ended',
      ending: {
        finalAttributes: { ...snapshot.attributes },
        grades,
        title: endingData.title,
        description: endingData.description,
        evaluation: endingData.evaluation,
        advice: endingData.advice,
      },
    };

    const response: SuccessResponse = {
      requestId,
      baseRevision: snapshot.revision,
      snapshot: newSnapshot,
    };
    sendSuccess(res, response);
  } catch (err) {
    return handleAiError(res, requestId, err);
  }
}