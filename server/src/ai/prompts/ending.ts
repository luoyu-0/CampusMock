import { ATTRIBUTE_KEYS, type EndingGenInput } from "../schema.js";
import { ATTRIBUTE_LABELS, formatHistory } from "./common.js";
import { ENDING_TEXT_LIMITS } from "./values.js";

// 提示词草案 v0.1.5：v0.1.2 增补沉浸感约束（禁档位字母与数值）；v0.1.3 增补背景设定（军训在两周之后、学期开端无期末）；v0.1.4 增补玩家自主权（只引用实际发生的选择，不预设爱好）；v0.1.5 玩家档案改为可选，未收集时用中性表述（2026-09-10 建议区间改由上限推导、恢复 values.ts 单一来源）
function suggestRange(limit: number): string {
  return `${Math.ceil(limit * 0.65)}～${Math.floor(limit * 0.92)} 字`;
}

const SYSTEM_PROMPT = `你是文字游戏《新生每日印象》的结局生成器。玩家刚结束入学两周（共 14 天）的模拟生活：每天经历 1 个事件并做出 1 次选择，学业、社交、精力、金钱四项属性随之变化。应用已按规则计算出四维最终值，并各自判定 A～D 档位（A 最高，负值必然为 D）。

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
- 背景设定：军训安排在入学两周之后，这两周不参加军训；这两周也是学期开端，不得把军训、期末考试、期末论文等写进这两周的经历。
- 玩家档案：用户消息中给出的性别与专业是玩家固定信息，不得更改，也不得杜撰与之矛盾的其他固定信息（如另一个专业）；具体人物与故事细节可自由虚构。
- 玩家自主权：结局只能引用过往经历中实际发生的选择，不得把玩家没做过的决定（如加入某社团、报名某活动、确立某项爱好）写成这两周内的事实，也不得替玩家设定兴趣偏好。

只输出一个 JSON 对象，不要输出任何解释或多余文字，结构如下：
{"title":"结局标题","description":"结局详情","evaluation":"评价","advice":"建议"}`;

export function buildEndingPrompt(
  input: EndingGenInput,
  feedback?: string | null,
): { system: string; user: string } {
  return { system: SYSTEM_PROMPT, user: buildEndingUserPrompt(input, feedback ?? null) };
}

function buildEndingUserPrompt(input: EndingGenInput, feedback: string | null): string {
  const lines: string[] = ["最终属性与档位："];
  for (const key of ATTRIBUTE_KEYS) {
    lines.push(`- ${ATTRIBUTE_LABELS[key]} ${input.attributes[key]}（${input.grades[key]} 档）`);
  }
  lines.push("", "过往经历：", ...formatHistory(input.history));
  lines.push(
    "",
    input.profile
      ? `玩家档案：性别 ${input.profile.gender}，专业 ${input.profile.major}。`
      : "玩家档案：未收集。请使用中性表述，不要假设玩家的性别与专业，也不要杜撰性别、专业等固定信息。",
    "请为玩家生成两周生活的结局。",
  );
  if (feedback) {
    lines.push(
      "",
      `上一次输出未通过校验：${feedback}`,
      "请修正以上问题，重新输出完整的 JSON 对象，仍须严格遵守 system 中的全部字数与内容约束。",
    );
  }
  return lines.join("\n");
}
