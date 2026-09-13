
// 提示词硬性约束的全部数值集中在此；validate.ts 同步引用，效果范围复用游戏规则常量

// 首版每个事件 3 个选项（游戏规则.md 建议）
export const OPTION_COUNT = 3;

// 文本长度上限为草案值，实测后调整
export const TEXT_LIMITS = {
  title: 30,
  description: 300,
  optionText: 60,
  resultText: 120,
} as const;

// 结局文本长度上限为草案值，实测后调整
export const ENDING_TEXT_LIMITS = {
  title: 30,
  description: 450,
  evaluation: 250,
  advice: 150,
} as const;

// 单次效果范围（游戏规则.md 已确认）；越界拒绝，不截断
export { EFFECT_RANGES } from '../../game/constants.js';
