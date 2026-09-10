// ============================================
// 接口控制器
// ============================================

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  Snapshot,
  GenerateEventRequest,
  ChooseOptionRequest,
  GenerateEndingRequest,
  SuccessResponse,
  ErrorResponse,
  GameEvent,
  Attributes,
  Grade,
  Ending,
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

// ============ Mock AI（待成员C替换） ============
async function mockGenerateEvent(day: number, attributes: Attributes, history: any[]): Promise<GameEvent> {
  return {
    id: uuidv4(),
    day,
    title: 'Day ' + day + ': Campus Life',
    description: 'You are walking on campus and face a choice...',
    options: [
      {
        id: 'A',
        text: 'Go to library to study',
        effects: { academics: 2, social: 0, energy: -1, money: 0 },
        resultText: 'You studied hard and gained a lot.',
      },
      {
        id: 'B',
        text: 'Join club activities',
        effects: { academics: 0, social: 2, energy: -1, money: -50 },
        resultText: 'You made many new friends.',
      },
      {
        id: 'C',
        text: 'Go back to dorm to rest',
        effects: { academics: 0, social: 0, energy: 2, money: 0 },
        resultText: 'You rested well and feel energetic.',
      },
    ],
  };
}

async function mockGenerateEnding(attributes: Attributes, grades: Record<keyof Attributes, Grade>, history: any[]): Promise<Omit<Ending, 'finalAttributes' | 'grades'>> {
  return {
    title: 'First Semester Summary',
    description: 'You had a fulfilling college life...',
    evaluation: 'You performed well in all aspects.',
    advice: 'Keep it up and try more new things!',
  };
}

// ============ 工具：错误响应 ============
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

// ============ 工具：成功响应 ============
function sendSuccess(res: Response, data: SuccessResponse) {
  res.json(data);
}

// ============ 1. POST /api/events/generate ============
export async function generateEvent(req: Request, res: Response) {
  const { requestId, snapshot } = req.body as GenerateEventRequest;

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

  const day = getCurrentDay(snapshot);

  try {
    const eventData = await mockGenerateEvent(day, snapshot.attributes, snapshot.history);

    for (const opt of eventData.options) {
      const effectValidation = validateEventEffects(opt.effects);
      if (!effectValidation.isValid) {
        return sendError(res, requestId, 'INVALID_EFFECTS', effectValidation.reason || 'Effect out of range', true);
      }
    }

    let newSnapshot = incrementRevision(snapshot);
    newSnapshot = {
      ...newSnapshot,
      phase: 'pendingChoice',
      currentEvent: eventData,
    };

    const response: SuccessResponse = {
      requestId,
      baseRevision: snapshot.revision,
      snapshot: newSnapshot,
    };
    sendSuccess(res, response);
  } catch (error) {
    console.error('generateEvent error:', error);
    sendError(res, requestId, 'AI_GENERATION_FAILED', 'Event generation failed, please retry', true);
  }
}

// ============ 2. POST /api/events/choose ============
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
      chosenText: chosenOption.text,
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
    currentEvent: null,
  };

  const response: SuccessResponse = {
    requestId,
    baseRevision: snapshot.revision,
    snapshot: newSnapshot,
  };
  sendSuccess(res, response);
}

// ============ 3. POST /api/endings/generate ============
export async function generateEnding(req: Request, res: Response) {
  const { requestId, snapshot } = req.body as GenerateEndingRequest;

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

  try {
    const grades = getGrades(snapshot.attributes);
    const endingData = await mockGenerateEnding(snapshot.attributes, grades, snapshot.history);

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
  } catch (error) {
    console.error('generateEnding error:', error);
    sendError(res, requestId, 'AI_GENERATION_FAILED', 'Ending generation failed, please retry', true);
  }
}