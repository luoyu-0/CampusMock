// 流式解析器离线夹具测试：固定事件 JSON 按不同块大小切块喂入 parser，断言所有回调产物与期望一致且零休眠。
// 纯离线、不调 API、无密钥；块大小 1 能确定性复现块边界类 bug（如 "text": 被切开导致的误休眠）。
// 在 server 目录运行：npx tsx src/ai/scripts/stream-parse-test.ts
import { createEventStreamParser, type EventStreamParserHandlers } from "../streamParse.js";

// 夹具即期望：ASCII 引号经 JSON.stringify 转义成 \"（覆盖字符串读取与转义状态），
// 描述含转义换行，effects 为负数，字段顺序按提示词约定 text → effects → resultText。
const FIXTURE = {
  title: "社团招新前的犹豫",
  description:
    '午休时教学楼前摆满摊位，学长塞来一张传单："今天就截止报名了。"\n你想起两天前没敢开口的自己，手心出了汗。',
  options: [
    {
      text: "当场填表报名，交 30 元社费",
      effects: { academics: 0, social: 2, energy: -1, money: -30 },
      resultText: '你签下名字，部长说"欢迎"，你点头笑了。',
    },
    {
      text: "收下传单说回去想想，转身先去食堂",
      effects: { academics: 0, social: 0, energy: 0, money: 0 },
      resultText: "传单被你折进兜里，这件事悬在心里一下午。",
    },
    {
      text: "拉着室友一起看，让室友帮着参谋",
      effects: { academics: 0, social: 1, energy: -1, money: 0 },
      resultText: '室友说"你想去就去"，你们聊了一路。',
    },
  ],
};

const RAW = JSON.stringify(FIXTURE);

interface RunResult {
  titleFull: string | null;
  descriptionDeltas: string;
  optionCloses: Array<{ index: number; text: string }>;
  resultDeltas: string[];
  resultCloses: Array<{ index: number; text: string }>;
  dormantCount: number;
}

function run(raw: string, chunkSize: number): RunResult {
  const result: RunResult = {
    titleFull: null,
    descriptionDeltas: "",
    optionCloses: [],
    resultDeltas: [],
    resultCloses: [],
    dormantCount: 0,
  };
  const handlers: EventStreamParserHandlers = {
    onTitle: (title) => {
      result.titleFull = title;
    },
    onDescriptionDelta: (delta) => {
      result.descriptionDeltas += delta;
    },
    onOptionText: (index, text) => {
      result.optionCloses.push({ index, text });
    },
    onResultTextDelta: (index, delta) => {
      result.resultDeltas[index] = (result.resultDeltas[index] ?? "") + delta;
    },
    onResultText: (index, text) => {
      result.resultCloses.push({ index, text });
    },
  };
  const originalWarn = console.warn;
  console.warn = () => {
    result.dormantCount++;
  };
  try {
    const parser = createEventStreamParser(handlers);
    if (chunkSize >= raw.length) {
      parser.feed(raw);
    } else {
      for (let i = 0; i < raw.length; i += chunkSize) {
        parser.feed(raw.slice(i, i + chunkSize));
      }
    }
  } finally {
    console.warn = originalWarn;
  }
  return result;
}

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  if (actual === expected) return;
  failures++;
  console.error(`    不通过：${label}`);
  console.error(`      期望：${JSON.stringify(expected)}`);
  console.error(`      实际：${JSON.stringify(actual)}`);
}

console.log(`流式解析器离线夹具测试（夹具 ${RAW.length} 字符）`);
for (const size of [1, 2, 3, 7, Number.POSITIVE_INFINITY]) {
  const label = Number.isFinite(size) ? `块大小 ${size}` : "整块一次喂入";
  const before = failures;
  const r = run(RAW, size);
  check("标题闭合值", r.titleFull, FIXTURE.title);
  check("描述增量拼接", r.descriptionDeltas, FIXTURE.description);
  FIXTURE.options.forEach((option, index) => {
    check(`选项 ${index} 闭合序号`, r.optionCloses[index]?.index, index);
    check(`选项 ${index} 闭合文本`, r.optionCloses[index]?.text, option.text);
    check(`结果 ${index} 增量拼接`, r.resultDeltas[index], option.resultText);
    check(`结果 ${index} 闭合序号`, r.resultCloses[index]?.index, index);
    check(`结果 ${index} 闭合文本`, r.resultCloses[index]?.text, option.resultText);
  });
  check("休眠次数", r.dormantCount, 0);
  console.log(`${label}：${failures === before ? "通过" : `不通过（${failures - before} 项）`}`);
}

if (failures > 0) {
  console.error(`共 ${failures} 项不通过。`);
  process.exitCode = 1;
} else {
  console.log("全部通过。");
}
