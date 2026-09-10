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

export interface EventData {
  id: string;
  day: number;
  title: string;
  description: string;
  options: EventOption[];
}

export interface HistoryRecord {
  day: number;
  eventId: string;
  optionId: string;
  eventTitle: string;
  chosenText: string;
  resultText: string;
  effects: Effects;
}

export interface EndingResult {
  finalAttributes: Attributes;
  grades: Record<AttributeKey, Grade>;
  title: string;
  description: string;
  evaluation: string;
  advice: string;
}

export interface GameSnapshot {
  schemaVersion: number;
  rulesVersion: number;
  gameId: string;
  revision: number;
  phase: Phase;
  attributes: Attributes;
  history: HistoryRecord[];
  currentEvent: EventData | null;
  ending: EndingResult | null;
}

export interface GenerateEventRequest {
  requestId: string;
  snapshot: GameSnapshot;
}

export interface ChooseOptionRequest extends GenerateEventRequest {
  eventId: string;
  optionId: string;
}

export interface SuccessResponse {
  requestId: string;
  baseRevision: number;
  snapshot: GameSnapshot;
}

export interface ErrorResponse {
  requestId: string;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
