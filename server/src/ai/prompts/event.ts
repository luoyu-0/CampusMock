import { type AttributeKey, type Attributes, type EventGenInput } from "../schema.js";
import { formatHistory } from "./common.js";
import { EFFECT_RANGES, OPTION_COUNT, TEXT_LIMITS } from "./values.js";

function formatRange(min: number, max: number): string {
  return `${min}～${max >= 0 ? "+" : ""}${max}`;
}

const RANGE_TEXT = (Object.keys(EFFECT_RANGES) as AttributeKey[])
  .map((key) => `${key} ${formatRange(EFFECT_RANGES[key].min, EFFECT_RANGES[key].max)}`)
  .join("，");

// 提示词草案 v0.1：先固化结构与硬约束，措辞与多样性策略在后续迭代完善
const SYSTEM_PROMPT = `你是文字游戏《你好，我的大学》的事件生成器。游戏模拟一名大学新生入学两周（共 14 天）的校园生活，主题是"期待与焦虑"：玩家带着期待入学，也会遇到焦虑与纠结。玩家每天经历 1 个事件并做出 1 次选择，学业、社交、精力、金钱四项属性随之变化。

你的任务：根据用户给出的天数、当前属性与过往经历，生成 1 个事件。要求：

1. 情境真实：取材大学新生常见场景，例如军训、社团招新、选课、宿舍相处、班级破冰、与导员交流、未来规划、兼职、生活费、想家等，体现新生的期待或焦虑。
2. 多样性：结合当前属性状态决定情境方向。例如精力偏低时倾向出现疲惫、需要休整的情境；金钱紧张时倾向出现收支压力。不要重复过往事件的情境。
3. 承接历史：过往经历中出现的人、事、约定，后续事件应自然延续其影响，而不是当作没有发生过。
4. 选项设计：恰好 ${OPTION_COUNT} 个选项，代表明显不同的行动取舍；每个选项的 effects 必须与文案含义一致（例如需要花钱的选项 money 必须为负数）。
5. resultText：以第二人称「你」简述选择后立刻发生的结果，与 effects 一致。
6. 文风：用场景与细节叙事，所有文本中不得出现四维数值或属性名（如「精力仅有 1」「金钱 250」），人物状态改用具体感受表达（如「累得眼皮直打架」「钱包快见底了」）；不用「你选择了……结果：……」的模板句式，也不向玩家提问。

只输出一个 JSON 对象，不要输出任何解释或多余文字，结构如下：
{"title":"事件标题","description":"事件详情","options":[{"text":"选项描述","effects":{"academics":0,"social":0,"energy":0,"money":0},"resultText":"选择后的结果叙述"}]}

硬性约束：
- title 不超过 ${TEXT_LIMITS.title} 字；description 不超过 ${TEXT_LIMITS.description} 字；每个 text 不超过 ${TEXT_LIMITS.optionText} 字；每个 resultText 不超过 ${TEXT_LIMITS.resultText} 字。
- effects 四个属性都必须给出整数，未受影响的属性填 0。
- 取值范围：${RANGE_TEXT}，越界视为无效输出。
- 不要输出 id 字段，选项编号由应用分配。`;

export function buildEventPrompt(input: EventGenInput): { system: string; user: string } {
  return { system: SYSTEM_PROMPT, user: buildUserPrompt(input) };
}

function buildUserPrompt(input: EventGenInput): string {
  const lines = [
    `当前进度：第 ${input.day} 天（共 14 天）。`,
    `当前属性：学业 ${input.attributes.academics}，社交 ${input.attributes.social}，精力 ${input.attributes.energy}，金钱 ${input.attributes.money}。`,
  ];
  const hints = buildStateHints(input.attributes);
  if (hints) lines.push(hints);
  lines.push("", "过往经历：");
  if (input.history.length === 0) {
    lines.push("（无，这是入学后的第 1 天。）");
  } else {
    lines.push(...formatHistory(input.history));
  }
  lines.push("", `请生成第 ${input.day} 天的事件。`);
  return lines.join("\n");
}

function buildStateHints(attributes: Attributes): string {
  const hints: string[] = [];
  if (attributes.energy <= 2) hints.push("精力偏低，可偏向疲惫、需要休整的情境");
  if (attributes.money < 0) hints.push("金钱已为负，可偏向债务与收支压力的情境");
  else if (attributes.money < 100) hints.push("手头拮据，可偏向精打细算的情境");
  if (hints.length === 0) return "";
  return `情境方向提示（仅为方向示例，不是必触发）：${hints.join("；")}。`;
}
