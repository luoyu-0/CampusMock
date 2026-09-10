export const ATTRIBUTE_KEYS = ["academics", "social", "energy", "money"] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

export type Attributes = Record<AttributeKey, number>;

export type Effects = Attributes;

export interface GameEvent {
  id: string;
  day: number;
  title: string;
  description: string;
  options: EventOption[];
}

export interface EventOption {
  id: string;
  text: string;
  effects: Effects;
  resultText: string;
}

export interface HistoryDigestItem {
  day: number;
  eventTitle: string;
  chosenOptionText: string;
  resultText: string;
  effects: Effects;
}

// generateEvent 的输入：由路由层从完整快照提取并校验后传入
export interface EventGenInput {
  day: number;
  attributes: Attributes;
  history: HistoryDigestItem[];
}

export type Grade = "A" | "B" | "C" | "D";

export type Grades = Record<AttributeKey, Grade>;

// generateEnding 的输入：最终值与档位由路由层按规则阈值计算后传入
export interface EndingGenInput {
  attributes: Attributes;
  grades: Grades;
  history: HistoryDigestItem[];
}

// 结局文本四字段；finalAttributes 与 grades 由应用结算保存，不由模型生成
export interface Ending {
  title: string;
  description: string;
  evaluation: string;
  advice: string;
}
