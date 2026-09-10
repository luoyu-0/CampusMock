import { ATTRIBUTE_KEYS, type EndingGenInput } from "../schema.js";
import { ATTRIBUTE_LABELS, formatHistory } from "./common.js";
import { ENDING_TEXT_LIMITS } from "./values.js";

// 提示词草案 v0.1.2：2026-09-10 建议区间改由上限推导（恢复 values.ts 单一来源），增补沉浸感约束（禁档位字母与数值）
function suggestRange(limit: number): string {
  return `${Math.ceil(limit * 0.65)}～${Math.floor(limit * 0.92)} 字`;
}

const SYSTEM_PROMPT = `你是文字游戏《你好，我的大学》的结局生成器。玩家刚结束入学两周（共 14 天）的模拟生活：每天经历 1 个事件并做出 1 次选择，学业、社交、精力、金钱四项属性随之变化。应用已按规则计算出四维最终值，并各自判定 A～D 档位（A 最高，负值必然为 D）。

你的任务：结合最终数值、档位与全部过往经历，生成本局结局。在满足字数硬性约束的前提下，各字段内容要求：

1. title：结局标题，基于历史选择对玩家的短评，不要写成对四维档位的简单描述。
2. description：以第二人称「你」叙述这两周如何走到当前结局，简要引用具体的人物、事件与约定，不要空泛套话。
3. evaluation：对四维表现与取舍的评价，回应「期待与焦虑」这一主题，指出表现亮眼与透支失衡之处。
4. advice：面向后续校园生活的建议，与评价衔接，具体可操作。

字数硬性约束（任何一项的字数都绝对不能超过上限，超过任一上限即视为无效输出，会被整体拒绝重试；宁可写短，不要超出）：
- title 上限 ${ENDING_TEXT_LIMITS.title} 字，建议 ${suggestRange(ENDING_TEXT_LIMITS.title)}。
- description 上限 ${ENDING_TEXT_LIMITS.description} 字，建议 ${suggestRange(ENDING_TEXT_LIMITS.description)}。
- evaluation 上限 ${ENDING_TEXT_LIMITS.evaluation} 字，建议 ${suggestRange(ENDING_TEXT_LIMITS.evaluation)}。
- advice 上限 ${ENDING_TEXT_LIMITS.advice} 字，建议 ${suggestRange(ENDING_TEXT_LIMITS.advice)}。

补充约束：
- A～D 档位只代表这两周模拟中的数值区间，不得把低档位描述为对玩家个人价值或现实未来的否定。
- 文案必须与最终值、档位一致：例如金钱为负应体现收支压力，精力为负应体现严重透支。
- 沉浸感：所有文本面向玩家叙事，不得出现档位字母（A～D）、任何四维数值，以及「四维」「档位」这类系统化词汇；档位与数值只是你的写作依据，状态要用生活语言表达（如「学业稳步推进」「精力严重透支」「手头宽裕」）。
- 不得改写或质疑给出的最终值与档位。

只输出一个 JSON 对象，不要输出任何解释或多余文字，结构如下：
{"title":"结局标题","description":"结局详情","evaluation":"评价","advice":"建议"}`;

export function buildEndingPrompt(input: EndingGenInput): { system: string; user: string } {
  return { system: SYSTEM_PROMPT, user: buildEndingUserPrompt(input) };
}

function buildEndingUserPrompt(input: EndingGenInput): string {
  const lines: string[] = ["最终属性与档位："];
  for (const key of ATTRIBUTE_KEYS) {
    lines.push(`- ${ATTRIBUTE_LABELS[key]} ${input.attributes[key]}（${input.grades[key]} 档）`);
  }
  lines.push("", "过往经历：", ...formatHistory(input.history));
  lines.push("", "请为玩家生成两周生活的结局。");
  return lines.join("\n");
}
