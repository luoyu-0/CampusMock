/* 假数据用的结局构造。真实现里这块归成员 B（阈值）和成员 C（文案）：
   档位由应用按阈值判定，模型只写 title/description/evaluation/advice，不得改写最终值和档位。 */

import type { Attributes, Ending, Grade } from '../state/types'

/* 游戏规则已确认的分档阈值：负值一律 D 档，数值越高档位越高。 */
const THRESHOLDS: Record<keyof Attributes, [number, number, number]> = {
  academics: [12, 6, 0],
  social: [12, 6, 0],
  energy: [7, 3, 0],
  money: [800, 400, 0],
}

export function gradeOf(key: keyof Attributes, value: number): Grade {
  const [a, b, c] = THRESHOLDS[key]
  if (value >= a) return 'A'
  if (value >= b) return 'B'
  return value >= c ? 'C' : 'D'
}

export function buildEnding(attributes: Attributes): Ending {
  const grades = {
    academics: gradeOf('academics', attributes.academics),
    social: gradeOf('social', attributes.social),
    energy: gradeOf('energy', attributes.energy),
    money: gradeOf('money', attributes.money),
  }
  return {
    finalAttributes: { ...attributes },
    grades,
    // 以下四段原样取自 design/prototype.html，用来核对排版，不代表真实生成结果
    title: '你把自己的节奏，找回来了一点点',
    description:
      '这两周你几乎没有一件事是「轻松办完」的，但你都办到了某种程度：论文交上去了，哪怕不是最好的版本；室友叫你吃饭你去了两次，第三次你说想自己待着——那也是第一次你没勉强自己。\n\n' +
      '钱你留得住，人你累得狠。最后一个晚上你走在林荫道上，发现自己不再数还剩几天了。',
    evaluation:
      '你把自己排在了任务后面。学业的 A 不是天赋，是你熬出来的；精力和社交同时落到 D，是同一件事的代价。这两周里没有哪一个选择是错的，只是有些选择会把后面的路变窄一点。',
    advice:
      '先睡够三天，再决定要不要退社团。如果想去上课，试着在课间跟旁边的人说一句和课无关的话——不用长，一句就够。低档位不等于你不行，它只是这两周留下的脚印。',
  }
}
