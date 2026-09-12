// ============================================
// 类型定义
// ============================================

export type AttributeKey = 'academics' | 'social' | 'energy' | 'money';
export type Attributes = Record<AttributeKey, number>;
export type Effects = Attributes;
export type Grade = 'A' | 'B' | 'C' | 'D';
export type Phase = 'pendingEvent' | 'pendingChoice' | 'showResult' | 'pendingEnding' | 'ended';

export interface EventOption {
  id: string;
  text: string;
  effects: Effects;
  resultText: string;
}

export interface GameEvent {
  id: string;
  day: number;
  title: string;
  description: string;
  options: EventOption[];
}

export interface HistoryEntry {
  day: number;
  eventId: string;
  optionId: string;
  eventTitle: string;
  chosenText: string;
  resultText: string;
  effects: Effects;
}

export interface Ending {
  finalAttributes: Attributes;
  grades: Record<AttributeKey, Grade>;
  title: string;
  description: string;
  evaluation: string;
  advice: string;
}

export interface Snapshot {
  schemaVersion: number;
  rulesVersion: number;
  gameId: string;
  revision: number;
  phase: Phase;
  attributes: Attributes;
  history: HistoryEntry[];
  currentEvent: GameEvent | null;
  ending: Ending | null;
}

// ---------- 玩家档案（可选，由前端收集后随请求传入） ----------
export interface PlayerProfile {
  gender: string;
  major: string;
}

// ---------- 请求类型 ----------
export interface GenerateEventRequest {
  requestId: string;
  snapshot: Snapshot;
  profile?: PlayerProfile;
}

export interface ChooseOptionRequest {
  requestId: string;
  snapshot: Snapshot;
  eventId: string;
  optionId: string;
}

export interface GenerateEndingRequest {
  requestId: string;
  snapshot: Snapshot;
  profile?: PlayerProfile;
}

// ---------- 响应类型 ----------
export interface SuccessResponse {
  requestId: string;
  baseRevision: number;
  snapshot: Snapshot;
}

export interface ErrorResponse {
  requestId: string;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

// ---------- AI 输入类型（与成员C的 schema 对齐） ----------
export interface HistoryDigestItem {
  day: number;
  eventTitle: string;
  chosenOptionText: string;
  resultText: string;
  effects: Effects;
}