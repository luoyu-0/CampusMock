/* 日历文案。游戏规则只确认了「一局 14 天」，没确认起始日期，
   这里照 design/prototype.html 画的样子取第 1 天 = 9 月 1 日 = 星期六
   （原型第 5 天写的是「9 月 5 日 · 星期三」，第 14 天是「9 月 14 日 · 星期五」，两处都对得上）。
   等成员 C 把日期写进事件生成，这个文件就该退化成读事件字段。 */

const WEEKDAYS = ['六', '日', '一', '二', '三', '四', '五']

export function dateLabel(day: number): string {
  return `9 月 ${day} 日`
}

export function weekdayLabel(day: number): string {
  return `星期${WEEKDAYS[(day - 1) % 7]}`
}

/** 顶栏右侧：9 月 5 日 · 星期三 */
export function dayLineDate(day: number): string {
  return `${dateLabel(day)} · ${weekdayLabel(day)}`
}

/** 事件卡上方的 kicker。原型这里还带了「有风」这样的天气后缀，
   但快照字段里没有它，所以先只出日期——已记进待确认事项。 */
export function kickerLabel(day: number): string {
  return dateLabel(day)
}
