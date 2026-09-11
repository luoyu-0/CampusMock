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

export interface GenerateEventRequest {
  requestId: string;
  snapshot: Snapshot;
}

export interface ChooseOptionRequest extends GenerateEventRequest {
  eventId: string;
  optionId: string;
}

export interface GenerateEndingRequest {
  requestId: string;
  snapshot: Snapshot;
}

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

export interface HistoryDigestItem {
  day: number;
  eventTitle: string;
  chosenOptionText: string;
  resultText: string;
  effects: Effects;
}