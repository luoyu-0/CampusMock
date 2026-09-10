// ============================================
// 配置常量
// ============================================

import { Attributes, Grade } from './types';

// ---------- 初始值 ----------
export const INITIAL_ATTRIBUTES: Attributes = {
  academics: 0,
  social: 0,
  energy: 7,
  money: 1000,
};

export const TOTAL_DAYS = 14;

export const SCHEMA_VERSION = '1.0';
export const RULES_VERSION = '1.0';

// ---------- 分档阈值 ----------
export const GRADE_THRESHOLDS: Record<keyof Attributes, { A: number; B: number; C: number; D: number }> = {
  academics: { A: 12, B: 6, C: 0, D: -Infinity },
  social: { A: 12, B: 6, C: 0, D: -Infinity },
  energy: { A: 7, B: 3, C: 0, D: -Infinity },
  money: { A: 800, B: 400, C: 0, D: -Infinity },
};

export function getGrade(
  value: number,
  thresholds: { A: number; B: number; C: number; D: number }
): Grade {
  if (value >= thresholds.A) return 'A';
  if (value >= thresholds.B) return 'B';
  if (value >= thresholds.C) return 'C';
  return 'D';
}

// ---------- 单次增减范围 ----------
export const EFFECT_RANGES: Record<keyof Attributes, { min: number; max: number }> = {
  academics: { min: -2, max: 3 },
  social: { min: -2, max: 3 },
  energy: { min: -2, max: 2 },
  money: { min: -300, max: 300 },
};

// ---------- 默认事件选项数量 ----------
export const DEFAULT_OPTION_COUNT = 3;