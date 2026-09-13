/* 流式响应的帧协议。服务端 Content-Type 仍是 application/json 时前端完全走原来的路子，
   只有服务端改成逐帧输出（application/x-ndjson，一行一帧）时这些代码才参与。

   帧形状照成员 C 的 EventStreamHandlers 来（server/src/ai/generateEvent.ts），
   不转发模型原始 token——C 在服务端已经把半截 JSON 解析成语义片段了：

     {"k":"title","v":"……"}        标题整段给出
     {"k":"desc","v":"……"}         正文增量，前端往后接
     {"k":"opt","i":0,"v":"……"}    第 i 个选项的完整文本（眼下界面不画，见 useGame 的 applyFrame）
     {"k":"reset"}                 服务端要重问一次，之前显示的作废
     {"k":"end", ...完整响应体}     终帧：与原 POST 的 JSON 响应体逐字一致（成功或错误两种形状）

   只有终帧会写存档；中间帧进的是临时草稿状态，刷新一下就没了。
   未知 k 一律忽略，所以 C 之后加 resultText 帧不需要前端先改。 */

export interface StreamFrame {
  k: string
  v?: unknown
  i?: unknown
}

export type FrameHandler = (frame: StreamFrame) => void

/** 标题与正文的临时草稿：事件生成期间显示在等待卡上，终帧一到就被真快照取代。
   fresh / chunk 只为"刚到那几个字洇一下墨"服务（界面靠 chunk 当 key 重放动画），不进存档。 */
export interface StreamDraft {
  title: string
  description: string
  fresh: string
  chunk: number
}

export const EMPTY_DRAFT: StreamDraft = { title: '', description: '', fresh: '', chunk: 0 }

/** 拿到一帧后怎么并入草稿。不认识的名字原样返回，草稿不变。 */
export function applyDraftFrame(draft: StreamDraft, frame: StreamFrame): StreamDraft {
  if (frame.k === 'reset') return EMPTY_DRAFT
  const text = typeof frame.v === 'string' ? frame.v : null
  if (text === null) return draft
  if (frame.k === 'title') return { ...draft, title: text }
  if (frame.k === 'desc')
    return { ...draft, description: draft.description + text, fresh: text, chunk: draft.chunk + 1 }
  return draft
}

export function hasDraft(draft: StreamDraft): boolean {
  return draft.title !== '' || draft.description !== ''
}

function parseLine(line: string): StreamFrame | null {
  const text = line.trim()
  if (!text) return null
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    // 单帧损坏不值得让整个请求失败：终帧还在后面，它才是唯一进存档的东西。
    return null
  }
  if (!value || typeof value !== 'object') return null
  const frame = value as Record<string, unknown>
  // 终帧还包含 requestId、baseRevision、snapshot 或 error，必须完整交给状态机校验。
  return typeof frame.k === 'string' ? (frame as unknown as StreamFrame) : null
}

/** 逐行解析器。网络切片不会照顾换行符，所以半行要留在缓冲区里等下一段。 */
export function createFrameParser(): {
  push: (chunk: string) => StreamFrame[]
  end: () => StreamFrame[]
} {
  let buffer = ''

  return {
    push(chunk: string) {
      buffer += chunk
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      return lines.map(parseLine).filter((frame): frame is StreamFrame => frame !== null)
    },
    end() {
      const rest = buffer
      buffer = ''
      const frame = parseLine(rest)
      return frame ? [frame] : []
    },
  }
}
