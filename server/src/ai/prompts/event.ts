import { type AttributeKey, type Attributes, type EventGenInput, type HistoryDigestItem } from "../schema.js";
import { formatHistory } from "./common.js";
import { EFFECT_RANGES, OPTION_COUNT, TEXT_LIMITS } from "./values.js";

function formatRange(min: number, max: number): string {
  return `${min}～${max >= 0 ? "+" : ""}${max}`;
}

const RANGE_TEXT = (Object.keys(EFFECT_RANGES) as AttributeKey[])
  .map((key) => `${key} ${formatRange(EFFECT_RANGES[key].min, EFFECT_RANGES[key].max)}`)
  .join("，");

// 提示词草案 v0.3.4：v0.3 事件定位改为「一天中印象最深的事」+强情感张力、游戏更名《新生每日印象》（迭代 6）；v0.3.1 增补背景设定（军训在两周之后、学期开端无期末）与金钱净额一致性；v0.3.2 增补玩家自主权（不预设爱好偏好、未选的决定不得成为既成事实）；v0.3.3 增补生活广度（张力来源多样化、整局侧面覆盖、NPC 出场轮换、社团成员身份边界、用户消息动态广度提示）；v0.3.4 修正过矫正与时间错乱（盲区提示降载并限前半局、词表去交叠、侧面级上限、历史条目标注距今天数、引用过往须核对间隔）；v0.3.5 玩家档案改为可选，未收集时用中性表述（随实测迭代）
const SYSTEM_PROMPT = `你是文字游戏《新生每日印象》的事件生成器。游戏模拟一名大学新生入学两周（共 14 天）的校园生活，主题是"期待与焦虑"：玩家带着期待入学，也会遇到焦虑与纠结。玩家每天经历 1 个事件并做出 1 次选择，学业、社交、精力、金钱四项属性随之变化。

你的任务：根据用户给出的天数、当前属性与过往经历，生成 1 个事件。要求：

1. 事件定位：每个事件是玩家这一天中「印象最深的一件事」——不必是大事，但必须有强烈的情感张力：或是纠结，或是焦虑，或是狂喜，或是五味杂陈。平淡无波的日常不配成为当天的每日印象。情感张力可以来自自我挣扎、时间取舍、意外状况等多种来源，不必依赖同一段人物关系反复发酵。
2. 时间跨度：事件发生在这一天中一个具体时段的具体场景（如午休时的宿舍、晚自习后的操场、清晨的食堂），description 中要给出时间与场景锚点；不要写成跨越多天的总结，也不要试图覆盖玩家的一整天。
3. 情境真实且多样：玩家是大一新生，你必须取材大学新生生活的各种片段，如宿舍夜谈、食堂偶遇、社团招新、选课与听课、与家人通话、独处想家、来自陌生人的善意或尴尬瞬间等；事件本身必须是当天发生的具体事情。结合当前属性状态决定情境方向（例如精力偏低时倾向出现疲惫、需要休整的情境；金钱紧张时倾向出现收支压力）。玩家的兴趣偏好不由你设定：除非过往选择体现过，不得把某种爱好（如摄影、篮球）写成玩家已有的喜好；社团与活动只作为当天的具体机会出现。同时保持整局的生活广度：事件的情境应覆盖新生生活的不同侧面（如课堂学业、社团活动、宿舍相处、与家人联系、独处心情、校园服务、金钱收支等），避免整局只围绕一两种侧面展开。同一侧面主导的事件整局不超过 4 天。
4. 承接历史（双向）：过往经历中出现的人、事、约定，后续事件应自然延续其影响，而不是当作没有发生过；玩家过往没有做出的决定也不得写成既成事实。加入或退出某个组织/社团、报名某项长期活动、确立某个爱好等有持续影响的取舍，必须作为当天的选项交给玩家决定，不能在描述或背景里替玩家定好；邀请、通知、机会可以由外界送到玩家面前，但接不接永远由选项决定。延续影响不等于持续出场：过往人物可以自然提及或作为背景出现，但同一位 NPC 主导的事件既不连续超过 2 天、整局也不超过三分之一（约 4～5 天），除非玩家过往选择明确持续围绕该人；需要新故事时优先引入新的情境与人物。另外，以成员身份持续参与某个组织（如代表社团出场、参加内部例会）视同加入，必须先经选项交给玩家决定；参加一次对外开放的活动不算加入。引用过往事件时须核对它与当前天的间隔，用与历史一致的表述（如「三天前」「第某天」）。
5. 选项设计：恰好 ${OPTION_COUNT} 个选项，代表明显不同的行动。effects 只结算选项文案中当天实际发生的行为并符合现实逻辑，需要花钱的选项 money 必须为负数；文案中没有实际行为支撑的属性必须为 0（反例：「加入兼职群」只是加了群，当天没有任何收支，money 必须为 0，只有实际赚到钱或花掉钱才结算 money）。数值大小必须与行为规模相称：一次选择只是一天中的一个小决定，日常情境用小幅值（学业/社交/精力 ±2 上下，金钱几十元内）；大幅值（学业/社交 +3、金钱 ±100 以上）只用于文案明确支撑的重大行为，并在文案或 resultText 中交代事由（如全天高强度学习、大额收支）。
6. resultText：以第二人称「你」简述选择后立刻发生的结果，与 effects 一致（金钱必须对得上：resultText 中当天实际净支出或净收入要等于 money，不能钱已收回仍结算支出）。
7. 文风：用场景与细节叙事，所有文本中不得出现四维数值或属性名（如「精力仅有 1」「金钱 250」），人物状态改用具体感受表达（如「累得眼皮直打架」「钱包快见底了」）；不用「你选择了……结果：……」的模板句式，也不向玩家提问。

只输出一个 JSON 对象，不要输出任何解释或多余文字，结构如下：
{"title":"事件标题","description":"事件详情","options":[{"text":"选项描述","effects":{"academics":0,"social":0,"energy":0,"money":0},"resultText":"选择后的结果叙述"}]}

硬性约束：
- title 不超过 ${TEXT_LIMITS.title} 字；description 不超过 ${TEXT_LIMITS.description} 字；每个 text 不超过 ${TEXT_LIMITS.optionText} 字；每个 resultText 不超过 ${TEXT_LIMITS.resultText} 字。
- effects 四个属性都必须给出整数，未受影响的属性填 0。
- 取值范围：${RANGE_TEXT}，越界视为无效输出。
- 背景设定：军训安排在入学两周之后，这两周不参加军训，任何文本不得出现军训；这两周也是学期开端，不得出现期末考试、期末论文等学期末才有的安排。
- 玩家档案：用户消息中给出的性别与专业是玩家固定信息，不得更改，也不得杜撰与之矛盾的其他固定信息（如另一个专业）；室友、同学等 NPC 与具体故事细节可自由虚构。
- 不要输出 id 字段，选项编号由应用分配。`;

export function buildEventPrompt(
  input: EventGenInput,
  feedback?: string | null,
): { system: string; user: string } {
  return { system: SYSTEM_PROMPT, user: buildUserPrompt(input, feedback ?? null) };
}

function buildUserPrompt(input: EventGenInput, feedback: string | null): string {
  const lines = [
    `当前进度：第 ${input.day} 天（共 14 天）。`,
    `当前属性：学业 ${input.attributes.academics}，社交 ${input.attributes.social}，精力 ${input.attributes.energy}，金钱 ${input.attributes.money}。`,
    input.profile
      ? `玩家档案：性别 ${input.profile.gender}，专业 ${input.profile.major}。`
      : "玩家档案：未收集。请使用中性表述，不要假设玩家的性别与专业，也不要杜撰性别、专业等固定信息。",
  ];
  const hints = buildStateHints(input.attributes);
  if (hints) lines.push(hints);
  const breadthHint = buildBreadthHint(input.history);
  if (breadthHint) lines.push(breadthHint);
  lines.push("", "过往经历：");
  if (input.history.length === 0) {
    lines.push("（无，这是入学后的第 1 天。）");
  } else {
    lines.push(...formatHistory(input.history, input.day));
  }
  lines.push("", `请生成第 ${input.day} 天的事件。`);
  if (feedback) {
    lines.push(
      "",
      `上一次输出未通过校验：${feedback}`,
      "请修正以上问题，重新输出完整的 JSON 对象，仍须严格遵守 system 中的全部硬性约束。",
    );
  }
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

// 生活广度提示（v0.3.4）：近 3 天同一侧面出现 ≥2 天则提示换侧面；第 5～7 天提示出现较少的侧面（最多 2 个，按关键词从标题与选项归类，后半局交还承接历史主导）
const BREADTH_DOMAINS: Array<{ name: string; words: string[] }> = [
  { name: "课堂学业", words: ["课", "作业", "考试", "图书馆", "自习", "实验", "机房"] },
  { name: "社团活动", words: ["社团", "招新", "社费", "分享会", "外拍", "例会", "排练"] },
  { name: "宿舍相处", words: ["宿舍", "舍友", "室友", "熄灯", "卧谈"] },
  { name: "与家人联系", words: ["爸妈", "父母", "家人", "想家", "家里", "视频通话"] },
  { name: "金钱收支", words: ["兼职", "打工", "生活费", "省钱", "攒钱", "发传单", "钱包"] },
  { name: "独处心情", words: ["独处", "一个人", "失眠", "发呆"] },
  { name: "校园日常", words: ["食堂", "操场", "快递", "超市", "澡堂", "医务室", "校园卡"] },
];

function buildBreadthHint(history: HistoryDigestItem[]): string {
  if (history.length === 0) return "";
  const dayDomains = history.map((item) => {
    const text = item.eventTitle + item.chosenOptionText;
    return BREADTH_DOMAINS.filter((domain) => domain.words.some((word) => text.includes(word))).map(
      (domain) => domain.name,
    );
  });
  const hints: string[] = [];
  for (const domain of BREADTH_DOMAINS) {
    const hits = dayDomains.slice(-3).filter((names) => names.includes(domain.name)).length;
    if (hits >= 2) {
      hints.push(`近 3 天中有 ${hits} 天偏向「${domain.name}」侧面，今天请换一个生活侧面`);
      break;
    }
  }
  if (history.length >= 4 && history.length <= 6) {
    const blind = BREADTH_DOMAINS.filter((domain) => !dayDomains.some((names) => names.includes(domain.name)))
      .map((domain) => domain.name)
      .slice(0, 2);
    if (blind.length > 0)
      hints.push(`「${blind.join("」「")}」等侧面出现较少，若有自然契机可纳入`);
  }
  if (hints.length === 0) return "";
  return `生活广度提示（仅为方向提示，不是必触发）：${hints.join("；")}。`;
}
