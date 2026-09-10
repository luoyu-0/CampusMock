// ============================================
// 配置常量（从 游戏规则.md 提取）
// ============================================

import { Attributes } from './types';

// ---------- 初始值 ----------
export const INITIAL_ATTRIBUTES: Attributes = {
  academics: 0,
  social: 0,
  energy: 7,
  money: 1000,
};

export const TOTAL_DAYS = 14;

export const SCHEMA_VERSION = 1;
export const RULES_VERSION = 1;

// ---------- 分档阈值 ----------
export const GRADE_THRESHOLDS = {
  academics: { A: 12, B: 6, C: 0, D: -Infinity },
  social: { A: 12, B: 6, C: 0, D: -Infinity },
  energy: { A: 7, B: 3, C: 0, D: -Infinity },
  money: { A: 800, B: 400, C: 0, D: -Infinity },
};

export type Grade = 'A' | 'B' | 'C' | 'D';

export function getGrade(value: number, thresholds: { A: number; B: number; C: number; D: number }): Grade {
  if (value >= thresholds.A) return 'A';
  if (value >= thresholds.B) return 'B';
  if (value >= thresholds.C) return 'C';
  return 'D';
}

// ---------- 单次增减范围 ----------
export const EFFECT_RANGES = {
  academics: { min: -2, max: 3 },
  social: { min: -2, max: 3 },
  energy: { min: -2, max: 2 },
  money: { min: -300, max: 300 },
};

// ---------- 默认事件选项数量 ----------
export const DEFAULT_OPTION_COUNT = 3;
