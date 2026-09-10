/* 数字与文案的显示规则。界面只展示精力与金钱，学业/社交由文案暗示（已确认规则），
   所以这两个函数只会被这两根属性调用。 */

/** 顶栏数值：负号用排版用的 U+2212，跟原型一致（精力 −3）。 */
export function formatValue(value: number): string {
  return value < 0 ? `−${Math.abs(value)}` : `${value}`
}

/** 结算后的增减：0 写「没变」而不是 0，免得看起来像表格。 */
export function formatDelta(value: number): string {
  if (value === 0) return '没变'
  return value > 0 ? `+${value}` : `−${Math.abs(value)}`
}

export function deltaClass(value: number): string {
  if (value < 0) return 'v neg'
  if (value > 0) return 'v pos'
  return 'v'
}

/** 段落之间用空行分隔是快照字段的约定，渲染时切成多个 <p>。 */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean)
}

/** 选项第一行是行动本身，换行后面是动机独白，界面上是 <small>。 */
export function splitOption(text: string): [string, string | null] {
  const index = text.indexOf('\n')
  if (index < 0) return [text, null]
  return [text.slice(0, index), text.slice(index + 1).trim() || null]
}

/** 日记体句子补句号，跟原型的历史列表一致。 */
export function sentence(text: string): string {
  return /[。！？…”』」]$/.test(text) ? text : `${text}。`
}
