import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { TOTAL_DAYS } from './constants';
import { applyEffects, getCurrentDay, getGrades, incrementRevision, isGameCompleted, validateEventEffects, validateSnapshot } from './service';
import type { ChooseOptionRequest, ErrorResponse, EventData, GameSnapshot, GenerateEventRequest, SuccessResponse } from './types';

async function mockGenerateEvent(day: number): Promise<EventData> {
  const eventId = randomUUID();
  return {
    id: eventId,
    day,
    title: `第 ${day} 天：校园里的一个选择`,
    description: '你走在校园里，遇到了一件需要自己决定的小事。',
    options: [
      {
        id: `${eventId}-o1`,
        text: '去图书馆认真学习',
        effects: { academics: 2, social: 0, energy: -1, money: 0 },
        resultText: '你安静地学了一阵，也更清楚接下来该做什么。',
      },
      {
        id: `${eventId}-o2`,
        text: '参加一次社团活动',
        effects: { academics: 0, social: 2, energy: -1, money: -50 },
        resultText: '你认识了几张新面孔，回宿舍时已经有些累了。',
      },
      {
        id: `${eventId}-o3`,
        text: '回宿舍休息一会儿',
        effects: { academics: 0, social: 0, energy: 2, money: 0 },
        resultText: '这一觉没有解决所有问题，但醒来以后轻松了一些。',
      },
    ],
  };
}

async function mockGenerateEnding() {
  return {
    title: '你开始找到了自己的大学节奏',
    description: '这两周并不总是顺利，但每一次选择都让你更了解自己。',
    evaluation: '四个档位记录的是这段时间的状态，不代表你的能力或价值。',
    advice: '先照顾好精力，再从一件想尝试的小事开始。大学生活还有足够长的时间。',
  };
}

function sendError(res: Response, requestId: string, code: string, message: string, retryable = true) {
  const response: ErrorResponse = { requestId, error: { code, message, retryable } };
  res.status(400).json(response);
}

function sendSuccess(res: Response, requestId: string, base: GameSnapshot, snapshot: GameSnapshot) {
  const response: SuccessResponse = { requestId, baseRevision: base.revision, snapshot };
  res.json(response);
}

export async function generateEvent(req: Request, res: Response) {
  const { requestId, snapshot } = (req.body ?? {}) as Partial<GenerateEventRequest>;
  if (!requestId) return sendError(res, 'unknown', 'MISSING_REQUEST_ID', '请求缺少 requestId。', false);
  if (!snapshot) return sendError(res, requestId, 'MISSING_SNAPSHOT', '请求缺少游戏快照。', false);

  const validation = validateSnapshot(snapshot);
  if (!validation.isValid) return sendError(res, requestId, 'INVALID_SNAPSHOT', validation.reason ?? '游戏快照不合法。', false);
  if (snapshot.phase === 'pendingChoice' && snapshot.currentEvent) return sendSuccess(res, requestId, snapshot, { ...snapshot });
  if (snapshot.phase !== 'pendingEvent' && snapshot.phase !== 'showResult') {
    return sendError(res, requestId, 'STAGE_MISMATCH', '当前阶段不能生成事件。', false);
  }
  if (isGameCompleted(snapshot)) return sendError(res, requestId, 'GAME_ALREADY_DONE', '两周已经结束。', false);

  try {
    const event = await mockGenerateEvent(getCurrentDay(snapshot));
    const invalidOption = event.options.find((option) => !validateEventEffects(option.effects).isValid);
    if (invalidOption) return sendError(res, requestId, 'EFFECT_OUT_OF_RANGE', '生成事件的属性变化超出规则范围。', true);

    const next = {
      ...incrementRevision(snapshot),
      phase: 'pendingChoice' as const,
      currentEvent: event,
    };
    return sendSuccess(res, requestId, snapshot, next);
  } catch (error) {
    console.error('生成事件失败：', error);
    return sendError(res, requestId, 'AI_GENERATION_FAILED', '事件生成暂时失败，请稍后重试。', true);
  }
}

export async function chooseOption(req: Request, res: Response) {
  const { requestId, snapshot, eventId, optionId } = (req.body ?? {}) as Partial<ChooseOptionRequest>;
  if (!requestId || !snapshot || !eventId || !optionId) {
    return sendError(res, requestId ?? 'unknown', 'MISSING_PARAMS', '请求缺少必要参数。', false);
  }

  const validation = validateSnapshot(snapshot);
  if (!validation.isValid) return sendError(res, requestId, 'INVALID_SNAPSHOT', validation.reason ?? '游戏快照不合法。', false);
  if (snapshot.history.some((record) => record.eventId === eventId)) return sendSuccess(res, requestId, snapshot, snapshot);
  if (snapshot.phase !== 'pendingChoice' || !snapshot.currentEvent) {
    return sendError(res, requestId, 'STAGE_MISMATCH', '当前没有等待选择的事件。', false);
  }
  if (snapshot.currentEvent.id !== eventId) return sendError(res, requestId, 'EVENT_MISMATCH', '事件标识与当前事件不一致。', false);
  const option = snapshot.currentEvent.options.find((item) => item.id === optionId);
  if (!option) return sendError(res, requestId, 'OPTION_NOT_FOUND', '找不到所选选项。', false);

  const attributes = applyEffects(snapshot.attributes, option.effects);
  const history = [
    ...snapshot.history,
    {
      day: snapshot.currentEvent.day,
      eventId: snapshot.currentEvent.id,
      optionId: option.id,
      eventTitle: snapshot.currentEvent.title,
      chosenText: option.text.split('\n')[0],
      resultText: option.resultText,
      effects: option.effects,
    },
  ];
  const next = {
    ...incrementRevision(snapshot),
    attributes,
    history,
    phase: history.length === TOTAL_DAYS ? ('pendingEnding' as const) : ('showResult' as const),
    currentEvent: snapshot.currentEvent,
    ending: null,
  };
  return sendSuccess(res, requestId, snapshot, next);
}

export async function generateEnding(req: Request, res: Response) {
  const { requestId, snapshot } = (req.body ?? {}) as Partial<GenerateEventRequest>;
  if (!requestId || !snapshot) return sendError(res, requestId ?? 'unknown', 'MISSING_PARAMS', '请求缺少必要参数。', false);

  const validation = validateSnapshot(snapshot);
  if (!validation.isValid) return sendError(res, requestId, 'INVALID_SNAPSHOT', validation.reason ?? '游戏快照不合法。', false);
  if (snapshot.phase === 'ended' && snapshot.ending) return sendSuccess(res, requestId, snapshot, { ...snapshot });
  if (!isGameCompleted(snapshot)) return sendError(res, requestId, 'GAME_NOT_FINISHED', '还没有完成两周生活。', false);
  if (snapshot.phase !== 'pendingEnding') return sendError(res, requestId, 'STAGE_MISMATCH', '当前阶段不能生成结局。', false);

  try {
    const ending = await mockGenerateEnding();
    const next = {
      ...incrementRevision(snapshot),
      phase: 'ended' as const,
      currentEvent: null,
      ending: {
        finalAttributes: { ...snapshot.attributes },
        grades: getGrades(snapshot.attributes),
        ...ending,
      },
    };
    return sendSuccess(res, requestId, snapshot, next);
  } catch (error) {
    console.error('生成结局失败：', error);
    return sendError(res, requestId, 'AI_GENERATION_FAILED', '结局生成暂时失败，请稍后重试。', true);
  }
}
