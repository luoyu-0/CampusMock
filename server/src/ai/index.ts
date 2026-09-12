export { generateEvent, generateEventSafe } from "./generateEvent.js";
export { generateEnding, generateEndingSafe } from "./generateEnding.js";
export { AiError, chatJSON, chatJSONWithRetry, loadAiConfig, type AiConfig, type AiErrorCode } from "./deepseek.js";
export { buildFallbackEvent, FALLBACK_ENDING } from "./fallback.js";
export type { AiResult } from "./fallback.js";
export { historyFromRecords } from "./schema.js";
export type {
  AttributeKey,
  Attributes,
  Effects,
  Ending,
  EndingGenInput,
  EventGenInput,
  EventOption,
  GameEvent,
  Grade,
  Grades,
  HistoryDigestItem,
  HistoryRecordLike,
  PlayerProfile,
} from "./schema.js";
