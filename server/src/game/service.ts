// ============================================
// Core Game Logic
// ============================================

import { v4 as uuidv4 } from 'uuid';
import {
  GameSnapshot,
  Attributes,
  HistoryRecord,
  EventData,
  EventOption,
  EndingResult,
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

// ---------- Create initial game snapshot ----------
export function createInitialSnapshot(): GameSnapshot {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    gameId: uuidv4(),
    revision: 0,
    phase: 'idle',
    attributes: { ...INITIAL_ATTRIBUTES },
    history: [],
    currentEvent: null,
    ending: null,
  };
}

// ---------- Apply effects to attributes ----------
export function applyEffects(current: Attributes, effects: Attributes): Attributes {
  return {
    academics: current.academics + effects.academics,
    social: current.social + effects.social,
    energy: current.energy + effects.energy,
    money: current.money + effects.money,
  };
}

// ---------- Check if game is completed ----------
export function isGameCompleted(snapshot: GameSnapshot): boolean {
  return snapshot.history.length === TOTAL_DAYS;
}

// ---------- Get current day ----------
export function getCurrentDay(snapshot: GameSnapshot): number {
  return snapshot.history.length + 1;
}

// ---------- Get grades for all attributes ----------
export function getGrades(attributes: Attributes) {
  return {
    academics: getGrade(attributes.academics, GRADE_THRESHOLDS.academics),
    social: getGrade(attributes.social, GRADE_THRESHOLDS.social),
    energy: getGrade(attributes.energy, GRADE_THRESHOLDS.energy),
    money: getGrade(attributes.money, GRADE_THRESHOLDS.money),
  };
}

// ---------- Validate snapshot ----------
export function validateSnapshot(snapshot: GameSnapshot): { isValid: boolean; reason?: string } {
  // 1. Version check
  if (snapshot.schemaVersion !== SCHEMA_VERSION) {
    return { isValid: false, reason: 'unsupported schemaVersion: ' + snapshot.schemaVersion };
  }

  // 2. Required fields
  if (!snapshot.gameId || typeof snapshot.gameId !== 'string') {
    return { isValid: false, reason: 'invalid gameId' };
  }
  if (typeof snapshot.revision !== 'number' || snapshot.revision < 0) {
    return { isValid: false, reason: 'invalid revision' };
  }
  const validPhases = ['idle', 'generating', 'awaitingChoice', 'showingResult', 'awaitingEnding', 'ended'];
  if (!validPhases.includes(snapshot.phase)) {
    return { isValid: false, reason: 'invalid phase' };
  }

  // 3. Attribute type check
  const a = snapshot.attributes;
  if (typeof a.academics !== 'number' || typeof a.social !== 'number' ||
      typeof a.energy !== 'number' || typeof a.money !== 'number') {
    return { isValid: false, reason: 'attributes must be numbers' };
  }

  // 4. Recalculate attributes from history
  let recomputed = { ...INITIAL_ATTRIBUTES };
  for (const record of snapshot.history) {
    recomputed = applyEffects(recomputed, record.effects);
  }

  if (recomputed.academics !== a.academics ||
      recomputed.social !== a.social ||
      recomputed.energy !== a.energy ||
      recomputed.money !== a.money) {
    return { isValid: false, reason: 'attribute mismatch with history recalculation' };
  }

  // 5. History day continuity
  for (let i = 0; i < snapshot.history.length; i++) {
    if (snapshot.history[i].day !== i + 1) {
      return { isValid: false, reason: 'history day sequence broken at index ' + i };
    }
  }

  return { isValid: true };
}

// ---------- Increment revision ----------
export function incrementRevision(snapshot: GameSnapshot): GameSnapshot {
  return {
    ...snapshot,
    revision: snapshot.revision + 1,
  };
}

// ---------- Validate event effects ----------
export function validateEventEffects(effects: Attributes): { isValid: boolean; reason?: string } {
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
