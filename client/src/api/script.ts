/* 假数据剧本：只服务本地假 API，真实事件由成员 C 的模型生成后替换掉。
   第 5 天的事件与结局文案是从 design/prototype.html 原样搬来的，其余天数是占位文本，
   但每项 effects 都落在游戏规则已确认的单次增减范围内（学业社交 −2~+3、精力 −2~+2、金钱 −300~+300），
   所以可以拿它当 B 的结算与分档测试用例。 */

import type { Attributes, Effects, GameEvent, GameOption, Snapshot } from '../state/types'

export const TOTAL_DAYS = 14
export const SCHEMA_VERSION = 1
export const RULES_VERSION = 1

export const INITIAL_ATTRIBUTES: Attributes = { academics: 0, social: 0, energy: 7, money: 1000 }

/** 参数顺序刻意跟规则表一致：学业、社交、精力、金钱 */
const eff = (academics: number, social: number, energy: number, money: number): Effects => ({
  academics,
  social,
  energy,
  money,
})

interface DraftOption {
  text: string
  effects: Effects
  resultText: string
}

interface DraftDay {
  title: string
  description: string
  options: DraftOption[]
  /** 自动走完 14 天时选第几个选项，只给走查用 */
  walk: number
}

export const DAY_SCRIPT: DraftDay[] = [
  {
    title: '报到那天，我没敢问宿管阿姨要钥匙',
    description:
      '人流从报名处一直堵到宿舍楼下。你捏着报到单在门口站了两回，每次都在开口前换了个姿势。\n\n' +
      '最后是同寝的男生替你问的。他顺手也替你刷了那张卡。',
    options: [
      { text: '谢了那位同学，决定先去把流程跑完\n至少明天自己开口', effects: eff(1, 0, -1, 0), resultText: '流程跑完了，就是排在别人后面' },
      { text: '装作是对方帮的忙，什么都没写进日记\n这种小事不值得记', effects: eff(-1, -1, 0, 0), resultText: '那一页我留了白' },
      { text: '站在楼下又看了一遍钥匙柜\n其实是在等自己有勇气', effects: eff(0, -1, -1, 0), resultText: '排了很久队，最后是同寝的男生帮我刷的卡' },
    ],
    walk: 2,
  },
  {
    title: '社团摊位前站了三圈',
    description:
      '百团招新的桌子从林荫道这头摆到那头。你在吉他社和志愿服务站之间来回走了三趟。\n\n' +
      '每次快走到跟前，前面就正好排上几个人。',
    options: [
      { text: '排进去，把表填了再说\n反正填了也能退', effects: eff(0, 2, -1, 0), resultText: '表填了，交上去的时候手有点抖' },
      { text: '先加群，线上报名也一样\n当面说太尴尬了', effects: eff(0, 1, 0, 0), resultText: '群里很安静，我至今没说过话' },
      { text: '领了宣传单就走，说明天再来\n明天应该也会有勇气', effects: eff(0, 0, 0, 0), resultText: '最后只领了一张宣传单，没敢填表' },
    ],
    walk: 2,
  },
  {
    title: '把生活费转给了家里',
    description:
      '妈妈发来一张水电缴费的截图，后面跟了一句「不用寄」。你回了一个「哦」，然后把钱转了过去。\n\n' +
      '购物车里那本参考书还留着，标价是三天饭菜的钱。',
    options: [
      { text: '转过去，书以后再说\n家里可能真的紧', effects: eff(0, 0, 0, -50), resultText: '说是不缺钱，其实是想买那本很贵的参考书' },
      { text: '转一半，剩下的买书\n两边都说得过去', effects: eff(1, 0, 0, -25), resultText: '书到手了，我把它压在枕头底下' },
      { text: '先买书，周末去找兼职补上\n这样谁都不欠', effects: eff(1, -1, -2, -20), resultText: '兼职的第一单排到了下周三' },
    ],
    walk: 0,
  },
  {
    title: '通宵改了三门课的作业框架',
    description:
      '走廊的灯是声控的，你说一句话它就亮一会儿。凌晨三点，你第三次把大纲推到重来。\n\n' +
      '接水的时候看见隔壁床也站着，他手里端着杯子，什么也没说。',
    options: [
      { text: '再撑一轮，把三门都收口\n反正也不困了', effects: eff(3, 0, -1, -10), resultText: '走廊的灯灭了很多次' },
      { text: '只留一门做到能交，其余明早补\n先睡四个小时', effects: eff(1, 0, 1, 0), resultText: '闹钟响的时候我居然醒了' },
      { text: '去叫隔壁床一起，两个人快点\n一个人容易跑神', effects: eff(2, 2, -1, 0), resultText: '我们分头查资料，四点前搞定了两门' },
    ],
    walk: 0,
  },
  {
    title: '凌晨一点的台灯',
    description:
      '室友们十一点半就睡了。上铺的呼吸声传下来，你才意识到已经这个点了。\n\n' +
      '桌上是明天早上要交的《大学生活导论》课程论文，你写到第二部分就卡住了——其实材料都查到了，只是不太确定老师说的「结合自身体验」到底要写多私人的东西。手机亮了一下，社团群里还在接龙报名，截止时间是今晚十二点，组长@了你好几次。\n\n' +
      '你在图书馆坐了一整天，太阳穴到现在还在跳。窗缝里钻进来的风把走廊的声控灯吹得忽明忽暗，灭了一次，又亮起来。',
    options: [
      {
        text: '先把论文写完，社团的表明天再补\n反正老师说迟交扣分不多',
        effects: eff(3, -1, -2, 0),
        resultText:
          '把消息设成了免打扰\n\n' +
          '你给社团群开了免打扰，屏幕暗下去的那一刻房间安静得有点心虚。\n\n' +
          '第二段写了三遍才顺，走廊的灯灭了三次又亮起来。交出去的版本你自己不太满意，但它是写完了的。回程接水的路上，你在楼道里碰见同样没睡的隔壁床，你们一起站了一会儿，谁也没说话。',
      },
      {
        text: '关掉电脑先睡，写了一半也是半篇\n明天课间再补一段',
        effects: eff(-2, 1, 2, 0),
        resultText:
          '灯一关我就睡着了\n\n' +
          '闹钟定在六点四十，其实没用上。醒来第一反应是心虚，第二反应是没那么难受。\n\n' +
          '课间我补了最后一段，交得比预想的早。',
      },
      {
        text: '下楼买杯咖啡，逼自己两样都做完\n便利店就到关门那一刻',
        effects: eff(1, 0, -1, -18),
        resultText:
          '咖啡是第三杯了\n\n' +
          '便利店的关东煮还剩最后一盒，我犹豫了两秒还是没拿。\n\n' +
          '两样都做了，两样都只做了七成。回宿舍的路上风很凉，我发现自己一直在抖。',
      },
    ],
    walk: 0,
  },
  {
    title: '下雨天，忘带伞的那节课',
    description:
      '早八的雨下得很实在，教学楼门口的伞架空了一半。\n\n' +
      '我站在门厅里数还有多久下课。',
    options: [
      { text: '冲回宿舍，湿就湿\n反正还有换的', effects: eff(1, 0, -1, 0), resultText: '跑回去那段路我笑了' },
      { text: '借同学的伞，约明天还\n欠一顿饭也值', effects: eff(0, 1, 0, 0), resultText: '伞还的时候多带了一袋奶' },
      { text: '等雨小一点，顺便听一会儿歌\n不赶时间', effects: eff(0, 0, 1, -40), resultText: '食堂的伞架前排了很多人，我在那吃了顿饭' },
    ],
    walk: 0,
  },
  {
    title: '第一次班会上被点了学号',
    description:
      '导员说「来，从这个同学开始自我介绍一下」。教室里有椅子挪动的声音。\n\n' +
      '我前面那个人说了三句话，掌声比我想象中热烈。',
    options: [
      { text: '站起来说两句，加一句「以后多联系」\n不能太敷衍', effects: eff(0, 1, -1, 0), resultText: '回座的时候有人问我叫什么' },
      { text: '只说名字和家乡，坐下\n够用了', effects: eff(0, 0, 0, 0), resultText: '我听见后排笑了，不确定是不是因为我' },
      { text: '推给「下一位开始吧」\n真的没准备', effects: eff(0, -1, 0, 0), resultText: '那个空隙我盯着桌面数了十秒' },
    ],
    walk: 2,
  },
  {
    title: '爸妈打来视频，我问了钱够不够',
    description:
      '屏幕里我妈在后面装行李，我爸把手机架在杯子上。\n\n' +
      '他们问了三遍食堂贵不贵，我答了三遍不贵。',
    options: [
      { text: '说了实话，饭卡这周刷得快\n让他们知道我省', effects: eff(0, 1, 0, -60), resultText: '挂了以后我把这个月的账重算了一遍，还能撑到月底' },
      { text: '报喜不报忧，说不缺钱\n说了他们也睡不好', effects: eff(2, -1, 0, 0), resultText: '我挂了电话，把购物车那本书结算了' },
      { text: '顺便说了室友挺好的\n他们最在意这个', effects: eff(0, 1, 0, 0), resultText: '我妈结束前说，那我们就放心了' },
    ],
    walk: 1,
  },
  {
    title: '体测前的一千米报名接龙',
    description:
      '群里在接龙，前面几个人写了「陪跑」。体育委员说这次不计分，但缺测要补。\n\n' +
      '我把鞋从床底拖出来看了看，鞋底磨得有点歪。',
    options: [
      { text: '报上，晚上去操场走两圈\n不至于太难看', effects: eff(1, 0, -1, 0), resultText: '走两圈变成了三圈，回来腿是木的' },
      { text: '先不报，等通知再说\n还有别的事', effects: eff(0, 0, 1, 0), resultText: '接龙一直挂在群置顶' },
      { text: '拉上隔壁床一起报\n一个人不去', effects: eff(0, 1, -1, -30), resultText: '我们约在六点，他迟到八分钟' },
    ],
    walk: 0,
  },
  {
    title: '图书馆的占座和没还的书',
    description:
      '靠窗的位置六点就没了。我坐在暖气边上，背挺不直。\n\n' +
      '系统提醒我借的那本《大学心理》后天到期。',
    options: [
      { text: '续借，然后留下写两小时\n反正也不赶', effects: eff(1, 0, -2, 0), resultText: '写完两页，灯关了一半' },
      { text: '先回家，书明天再说\n今天状态不行', effects: eff(-1, 0, 1, 0), resultText: '我躺在床上刷到了两点' },
      { text: '在自习室找个人问那题怎么做\n问完就走', effects: eff(0, -1, -1, -50), resultText: '她讲得很清楚，我一个字没记住' },
    ],
    walk: 0,
  },
  {
    title: '宿舍夜谈，我第一次说了初中',
    description:
      '灯关了，有人在讲高中班主任的口头禅。讲着讲着安静下来。\n\n' +
      '不知道谁问了句「你们以前什么样」。',
    options: [
      { text: '讲了我初三分班那半年\n也不算什么秘密', effects: eff(0, 1, -1, 0), resultText: '说完以后上铺递了包纸巾下来' },
      { text: '打了个哈哈混过去\n今天太累了', effects: eff(0, -1, -1, -70), resultText: '我翻身面朝墙，听见自己心跳' },
      { text: '反问他们为什么来这\n把话头递出去', effects: eff(1, 1, 0, 0), resultText: '那晚我们聊到熄灯后二十分钟' },
    ],
    walk: 1,
  },
  {
    title: '期中小论文，老师给了个「可」',
    description:
      '作业本发下来，我的那页写着「可以，但你想说的没说清」。\n\n' +
      '后面那半句比低分更让人不舒服。',
    options: [
      { text: '办公时间去找老师问那句\n当场问最省时间', effects: eff(2, 1, -1, 0), resultText: '她说我是怕写多了才绕，我觉得她看错了人——但也可能对' },
      { text: '自己重读两遍，改个开头\n不必麻烦人家', effects: eff(2, 0, 0, -50), resultText: '改了四遍，交上去的是第一遍的思路' },
      { text: '这题先放着，下次再说\n手上有别的', effects: eff(-1, 0, 0, 0), resultText: '那本作业我到现在没翻开' },
    ],
    walk: 1,
  },
  {
    title: '没课的周三，我睡到两点半',
    description:
      '闹钟一次都没响。醒来时宿舍是空的，窗帘缝里那条光已经挪到床脚了。\n\n' +
      '手机上有四条未读：两条群通知，一条妈妈问吃了吗，一条组长问社团的表还填不填。',
    options: [
      { text: '起来去把那篇论文补完，图书馆还有位置\n今天不熬夜了', effects: eff(2, 0, 0, -45), resultText: '写完是晚上九点，回宿舍的路灯很亮' },
      { text: '先出门找个人一起吃午饭\n一个人在宿舍待不住', effects: eff(-1, 1, -1, 0), resultText: '她讲了半小时自己的专业调剂，我听懂了一半' },
      { text: '下午被拉去帮忙布置场地\n不去不好意思', effects: eff(0, 2, -2, -25), resultText: '搬了两个小时桌子，走时有人问我明天还来吗' },
    ],
    walk: 0,
  },
  {
    title: '第 14 天：日记本还剩最后两页',
    description:
      '晚上没课。我把这两周的记录从头翻了一遍，很多事已经想不起当时为什么那么纠结。\n\n' +
      '风吹得阳台那件外套鼓起来，又瘪下去。',
    options: [
      { text: '把最后两页写满，不管字丑\n写给以后的自己', effects: eff(2, 0, 0, -50), resultText: '我写下「下次早点睡」，然后笑了' },
      { text: '只写日期，留白\n剩下的以后补', effects: eff(0, 0, 1, 0), resultText: '留白那页我拍了照' },
      { text: '叫隔壁床一起去吃夜宵\n边吃边想怎么写', effects: eff(0, 2, 0, -35), resultText: '他给我夹了个蛋，说我也变了点' },
    ],
    walk: 2,
  },
]

function optionId(eventId: string, index: number) {
  return `${eventId}-o${index + 1}`
}

/** 事件 id 全局唯一，天数从 1 开始，越界直接抛，避免走查时静默出错 */
export function eventForDay(day: number): GameEvent {
  const draft = DAY_SCRIPT[day - 1]
  if (!draft) throw new Error(`剧本里没有第 ${day} 天`)
  const id = `day-${day}`
  const options: GameOption[] = draft.options.map((option, index) => ({
    id: optionId(id, index),
    text: option.text,
    effects: option.effects,
    resultText: option.resultText,
  }))
  return { id, day, title: draft.title, description: draft.description, options }
}

function createGameId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `game-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function initialSnapshot(): Snapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    gameId: createGameId(),
    revision: 0,
    phase: 'pendingEvent',
    attributes: { ...INITIAL_ATTRIBUTES },
    history: [],
    currentEvent: null,
    ending: null,
  }
}

/** 走查用的第 5 天起始存档：前 4 天按剧本的 walk 选项结算出来，
    属性正好等于原型界面上的 精力 5 / 金钱 940。 */
export function snapshotAtDay5(): Snapshot {
  return DAY_SCRIPT.slice(0, 4).reduce<Snapshot>(
    (snapshot, draft, index) => advanceOneDay(snapshot, eventForDay(index + 1), draft.walk),
    initialSnapshot(),
  )
}

/** 结算一条已选选项：属性累加、写入历史、推进阶段。真接口的同一份逻辑在成员 B 那边。 */
export function advanceOneDay(snapshot: Snapshot, event: GameEvent, optionIndex: number): Snapshot {
  const option = event.options[optionIndex]
  const attributes: Attributes = {
    academics: snapshot.attributes.academics + option.effects.academics,
    social: snapshot.attributes.social + option.effects.social,
    energy: snapshot.attributes.energy + option.effects.energy,
    money: snapshot.attributes.money + option.effects.money,
  }
  const done = [
    ...snapshot.history,
    {
      day: event.day,
      eventId: event.id,
      optionId: option.id,
      eventTitle: event.title,
      chosenText: option.text.split('\n')[0],
      resultText: option.resultText,
      effects: option.effects,
    },
  ]
  return {
    ...snapshot,
    revision: snapshot.revision + 1,
    attributes,
    history: done,
    currentEvent: event,
    phase: done.length >= TOTAL_DAYS ? 'pendingEnding' : 'showResult',
    ending: null,
  }
}

/** 自动走完 14 天，用来检查数值规模和档位。 */
export function fullWalkSnapshot(): Snapshot {
  return DAY_SCRIPT.reduce(
    (snapshot, draft, index) => advanceOneDay(snapshot, eventForDay(index + 1), draft.walk),
    initialSnapshot(),
  )
}
