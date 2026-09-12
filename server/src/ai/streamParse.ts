// 事件 JSON 的增量字段抽取器：把模型流式输出的原始 JSON 文本实时切成「标题与选项文本整体 / 描述增量 / 结果叙述增量」。
// 只按提示词约定的字段顺序做标记扫描（title → description → options[].text → options[].resultText），带转义感知；
// effects 是结算数值不属于流式面，直接跳过不回调；结构偏离预期时进入休眠、不再产出任何事件——最终结果一律以整体 JSON.parse + validateEventOutput 为准，
// 本模块只负责展示加速，不影响正确性。
// 关键不变量：结构匹配（引号、冒号、括号）在没有完整到手前不消费任何字符，块边界任意切分都能安全续跑。
export interface EventStreamParserHandlers {
  onTitle?(title: string): void; // 标题闭合（整体一次）
  onDescriptionDelta?(delta: string): void;
  onOptionText?(index: number, text: string): void; // 选项文本闭合（整条弹出）
  onResultTextDelta?(index: number, delta: string): void; // 结果叙述增量（已反转义）
  onResultText?(index: number, text: string): void; // 结果叙述闭合（完整）
}

export type EventStreamParser = {
  feed(chunk: string): void;
};

// 流式违禁词：提示词硬性禁止（军训 / 期末）但 validate.ts 不覆盖的内容，边流边查、命中即中止本次尝试。
// 刻意不查阿拉伯数字：像「6 人寝」这类合法数字会造成误杀重试。
const FORBIDDEN_PATTERN = /(军训|期末)/;

export function checkStreamViolation(text: string): string | null {
  const hit = FORBIDDEN_PATTERN.exec(text);
  return hit ? `文本出现违禁词「${hit[0]}」` : null;
}

const ESCAPES: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};

type Stage =
  | "seek-title"
  | "read-title"
  | "seek-description"
  | "read-description"
  | "seek-options"
  | "options-array"
  | "option-key"
  | "option-colon"
  | "read-option-text"
  | "seek-result"
  | "read-result-text"
  | "after-result"
  | "done"
  | "dormant";

// 三态结果：1=匹配成功并推进，0=文本不足等下一块（未消费），-1=结构偏离进入休眠
type Step = 1 | 0 | -1;

export function createEventStreamParser(handlers: EventStreamParserHandlers): EventStreamParser {
  let text = ""; // 已累计的原始 JSON 文本
  let scanPos = 0; // 已消费到的位置（其前内容已处理完毕）
  let stage: Stage = "seek-title";
  let strBuf = ""; // 当前正在读取的完整字符串（title / option text 用）
  let optionIndex = 0;
  let restDepth = 0; // skipOptionRest 期间未闭合的 { 嵌套深度（跨块保持）
  let restInString = false; // skipOptionRest 跨块保持的「正在字符串内」状态，重入不得把字符串内容当结构字符

  function dormant(reason: string): -1 {
    stage = "dormant";
    console.warn(`[ai] 流式解析停止（不影响最终结果）：${reason}`);
    return -1;
  }

  function skipWs(): boolean {
    while (scanPos < text.length && /\s/.test(text[scanPos])) scanPos++;
    return scanPos < text.length;
  }

  // 严格匹配一个完整 token（键名、标点组），token 前可跳空白；不完整则不消费、原地等下一块
  function matchToken(token: string): Step {
    let pos = scanPos;
    while (pos < text.length && /\s/.test(text[pos])) pos++;
    if (pos + token.length > text.length) {
      return token.startsWith(text.slice(pos)) ? 0 : dormant(`应为「${token}」`);
    }
    if (!text.startsWith(token, pos)) return dormant(`应为「${token}」`);
    scanPos = pos + token.length;
    return 1;
  }

  // 依次匹配 seq 的每个字符，字符之间可跳空白（如 ": ["）；不完整则不消费、原地等下一块
  function matchSeq(seq: string): Step {
    let pos = scanPos;
    for (const ch of seq) {
      while (pos < text.length && /\s/.test(text[pos])) pos++;
      if (pos >= text.length) return 0;
      if (text[pos] !== ch) return dormant(`应为「${seq}」`);
      pos++;
    }
    scanPos = pos;
    return 1;
  }

  // 从 scanPos 读字符串内容（调用时 scanPos 应停在开场引号之后）。读到结束引号返回 closed=true；
  // 文本不足时原地停住等下一块（悬挂的反斜杠 / 不完整的 \u 也原地等待）。
  function readString(): { out: string; closed: boolean } {
    let out = "";
    while (scanPos < text.length) {
      const ch = text[scanPos];
      if (ch === '"') {
        scanPos++;
        return { out, closed: true };
      }
      if (ch === "\\") {
        if (scanPos + 1 >= text.length) return { out, closed: false };
        const esc = text[scanPos + 1];
        if (esc === "u") {
          if (scanPos + 6 > text.length) return { out, closed: false };
          const code = Number.parseInt(text.slice(scanPos + 2, scanPos + 6), 16);
          if (!Number.isNaN(code)) out += String.fromCharCode(code);
          scanPos += 6;
          continue;
        }
        out += ESCAPES[esc] ?? esc;
        scanPos += 2;
        continue;
      }
      out += ch;
      scanPos++;
    }
    return { out, closed: false };
  }

  // 跳过本选项对象中 resultText 之后的剩余部分，直到对象闭合。
  // restInString / restDepth 跨块保持：字符串内容一律按内容字符走，转义引号 \" 不翻转状态，随时可安全暂停续跑。
  function skipOptionRest(): void {
    while (scanPos < text.length) {
      const ch = text[scanPos];
      if (restInString) {
        if (ch === "\\") {
          if (scanPos + 1 >= text.length) return; // 转义字符被块边界切开，等下一块
          scanPos += 2;
          continue;
        }
        if (ch === '"') restInString = false;
        scanPos++;
        continue;
      }
      if (ch === '"') {
        restInString = true;
        scanPos++;
        continue;
      }
      if (ch === "{") {
        restDepth++;
        scanPos++;
        continue;
      }
      if (ch === "}") {
        scanPos++;
        if (restDepth === 0) {
          stage = "options-array";
          return;
        }
        restDepth--;
        continue;
      }
      if (ch === "]") {
        dormant("选项对象未闭合就遇到数组结束符");
        return;
      }
      scanPos++;
    }
  }

  function run(): void {
    while (true) {
      switch (stage) {
        case "seek-title":
        case "seek-description":
        case "seek-options": {
          const marker = stage === "seek-title" ? '"title"' : stage === "seek-description" ? '"description"' : '"options"';
          const follow = stage === "seek-options" ? ":[" : ':"';
          const i = text.indexOf(marker, scanPos);
          if (i === -1) return;
          const saved = scanPos; // 匹配不完整时要退回来，下一块重新定位幂等
          scanPos = i + marker.length;
          const m = matchSeq(follow);
          if (m === 0) {
            scanPos = saved;
            return;
          }
          if (m === -1) return;
          if (stage === "seek-options") {
            stage = "options-array";
          } else {
            stage = stage === "seek-title" ? "read-title" : "read-description";
            strBuf = "";
          }
          continue;
        }
        case "read-title": {
          const r = readString();
          strBuf += r.out;
          if (!r.closed) return;
          handlers.onTitle?.(strBuf);
          stage = "seek-description";
          continue;
        }
        case "read-description": {
          const r = readString();
          if (r.out) handlers.onDescriptionDelta?.(r.out);
          if (!r.closed) return;
          stage = "seek-options";
          continue;
        }
        case "options-array": {
          if (!skipWs()) return;
          if (text[scanPos] === ",") {
            scanPos++;
            if (!skipWs()) return;
          }
          const ch = text[scanPos];
          if (ch === "]") {
            scanPos++;
            stage = "done";
            return;
          }
          if (ch !== "{") {
            dormant("数组元素应为对象");
            return;
          }
          scanPos++;
          stage = "option-key";
          continue;
        }
        case "option-key": {
          if (matchToken('"text"') !== 1) return;
          stage = "option-colon";
          continue;
        }
        case "option-colon": {
          // 与 option-key 拆开：若合在一个状态里，"text" 已消费而 :" 未到时，重入会从 : 处重匹配 "text" 导致误休眠
          if (matchSeq(':"') !== 1) return;
          stage = "read-option-text";
          strBuf = "";
          continue;
        }
        case "read-option-text": {
          const r = readString();
          strBuf += r.out;
          if (!r.closed) return;
          handlers.onOptionText?.(optionIndex, strBuf);
          stage = "seek-result";
          continue;
        }
        case "seek-result": {
          // text 闭合后按字段顺序越过 effects 定位 "resultText"；标记未到齐时原地等下一块
          const i = text.indexOf('"resultText"', scanPos);
          if (i === -1) return;
          const saved = scanPos; // 匹配不完整时要退回来，下一块重新定位幂等
          scanPos = i + '"resultText"'.length;
          const m = matchSeq(':"');
          if (m === 0) {
            scanPos = saved;
            return;
          }
          if (m === -1) return;
          strBuf = "";
          stage = "read-result-text";
          continue;
        }
        case "read-result-text": {
          const r = readString();
          if (r.out) handlers.onResultTextDelta?.(optionIndex, r.out);
          strBuf += r.out;
          if (!r.closed) return;
          handlers.onResultText?.(optionIndex, strBuf);
          optionIndex++; // 选项与它的结果叙述共用同一序号，叙述闭合后才进入下一个选项
          restDepth = 0;
          restInString = false;
          stage = "after-result";
          continue;
        }
        case "after-result": {
          skipOptionRest();
          if (stage === "after-result") return; // 剩余部分没走完（文本耗尽），等下一块
          continue; // 对象已闭合（回到 options-array）或已休眠，回主循环继续
        }
        default:
          return;
      }
    }
  }

  return {
    feed(chunk: string): void {
      if (stage === "done" || stage === "dormant") return;
      text += chunk;
      run();
    },
  };
}
