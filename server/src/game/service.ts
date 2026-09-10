// ============================================
// 核心游戏逻辑
// ============================================

import { v4 as uuidv4 } from 'uuid';
import {
  Snapshot,
  Attributes,
  Effects,
  HistoryEntry,
  GameEvent,
  GameOption,
  Ending,
  Grade,
  Phase,
} from './types';
import {
  INITIAL_ATTRIBUTES,
  TOTAL_DAYS,
  SCHEMA_VERSION,
  RULES_VERSION,
  GRADE_THRESHOLDS,
  getGrade,
  EFFECT_RANGES,
} from './constants';

// ---------- 创建新游戏快照 ----------
export function createInitialSnapshot(): Snapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    gameId: uuidv4(),
    revision: 0,
    phase: 'pendingEvent',
    attributes: { ...INITIAL_ATTRIBUTES },
    history: [],
    currentEvent: null,
    ending: null,
  };
}

// ---------- 应用属性变化 ----------
export function applyEffects(current: Attributes, effects: Effects): Attributes {
  return {
    academics: current.academics + effects.academics,
    social: current.social + effects.social,
    energy: current.energy + effects.energy,
    money: current.money + effects.money,
  };
}

// ---------- 判断游戏是否完成 ----------
export function isGameCompleted(snapshot: Snapshot): boolean {
  return snapshot.history.length === TOTAL_DAYS;
}

// ---------- 获取当前天数 ----------
export function getCurrentDay(snapshot: Snapshot): number {
  return snapshot.history.length + 1;
}

// ---------- 获取四维分档 ----------
export function getGrades(attributes: Attributes): Record<keyof Attributes, Grade> {
  return {
    academics: getGrade(attributes.academics, GRADE_THRESHOLDS.academics),
    social: getGrade(attributes.social, GRADE_THRESHOLDS.social),
    energy: getGrade(attributes.energy, GRADE_THRESHOLDS.energy),
    money: getGrade(attributes.money, GRADE_THRESHOLDS.money),
  };
}

// ---------- 校验快照 ----------
export function validateSnapshot(snapshot: Snapshot): { isValid: boolean; reason?: string } {
  // 1. 版本检查
  if (snapshot.schemaVersion !== SCHEMA_VERSION) {
    return { isValid: false, reason: 'unsupported schemaVersion: ' + snapshot.schemaVersion };
  }

  // 2. 必填字段
  if (!snapshot.gameId || typeof snapshot.gameId !== 'string') {
    return { isValid: false, reason: 'invalid gameId' };
  }
  if (typeof snapshot.revision !== 'number' || snapshot.revision < 0) {
    return { isValid: false, reason: 'invalid revision' };
  }
  const validPhases: Phase[] = ['pendingEvent', 'pendingChoice', 'showResult', 'pendingEnding', 'ended'];
  if (!validPhases.includes(snapshot.phase)) {
    return { isValid: false, reason: 'invalid phase' };
  }

  // 3. 属性类型检查
  const a = snapshot.attributes;
  if (typeof a.academics !== 'number' || typeof a.social !== 'number' ||
      typeof a.energy !== 'number' || typeof a.money !== 'number') {
    return { isValid: false, reason: 'attributes must be numbers' };
  }

  // 4. 根据历史记录重算属性
  let recomputed: Attributes = { ...INITIAL_ATTRIBUTES };
  for (const record of snapshot.history) {
    recomputed = applyEffects(recomputed, record.effects);
  }

  if (recomputed.academics !== a.academics ||
      recomputed.social !== a.social ||
      recomputed.energy !== a.energy ||
      recomputed.money !== a.money) {
    return { isValid: false, reason: 'attribute mismatch with history recalculation' };
  }

  // 5. 历史记录天数连续性
  for (let i = 0; i < snapshot.history.length; i++) {
    if (snapshot.history[i].day !== i + 1) {
      return { isValid: false, reason: 'history day sequence broken at index ' + i };
    }
  }

  return { isValid: true };
}

// ---------- 递增修订号 ----------
export function incrementRevision(snapshot: Snapshot): Snapshot {
  return {
    ...snapshot,
    revision: snapshot.revision + 1,
  };
}

// ---------- 校验事件选项效果是否在合法范围 ----------
export function validateEventEffects(effects: Effects): { isValid: boolean; reason?: string } {
  const ranges = EFFECT_RANGES;
  if (effects.academics < ranges.academics.min || effects.academics > ranges.academics.max) {
    return { isValid: false, reason: 'academics effect out of range: ' + effects.academics };
  }
  if (effects.social < ranges.social.min || effects.social > ranges.social.max) {
    return { isValid: false, reason: 'social effect out of range: ' + effects.social };
  }
  if (effects.energy < ranges.energy.min || effects.energy > ranges.energy.max) {
    return { isValid: false, reason: 'energy effect out of range: ' + effects.energy };
  }
  if (effects.money < ranges.money.min || effects.money > ranges.money.max) {
    return { isValid: false, reason: 'money effect out of range: ' + effects.money };
  }
  return { isValid: true };
}