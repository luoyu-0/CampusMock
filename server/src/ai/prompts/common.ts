import { type AttributeKey, type Attributes, type HistoryDigestItem } from "../schema.js";

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  academics: "学业",
  social: "社交",
  energy: "精力",
  money: "金钱",
};

export function formatEffects(effects: Attributes): string {
  const keys = Object.keys(ATTRIBUTE_LABELS) as AttributeKey[];
  const parts = keys
    .filter((key) => effects[key] !== 0)
    .map((key) => `${ATTRIBUTE_LABELS[key]}${effects[key] > 0 ? "+" : ""}${effects[key]}`);
  return parts.length > 0 ? `（${parts.join("，")}）` : "";
}

export function formatHistory(history: HistoryDigestItem[]): string[] {
  return history.map(
    (item) =>
      `- 第 ${item.day} 天《${item.eventTitle}》：用户选择了「${item.chosenOptionText}」→ ${item.resultText}${formatEffects(item.effects)}`,
  );
}
