import type { AiError } from "./deepseek.js";
import type { EventOption, Ending, EventGenInput, GameEvent } from "./schema.js";

// 备用内容：AI 临时性故障重试耗尽时兜底，保证一局游戏能继续走完。
// 文案为通用应急内容，不承接历史、不随属性个性化；数值与字数必须符合
// values.ts 的约束（npm run test:retry 会用 validate 复核，改文案时留意）。

// Safe 包装的统一返回：usedFallback=true 时 error 为触发兜底的原始错误
export interface AiResult<T> {
  value: T;
  usedFallback: boolean;
  error: AiError | null;
}

interface FallbackEventTemplate {
  title: string;
  description: string;
  options: Omit<EventOption, "id">[];
}

const FALLBACK_EVENTS: FallbackEventTemplate[] = [
  {
    title: "图书馆四楼的午后",
    description: "自习区难得有空位，窗外的梧桐被风吹得沙沙作响。你摊开这几天攒下的作业，笔尖却迟迟没有落下。",
    options: [
      {
        text: "安心把攒下的作业写完",
        effects: { academics: 2, social: 0, energy: -1, money: 0 },
        resultText: "作业清了大半，你合上书，感觉心里踏实了不少。",
      },
      {
        text: "和邻座同学小声聊几句",
        effects: { academics: 0, social: 1, energy: 0, money: 0 },
        resultText: "你们聊了会儿家乡和食堂，约好下次一起去尝尝新窗口。",
      },
      {
        text: "趴在桌上先眯二十分钟",
        effects: { academics: 0, social: 0, energy: 1, money: 0 },
        resultText: "小睡醒来精神好了些，虽然作业还剩不少。",
      },
    ],
  },
  {
    title: "食堂新开的窗口",
    description: "食堂新开了一个窗口，队伍排到了门口，饭菜香味一路飘到楼梯口。你捏着饭卡犹豫要不要试试。",
    options: [
      {
        text: "排队尝尝新窗口的招牌菜",
        effects: { academics: 0, social: 0, energy: 1, money: -15 },
        resultText: "味道确实不错，你决定下次带室友一起来。",
      },
      {
        text: "照旧打份家常菜回宿舍",
        effects: { academics: 0, social: 0, energy: 0, money: -10 },
        resultText: "熟悉的口味下得很顺，你顺路把晚自习的书抱了回来。",
      },
      {
        text: "约同学拼桌边吃边聊",
        effects: { academics: 0, social: 2, energy: -1, money: -12 },
        resultText: "一顿饭吃出了不少共同话题，你们加了微信约着下次再聊。",
      },
    ],
  },
  {
    title: "傍晚的操场",
    description: "晚风把操场吹得很凉爽，跑道上三三两两都是夜跑的人，广播里放着轻音乐。",
    options: [
      {
        text: "绕操场慢跑几圈",
        effects: { academics: 0, social: 0, energy: -1, money: 0 },
        resultText: "跑完微微出汗，你冲了个澡，晚上睡得特别沉。",
      },
      {
        text: "坐在看台吹风听歌",
        effects: { academics: 0, social: 0, energy: 1, money: 0 },
        resultText: "你把歌单听完一遍，白天的烦躁散了不少。",
      },
      {
        text: "加入路边临时凑的球局",
        effects: { academics: 0, social: 2, energy: -2, money: 0 },
        resultText: "球局散场时你们互相报了学院，约好下周再战。",
      },
    ],
  },
  {
    title: "熄灯后的卧谈会",
    description: "熄灯后宿舍里的卧谈会照常开始，从选课吐槽聊到家乡美食，笑声压得很低。",
    options: [
      {
        text: "加入聊天说到半夜",
        effects: { academics: 0, social: 2, energy: -2, money: 0 },
        resultText: "你和舍友越聊越投机，约好周末一起进城。",
      },
      {
        text: "听一会儿就戴耳塞睡觉",
        effects: { academics: 0, social: 0, energy: 1, money: 0 },
        resultText: "你在断续的笑声里睡着，第二天精神不错。",
      },
      {
        text: "边听边把明天的事列个清单",
        effects: { academics: 1, social: 0, energy: -1, money: 0 },
        resultText: "清单写完你心里有底了不少，入睡也踏实了。",
      },
    ],
  },
];

// 按天取模轮换，保证同一局内相邻两天的备用事件不同
export function buildFallbackEvent(input: EventGenInput): GameEvent {
  const template = FALLBACK_EVENTS[input.day % FALLBACK_EVENTS.length];
  return {
    id: `ev-${input.day}-fallback`,
    day: input.day,
    title: template.title,
    description: template.description,
    options: template.options.map((option, index) => ({
      id: String.fromCharCode(65 + index),
      ...option,
    })),
  };
}

// 备用结局：通用应急文案，不引用具体数值与档位
export const FALLBACK_ENDING: Ending = {
  title: "两周的句号",
  description:
    "这两周你认真走完了每一步：认识新的朋友，适应新的节奏，也在一次次小选择里慢慢摸清了自己的模样。故事暂告一段落，但大学生活才刚刚开始。",
  evaluation: "你完整地经历了入学初期的期待与焦虑，无论结果如何，坚持做出每一次选择本身就是收获。",
  advice: "接下来试着给学习、社交和休息排出优先级，先保证睡眠，再按自己的节奏稳步推进。",
};
