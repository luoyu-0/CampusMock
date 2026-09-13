// 按 JSON 路径提取字符串增量，不依赖对象字段顺序；最终结构仍由 validate 校验。
export interface EventStreamParserHandlers {
  onTitle?(title: string): void;
  onDescriptionDelta?(delta: string): void;
  onOptionText?(index: number, text: string): void;
  onResultTextDelta?(index: number, delta: string): void;
  onResultText?(index: number, text: string): void;
}
export type EventStreamParser = { feed(chunk: string): void };

export function checkStreamViolation(text: string): string | null {
  const hit = /(军训|期末)/.exec(text);
  return hit ? `文本出现违禁词「${hit[0]}」` : null;
}

type JsonPath = (string | number)[];
type Container = { path: JsonPath; array: boolean; key: string | null; index: number };
const ESCAPES: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };

export function createEventStreamParser(handlers: EventStreamParserHandlers): EventStreamParser {
  const stack: Container[] = [];
  let buffer = '';
  let pos = 0;
  let string: { key: boolean; path: JsonPath; text: string } | null = null;
  let primitive = false;
  let stopped = false;
  const valuePath = (): JsonPath => {
    const parent = stack[stack.length - 1];
    return parent ? [...parent.path, parent.array ? parent.index : parent.key ?? ''] : [];
  };
  const emit = (path: JsonPath, delta: string, full: string, closed: boolean) => {
    if (path.length === 1 && path[0] === 'title' && closed) handlers.onTitle?.(full);
    if (path.length === 1 && path[0] === 'description' && delta) handlers.onDescriptionDelta?.(delta);
    if (path.length === 3 && path[0] === 'options' && typeof path[1] === 'number') {
      if (path[2] === 'text' && closed) handlers.onOptionText?.(path[1], full);
      if (path[2] === 'resultText') {
        if (delta) handlers.onResultTextDelta?.(path[1], delta);
        if (closed) handlers.onResultText?.(path[1], full);
      }
    }
  };
  return {
    feed(chunk) {
      if (stopped) return;
      buffer += chunk;
      while (pos < buffer.length) {
        if (string) {
          let delta = '';
          let closed = false;
          while (pos < buffer.length) {
            const ch = buffer[pos];
            if (ch === '"') { pos++; closed = true; break; }
            if (ch === '\\') {
              if (pos + 1 >= buffer.length) break;
              const esc = buffer[pos + 1];
              if (esc === 'u') {
                if (pos + 6 > buffer.length) break;
                const hex = buffer.slice(pos + 2, pos + 6);
                if (!/^[\da-f]{4}$/i.test(hex)) { stopped = true; return; }
                delta += String.fromCharCode(parseInt(hex, 16)); pos += 6;
              } else {
                if (!(esc in ESCAPES)) { stopped = true; return; }
                delta += ESCAPES[esc]; pos += 2;
              }
            } else { delta += ch; pos++; }
          }
          string.text += delta;
          if (!string.key) emit(string.path, delta, string.text, closed);
          if (!closed) break;
          if (string.key) stack[stack.length - 1].key = string.text;
          string = null;
          continue;
        }
        const ch = buffer[pos];
        if (primitive) {
          if (!/[\s,}\]]/.test(ch)) { pos++; continue; }
          primitive = false;
        }
        if (/\s/.test(ch) || ch === ':') { pos++; continue; }
        if (ch === '"') {
          const parent = stack[stack.length - 1];
          string = { key: !!parent && !parent.array && parent.key === null, path: valuePath(), text: '' };
          pos++; continue;
        }
        if (ch === '{' || ch === '[') {
          stack.push({ path: valuePath(), array: ch === '[', key: null, index: 0 });
        } else if (ch === '}' || ch === ']') {
          stack.pop();
        } else if (ch === ',') {
          const parent = stack[stack.length - 1];
          if (parent?.array) parent.index++;
          else if (parent) parent.key = null;
        } else { primitive = true; }
        pos++;
      }
      // 只保留跨网络分片的未完成转义字符，避免不断重扫已处理正文。
      buffer = buffer.slice(pos);
      pos = 0;
    },
  };
}
