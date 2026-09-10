// ============================================
// 基于 接口约定.md 的类型定义
// ============================================

// ---------- 快照结构 ----------
export interface GameSnapshot {
  schemaVersion: string;      // 存档结构版本
  rulesVersion: string;       // 本局使用的规则版本
  gameId: string;             // 本局唯一标识
  revision: number;           // 状态修订号，每次成功转换递增
  phase: 'idle' | 'generating' | 'awaitingChoice' | 'showingResult' | 'awaitingEnding' | 'ended';
  attributes: Attributes;
  history: HistoryRecord[];
  currentEvent: EventData | null;
  ending: EndingResult | null;
}

// ---------- 属性 ----------
export interface Attributes {
  academics: number;
  social: number;
  energy: number;
  money: number;
}

// ---------- 历史记录 ----------
export interface HistoryRecord {
  day: number;
  eventId: string;
  eventTitle: string;
  chosenOptionId: string;
  chosenOptionText: string;
  effects: Attributes;
  resultText: string;
  accumulated: Attributes;
  timestamp: string;
}

// ---------- 事件 ----------
export interface EventData {
  id: string;                 // 事件唯一标识
  day: number;                // 所属天数
  title: string;
  description: string;
  options: EventOption[];
}

export interface EventOption {
  id: string;                 // 本事件内唯一标识
  text: string;
  effects: Attributes;        // 完整属性增减，未影响项为 0
  resultText: string;
}

// ---------- 结局 ----------
export interface EndingResult {
  finalAttributes: Attributes;
  grades: {
    academics: 'A' | 'B' | 'C' | 'D';
    social: 'A' | 'B' | 'C' | 'D';
    energy: 'A' | 'B' | 'C' | 'D';
    money: 'A' | 'B' | 'C' | 'D';
  };
  title: string;
  description: string;
  evaluation: string;
  advice: string;
}

// ---------- API 请求/响应 ----------
export interface GenerateEventRequest {
  requestId: string;
  snapshot: GameSnapshot;
}

export interface GenerateEventResponse {
  requestId: string;
  baseRevision: number;
  snapshot: GameSnapshot;
}

export interface ChooseOptionRequest {
  requestId: string;
  snapshot: GameSnapshot;
  eventId: string;
  optionId: string;
}

export interface ChooseOptionResponse {
  requestId: string;
  baseRevision: number;
  snapshot: GameSnapshot;
}

export interface GenerateEndingRequest {
  requestId: string;
  snapshot: GameSnapshot;
}

export interface GenerateEndingResponse {
  requestId: string;
  baseRevision: number;
  snapshot: GameSnapshot;
}

// ---------- 错误响应 ----------
export interface ErrorResponse {
  requestId: string;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
