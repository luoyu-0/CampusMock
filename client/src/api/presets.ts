/* 走查用的预置快照：让 5 个游戏屏 + 2 个错误屏在不等后端、不等模型的情况下都能稳定到达。
   第 5 天那一组的属性与历史是按 design/prototype.html 上的数字反推的：
   待选择时 精力 5 / 金钱 940，选第一个选项结算后 精力 3 / 金钱 940（金钱「没变」）。 */

import type { Snapshot } from '../state/types'
import type { Ending, GameEvent } from '../state/types'
import { TOTAL_DAYS, advanceOneDay, eventForDay, fullWalkSnapshot, initialSnapshot, snapshotAtDay5 } from './script'
import { buildEnding } from './ending'

export type PresetId =
  | 'fresh'
  | 'pendingEvent'
  | 'pendingChoice'
  | 'showResult'
  | 'pendingEnding'
  | 'ended'
  | 'longText'
  | 'longEnding'

export const PRESETS: { id: PresetId; label: string; hold: boolean }[] = [
  { id: 'fresh', label: '跑完整 14 天', hold: false },
  { id: 'pendingEvent', label: '① 待生成事件', hold: true },
  { id: 'pendingChoice', label: '② 待选择', hold: true },
  { id: 'showResult', label: '③ 展示结果', hold: true },
  { id: 'pendingEnding', label: '④ 待生成结局', hold: true },
  { id: 'ended', label: '⑤ 已结束', hold: true },
  { id: 'longText', label: '⑥ 顶格长文案', hold: true },
  { id: 'longEnding', label: '⑦ 顶格结局', hold: true },
]

/** 第 5 天前夕：前 4 天按剧本的 walk 选项结算，数值正好等于原型顶栏。 */
function day4Settled(): Snapshot {
  return snapshotAtDay5()
}

/* 顶格长文案夹具：长度取自成员 C 的 server/src/ai/prompts/values.ts —— 事件
   title 30 / description 300 / optionText 60 / resultText 120，结局 description 400。
   模型接入前界面只按我自己写的二三十字验过，这里把四段文字一次顶到上限。 */
const LONG_TEXT_EVENT: GameEvent = {
  id: 'stress-long-text',
  day: 5,
  title: '临时换班的通知、社团招新的摊位，和一封我在楼道里没读完的家书',
  description: [
    '九月的风把海报吹得翘起一角。社团招新的摊位从天桥一直摆到食堂门口，我守的那张桌子后面堆着没人取的报名表。负责带我的学长临时去开会，说十分钟就回来，已经过去四十分钟了。',
    '手机在口袋里震了三次，是家里发来的。先问我宿舍的床帘装好没有，又说别的不缺什么吧，钱不够要讲。最后一句是「你从小到大没离开过家，我们其实也不放心」。看完我在原地站了一会儿，报名表的边角被捏皱了。',
    '路过的人不停，有人停下来问我这个社团究竟是做什么的，我也讲不利索。登记本上只写了两个名字，一个是我自己试笔留下的，一个是路过同学顺手填的联系方式。天快黑了，学长还没回来，我把手举起来两回又放下，最后干脆把登记表抱在怀里，怕被风掀走。',
  ].join('\n\n'),
  options: [
    {
      id: 'stress-long-text-o1',
      text: '守到摊位收班，把没人取的报名表按年级理好，再等学长回来交接\n他说了算我工时，那就再等一会儿，反正今晚也没有别的事',
      effects: { academics: 0, social: 2, energy: -2, money: 0 },
      resultText:
        '最后一个人把表抽走时，剩下的已经按年级分成三摞。学长小跑回来，连声道谢，说了两遍，又问我要不要进他的群。回宿舍的路上腿有点沉，楼道那盏坏掉的灯依旧黑着，我摸着栏杆上到三楼，洗完澡才想起来有三条消息没回，最早的一条是早八集合的时间。',
    },
    {
      id: 'stress-long-text-o2',
      text: '把摊位置交给隔壁桌的同学，自己去图书馆占个位子，把两天没翻的讲义补完\n那本讲义从开学第一天放到现在，还是崭新的',
      effects: { academics: 3, social: -2, energy: -2, money: 0 },
      resultText:
        '二楼靠窗那张桌子六点以后只剩灯亮着。讲义的第一章比想象中薄，我把例题合上重算了一遍，笔尖在纸上顿出小坑。闭馆音乐响起来时才发现，隔壁桌的人早把我那摞报名表收走了，也给家里拨出去的电话一直没人接；屏幕暗下去又亮起来，最后被我扣在桌上。',
    },
    {
      id: 'stress-long-text-o3',
      text: '收了摊绕去校外，把不合脚的那双迷彩鞋换掉，再给家里回一通电话\n电话里不必说清楚今天到底累不累，说说食堂新出的那道面条也行',
      effects: { academics: -2, social: 1, energy: -1, money: -300 },
      resultText:
        '店里的换货单写了三张，最后留下的一双还是偏大，垫了两层纸巾才算合脚。往回走的路上我把电话拨过去，讲了摊位的破事，讲了食堂的面条太咸，唯独没说在楼道里站着的那几分钟。回到宿舍已经快十一点，熄灯铃响之前我把湿透的鞋塞到阳台，明天第一节还是早八。',
    },
  ],
}

const LONG_ENDING_FIELDS: Pick<Ending, 'title' | 'description' | 'evaluation' | 'advice'> = {
  title: '你把这两周过成了自己的节奏，而不是一张别人替你排好的课表',
  description: [
    '第一周你几乎每天都在道歉：为迟到的十分钟，为没接上的话，为摊开又合上的讲义。第二周开始，你学会在楼下买一杯热的再上楼，学会把「我不太懂」说成「你再说一遍」。这两件事很小，可它们是你自己找出来的，没有人教过你。',
    '你还记住了几样东西的位置：图书馆二楼靠窗那张桌子六点以后还有空；校医院对面的自动售货机找零最慢；宿舍楼道那盏坏掉的灯要摸到第三级台阶才扶得住栏杆。以后会有更多这样的坐标，你不会刻意去记，但都用得上。',
    '那封没读完的家书你后来读完了，也回了。信里说的其实和你在电话里听到的一样：不放心，但知道你在学着过自己的日子。两周结束的时候，你没有变成另一个人，只是把原来那个会站在原地捏皱报名表的人，往前挪了一小步。',
    '有些日子仍然没处理好：答应别人的事忘了，借来的笔记没还，母亲问「吃得惯吗」你答得太快。这些也留在日记里，不必擦掉。它们和那些办成的事一样，都是你这两周真实花掉的时间，谁也拿不走。',
  ].join('\n\n'),
  evaluation: [
    '四个档位记的是这段时间里的状态，不是你的能力，更不是你的价值。学业那一栏偏低，只说明这两周你把时间花在了别处，而别处也是大学生活的一部分。精力与金钱同时吃紧的那几天，你是自己扛过来的，这件事不会写在任何一个档位里。',
    '如果非要一句话概括：你在预算和体力都很紧的条件下，仍然做了几次不为了省事的选择。这几次的分量，比一次分数重得多。那些没做完的事也不全是损失，其中有几件，你本来就不必答应。',
  ].join('\n\n'),
  advice: [
    '下一件事别定太大。挑一门你只是好奇的课，或者一个不需要报名的傍晚散步，先把作息里欠下的睡眠还给自己——精力是这四个数里唯一会自己慢慢涨回来的那个。',
    '如果这两周有哪一天让你想起「原来我还会这样开心」，把它写下来，存在手机备忘录里也行。下次撑不住的时候，那一句比任何建议都管用。',
  ].join('\n\n'),
}

export function presetSnapshot(id: PresetId): Snapshot {
  switch (id) {
    case 'fresh':
      return initialSnapshot()
    case 'pendingEvent':
      return { ...day4Settled(), phase: 'pendingEvent', currentEvent: null }
    case 'pendingChoice':
      return {
        ...day4Settled(),
        revision: day4Settled().revision + 1,
        phase: 'pendingChoice',
        currentEvent: eventForDay(5),
      }
    case 'showResult':
      return advanceOneDay(day4Settled(), eventForDay(5), 0)
    case 'pendingEnding':
      return fullWalkSnapshot()
    case 'longText':
      return {
        ...day4Settled(),
        revision: day4Settled().revision + 1,
        phase: 'pendingChoice',
        currentEvent: LONG_TEXT_EVENT,
      }
    case 'longEnding': {
      const walked = fullWalkSnapshot()
      return {
        ...walked,
        revision: walked.revision + 1,
        phase: 'ended',
        currentEvent: null,
        ending: { ...buildEnding(walked.attributes), ...LONG_ENDING_FIELDS },
      }
    }
    case 'ended': {
      const walked = fullWalkSnapshot()
      return {
        ...walked,
        revision: walked.revision + 1,
        phase: 'ended',
        currentEvent: null,
        ending: buildEnding(walked.attributes),
      }
    }
  }
}

/** 走查面板底部那行小字：当前停在哪个状态、数值规模对不对。 */
export function presetSummary(snapshot: Snapshot): string {
  return `已写 ${snapshot.history.length}/${TOTAL_DAYS} 篇 · 精力 ${snapshot.attributes.energy} · 金钱 ${snapshot.attributes.money}`
}
