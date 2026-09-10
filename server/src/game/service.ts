import { randomUUID } from 'node:crypto';
import {
  EFFECT_RANGES,
  GRADE_THRESHOLDS,
  INITIAL_ATTRIBUTES,
  RULES_VERSION,
  SCHEMA_VERSION,
  TOTAL_DAYS,
  getGrade,
} from './constants';
import type {
  AttributeKey,
  Attributes,
  Effects,
  GameEvent,
  Snapshot,
  Grade,
  HistoryEntry,
  Phase,
} from './types';

const ATTRIBUTE_KEYS: AttributeKey[] = ['academics', 'social', 'energy', 'money'];
const PHASES: Phase[] = ['pendingEvent', 'pendingChoice', 'showResult', 'pendingEnding', 'ended'];
const GRADES: Grade[] = ['A', 'B', 'C', 'D'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isAttributes(value: unknown): value is Attributes {
  return isRecord(value) && ATTRIBUTE_KEYS.every((key) => Number.isSafeInteger(value[key]));
}

function sameAttributes(left: Attributes, right: Attributes): boolean {
  return ATTRIBUTE_KEYS.every((key) => left[key] === right[key]);
}

function isEffects(value: unknown): value is Effects {
  if (!isAttributes(value)) return false;
  return ATTRIBUTE_KEYS.every((key) => {
    const range = EFFECT_RANGES[key];
    return value[key] >= range.min && value[key] <= range.max;
  });
}

function isEvent(value: unknown): value is GameEvent {
  if (!isRecord(value) || !isText(value.id) || !Number.isInteger(value.day)) return false;
  if (!isText(value.title) || !isText(value.description) || !Array.isArray(value.options) || value.options.length < 2) return false;
  const ids = new Set<string>();
  return value.options.every((option) => {
    if (!isRecord(option) || !isText(option.id) || ids.has(option.id)) return false;
    ids.add(option.id);
    return isText(option.text) && isText(option.resultText) && isEffects(option.effects);
  });
}

function isHistoryEntry(value: unknown, day: number): value is HistoryEntry {
  return (
    isRecord(value) &&
    value.day === day &&
    isText(value.eventId) &&
    isText(value.optionId) &&
    isText(value.eventTitle) &&
    isText(value.chosenText) &&
    isText(value.resultText) &&
    isEffects(value.effects)
  );
}

function eventMatchesRecord(event: GameEvent, record: HistoryEntry): boolean {
  const selected = event.options.find((option) => option.id === record.optionId);
  return (
    event.id === record.eventId &&
    event.day === record.day &&
    selected !== undefined &&
    selected.resultText === record.resultText &&
    sameAttributes(selected.effects, record.effects)
  );
}

function isEnding(value: unknown, attributes: Attributes): boolean {
  if (!isRecord(value) || !isAttributes(value.finalAttributes) || !isRecord(value.grades)) return false;
  if (!sameAttributes(value.finalAttributes, attributes)) return false;
  const grades = value.grades;
  return (
    ATTRIBUTE_KEYS.every((key) => GRADES.includes(grades[key] as Grade)) &&
    isText(value.title) &&
    isText(value.description) &&
    isText(value.evaluation) &&
    isText(value.advice)
  );
}

export function createInitialSnapshot(): Snapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    gameId: randomUUID(),
    revision: 0,
    phase: 'pendingEvent',
    attributes: { ...INITIAL_ATTRIBUTES },
    history: [],
    currentEvent: null,
    ending: null,
  };
}

export function applyEffects(current: Attributes, effects: Effects): Attributes {
  return {
    academics: current.academics + effects.academics,
    social: current.social + effects.social,
    energy: current.energy + effects.energy,
    money: current.money + effects.money,
  };
}

export function isGameCompleted(snapshot: Snapshot): boolean {
  return snapshot.history.length === TOTAL_DAYS;
}

export function getCurrentDay(snapshot: Snapshot): number {
  return snapshot.history.length + 1;
}

export function getGrades(attributes: Attributes): Record<AttributeKey, Grade> {
  return {
    academics: getGrade(attributes.academics, GRADE_THRESHOLDS.academics),
    social: getGrade(attributes.social, GRADE_THRESHOLDS.social),
    energy: getGrade(attributes.energy, GRADE_THRESHOLDS.energy),
    money: getGrade(attributes.money, GRADE_THRESHOLDS.money),
  };
}

export function validateSnapshot(value: unknown): { isValid: boolean; reason?: string } {
  if (!isRecord(value)) return { isValid: false, reason: '快照必须是对象' };
  if (value.schemaVersion !== SCHEMA_VERSION || value.rulesVersion !== RULES_VERSION) {
    return { isValid: false, reason: '存档或规则版本不支持' };
  }
  if (!isText(value.gameId) || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0) {
    return { isValid: false, reason: '游戏标识或修订号不合法' };
  }
  if (!PHASES.includes(value.phase as Phase) || !isAttributes(value.attributes) || !Array.isArray(value.history)) {
    return { isValid: false, reason: '阶段、属性或历史结构不合法' };
  }
  if (value.history.length > TOTAL_DAYS) return { isValid: false, reason: '历史记录超过 14 天' };

  const history = value.history;
  const eventIds = new Set<string>();
  if (!history.every((record, index) => {
    if (!isHistoryEntry(record, index + 1) || eventIds.has(record.eventId)) return false;
    eventIds.add(record.eventId);
    return true;
  })) {
    return { isValid: false, reason: '历史记录不连续或事件重复' };
  }

  const recomputed = history.reduce<Attributes>((attributes, record) => applyEffects(attributes, record.effects), {
    ...INITIAL_ATTRIBUTES,
  });
  if (!sameAttributes(recomputed, value.attributes)) return { isValid: false, reason: '属性与历史结算不一致' };
  if (value.currentEvent !== null && !isEvent(value.currentEvent)) return { isValid: false, reason: '当前事件结构不合法' };
  if (value.ending !== null && !isEnding(value.ending, value.attributes)) return { isValid: false, reason: '结局结构不合法' };

  const snapshot = value as unknown as Snapshot;
  const completed = snapshot.history.length;
  const latest = snapshot.history[snapshot.history.length - 1];
  if (snapshot.phase === 'pendingEvent' && !(completed < TOTAL_DAYS && snapshot.currentEvent === null && snapshot.ending === null)) {
    return { isValid: false, reason: '待生成事件阶段与快照内容不一致' };
  }
  if (
    snapshot.phase === 'pendingChoice' &&
    !(
      completed < TOTAL_DAYS &&
      snapshot.currentEvent !== null &&
      snapshot.currentEvent.day === completed + 1 &&
      snapshot.ending === null &&
      !snapshot.history.some((record) => record.eventId === snapshot.currentEvent?.id)
    )
  ) {
    return { isValid: false, reason: '待选择阶段与快照内容不一致' };
  }
  if (
    snapshot.phase === 'showResult' &&
    !(completed > 0 && completed < TOTAL_DAYS && snapshot.currentEvent !== null && latest && eventMatchesRecord(snapshot.currentEvent, latest))
  ) {
    return { isValid: false, reason: '结果阶段与最新历史不一致' };
  }
  if (
    snapshot.phase === 'pendingEnding' &&
    !(
      completed === TOTAL_DAYS &&
      snapshot.ending === null &&
      (snapshot.currentEvent === null || (latest && eventMatchesRecord(snapshot.currentEvent, latest)))
    )
  ) {
    return { isValid: false, reason: '待生成结局阶段与快照内容不一致' };
  }
  if (
    snapshot.phase === 'ended' &&
    !(completed === TOTAL_DAYS && snapshot.currentEvent === null && isEnding(snapshot.ending, snapshot.attributes))
  ) {
    return { isValid: false, reason: '已结束阶段与结局内容不一致' };
  }
  return { isValid: true };
}

export function incrementRevision(snapshot: Snapshot): Snapshot {
  return { ...snapshot, revision: snapshot.revision + 1 };
}

export function validateEventEffects(effects: Effects): { isValid: boolean; reason?: string } {
  return isEffects(effects) ? { isValid: true } : { isValid: false, reason: '选项属性变化不是范围内整数' };
}
