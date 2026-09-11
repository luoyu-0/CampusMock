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

// 快照历史记录的结构最小集（与 main 版 server 的 HistoryRecord 同形，字段为 chosenText）；
// 定义在此使 ai 模块保持无反向依赖，路由层可直接传入自己的 HistoryRecord[]
export interface HistoryRecordLike {
  day: number;
  eventTitle: string;
  chosenText: string;
  resultText: string;
  effects: Effects;
}

// 路由层适配：快照 HistoryRecord[] → 生成输入 HistoryDigestItem[]（chosenText → chosenOptionText，其余字段同名）
export function historyFromRecords(records: HistoryRecordLike[]): HistoryDigestItem[] {
  return records.map(({ day, eventTitle, chosenText, resultText, effects }) => ({
    day,
    eventTitle,
    chosenOptionText: chosenText,
    resultText,
    effects,
  }));
}

// 玩家档案：玩家固定信息，由路由层收集（或用默认值）传入，不由模型生成；生成输入中可选，未传时提示词用中性表述
export interface PlayerProfile {
  gender: string;
  major: string;
}

// generateEvent 的输入：由路由层从完整快照提取并校验后传入
export interface EventGenInput {
  day: number;
  attributes: Attributes;
  history: HistoryDigestItem[];
  profile?: PlayerProfile;
}

export type Grade = "A" | "B" | "C" | "D";

export type Grades = Record<AttributeKey, Grade>;

// generateEnding 的输入：最终值与档位由路由层按规则阈值计算后传入
export interface EndingGenInput {
  attributes: Attributes;
  grades: Grades;
  history: HistoryDigestItem[];
  profile?: PlayerProfile;
}

// 结局文本四字段；finalAttributes 与 grades 由应用结算保存，不由模型生成
export interface Ending {
  title: string;
  description: string;
  evaluation: string;
  advice: string;
}
