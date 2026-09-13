const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const express = require('express');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildSync } = require('esbuild');

// 执行前端实际解析与存档校验代码，避免后端自测通过而浏览器拒收。
function loadClientModule(relativePath) {
  const built = buildSync({
    entryPoints: [path.resolve(__dirname, '../../client/src', relativePath)],
    bundle: true, platform: 'node', format: 'cjs', write: false,
    jsx: 'automatic', external: ['react', 'react/*'],
    define: { 'import.meta.env': '{}' },
  });
  const module = { exports: {} };
  new Function('module', 'exports', 'require', built.outputFiles[0].text)(module, module.exports, require);
  return module.exports;
}
const { createFrameParser } = loadClientModule('api/frames.ts');
const { isSnapshot } = loadClientModule('storage/index.ts');
const { GamePage } = loadClientModule('pages/GamePage.tsx');
const { createElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { validateEventOutput } = require('../dist/ai/validate');

test('模型属性兼容数字字符串和小数，仍拒绝缺失、模糊值及越界', () => {
  function event(value) {
    return { title: '校园散步', description: '你来到操场。', options: [0, 1, 2].map(() => ({
      text: '散步', resultText: '你放松了心情。',
      effects: { academics: value, social: 0, energy: 0, money: 0 },
    })) };
  }
  for (const [input, expected] of [[1, 1], [' +1 ', 1], ['0', 0], ['-1', -1],
    [0.5, 1], [-0.5, -1], ['1.6', 2], [0.2, 0], [3, 3], [-2, -2]]) {
    assert.equal(validateEventOutput(event(input)).options[0].effects.academics, expected);
  }
  for (const value of [undefined, null, true, '', ' ', '增加1', '1分', '0x1', [], {}, NaN, Infinity, 3.1, -2.1]) {
    assert.throws(() => validateEventOutput(event(value)), (error) => error.code === 'AI_INVALID_OUTPUT');
  }
});

test('流式终帧保留完整成功和错误响应，兼容分片与末尾无换行', () => {
  for (const terminal of [
    { k: 'end', requestId: '成功', baseRevision: 0, snapshot: { phase: 'pendingChoice' } },
    { k: 'end', requestId: '失败', error: { code: 'AI_TIMEOUT', message: '请求超时', retryable: true } },
  ]) {
    const parser = createFrameParser();
    const wire = JSON.stringify({ k: 'desc', v: '日记正文' }) + '\r\n' + JSON.stringify(terminal);
    const frames = [];
    for (let i = 0; i < wire.length; i += 7) frames.push(...parser.push(wire.slice(i, i + 7)));
    frames.push(...parser.end());
    assert.deepEqual(frames.at(-1), terminal);
  }
});

test('环境配置不受启动目录影响，根目录优先且保留进程变量', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'campusmock-env-'));
  try {
    const dist = path.join(fixture, 'server', 'dist');
    fs.mkdirSync(dist, { recursive: true });
    fs.copyFileSync(path.resolve(__dirname, '../dist/env.js'), path.join(dist, 'env.js'));
    fs.writeFileSync(path.join(fixture, '.env'), 'DEEPSEEK_API_KEY=root-placeholder');
    fs.writeFileSync(path.join(fixture, 'server', '.env'), 'DEEPSEEK_API_KEY=server-placeholder');
    const env = { ...process.env, NODE_PATH: path.resolve(__dirname, '../../node_modules') };
    delete env.DEEPSEEK_API_KEY;
    function check(cwd, expected, injected = {}) {
      const child = spawnSync(process.execPath, ['-e',
        'require(process.argv[1]);require("node:assert/strict").equal(process.env.DEEPSEEK_API_KEY ?? null,JSON.parse(process.argv[2]));',
        path.join(dist, 'env.js'), JSON.stringify(expected ?? null),
      ], { cwd, env: { ...env, ...injected }, encoding: 'utf8' });
      assert.equal(child.status, 0, child.stderr);
    }
    for (const cwd of [fixture, path.join(fixture, 'server'), os.tmpdir()]) {
      check(cwd, 'root-placeholder');
    }
    check(fixture, 'injected-placeholder', { DEEPSEEK_API_KEY: 'injected-placeholder' });
    fs.unlinkSync(path.join(fixture, '.env'));
    check(fixture, 'server-placeholder');
    fs.unlinkSync(path.join(fixture, 'server', '.env'));
    check(fixture, undefined);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

// 模拟入口先导入路由、后加载 .env，避免初始化顺序回归。
delete process.env.DEEPSEEK_API_KEY;
const routes = require('../dist/routes').default;
const { createInitialSnapshot, validateSnapshot } = require('../dist/game/service');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}

test('延迟配置、AI 调用、完整结算与结局快照保持兼容', { timeout: 15000 }, async () => {
  const originalFetch = globalThis.fetch;
  const allowedOrigins = new Set();
  // 本地测试只允许访问本次创建的两个服务器，防止配置回归时误调用付费 API。
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    assert.ok(allowedOrigins.has(url.origin), '测试禁止访问模拟服务器以外的地址');
    return originalFetch(input, { ...init, redirect: 'error' });
  };
  process.env.DEEPSEEK_MODEL = 'ci-mock-model';
  process.env.AI_MAX_ATTEMPTS = '1';
  process.env.AI_TIMEOUT_MS = '2000';
  const upstreamRequests = [];
  let upstreamStatus = 200;
  let invalidEvent = false;
  let numericVariants = false;
  const upstream = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    upstreamRequests.push({ path: req.url, authorization: req.headers.authorization, body: JSON.parse(body) });
    if (upstreamStatus !== 200) {
      res.writeHead(upstreamStatus, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: '模拟上游故障' } }));
      return;
    }
    const isEnding = upstreamRequests.length === 15;
    const content = isEnding
      ? { title: '慢慢找到节奏', description: '你开始适应校园生活。', evaluation: '你认真做出了自己的选择。', advice: '记得留出休息时间。' }
      : {
          title: '第一次去图书馆', description: '你在书架前遇见了同班同学。',
          options: [0, 1, 2].map((i) => ({
            text: `行动 ${i + 1}`, resultText: '你度过了一个充实的下午。',
            effects: { academics: 1, social: 0, energy: -1, money: 0 },
          })),
        };
    if (invalidEvent) content.options[0].effects.energy = 999;
    if (numericVariants) content.options[1].effects = { academics: '1', social: 0.5, energy: '-0.5', money: '0' };
    if (upstreamRequests.at(-1).body.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      const text = JSON.stringify(content);
      for (let i = 0; i < text.length; i += 11) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + 11) } }] })}\n\n`);
      }
      res.end('data: [DONE]\n\n');
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
    }
  });
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  const server = http.createServer(app);

  try {
    process.env.DEEPSEEK_BASE_URL = await listen(upstream);
    allowedOrigins.add(process.env.DEEPSEEK_BASE_URL);
    const baseUrl = await listen(server);
    allowedOrigins.add(baseUrl);
    for (const route of ['events/generate', 'events/choose', 'endings/generate']) {
      const empty = await fetch(`${baseUrl}/api/${route}`, { method: 'POST' });
      assert.equal(empty.status, 400);
      assert.equal((await empty.json()).error.retryable, false);
    }
    let sequence = 0;
    async function post(path, snapshot, extra = {}) {
      const requestId = `回归-${++sequence}`;
      const response = await fetch(`${baseUrl}/api/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, snapshot, ...extra }),
      });
      let body;
      let frames = [];
      if (response.headers.get('content-type')?.includes('application/x-ndjson')) {
        const parser = createFrameParser();
        const text = await response.text();
        for (let i = 0; i < text.length; i += 13) frames.push(...parser.push(text.slice(i, i + 13)));
        frames.push(...parser.end());
        body = frames.findLast((frame) => frame.k === 'end');
        assert.ok(body, '必须收到完整终帧');
      } else {
        body = await response.json();
      }
      assert.equal(body.requestId, requestId);
      return { status: response.status, body, frames };
    }

    let snapshot = createInitialSnapshot();
    const missing = await post('events/generate', snapshot);
    assert.equal(missing.status, 400);
    assert.equal(missing.body.error.code, 'AI_CONFIG_ERROR');
    assert.match(missing.body.error.message, /未配置API密钥/);
    assert.equal(missing.body.error.retryable, false);
    assert.equal(upstreamRequests.length, 0);

    // 配置晚于路由初始化，后续请求仍应正常调用上游。
    process.env.DEEPSEEK_API_KEY = 'ci-placeholder';
    for (let day = 1; day <= 14; day++) {
      // 从实际上一天结算快照进入等待页：所有天数都显示增量草稿，不混入上一天结果。
      const before = JSON.stringify(snapshot);
      for (const description of ['正在逐字生成', '正在逐字生成下一天正文']) {
        const html = renderToStaticMarkup(createElement(GamePage, {
          snapshot, busy: true, waiting: true,
          draft: { title: `第 ${day} 天草稿`, description }, actions: {},
        }));
        assert.ok(html.includes(`第 ${day} 天`));
        assert.ok(html.includes(description), `第 ${day} 天必须显示当前草稿`);
        assert.ok(!html.includes('你选择了'));
        assert.ok(!html.includes('继续写下一篇'));
      }
      assert.equal(JSON.stringify(snapshot), before, '等待展示不得提前修改存档');
      const event = await post('events/generate', snapshot, { profile: { gender: '女', major: '计算机科学' } });
      assert.equal(event.status, 200, JSON.stringify(event.body));
      assert.equal(event.body.baseRevision, snapshot.revision);
      snapshot = event.body.snapshot;
      assert.equal(snapshot.currentEvent.day, day);
      assert.equal(validateSnapshot(snapshot).isValid, true);
      assert.equal(isSnapshot(snapshot), true, '前端必须接受生成的快照');
      const choice = await post('events/choose', snapshot, {
        eventId: snapshot.currentEvent.id, optionId: snapshot.currentEvent.options[0].id,
      });
      assert.equal(choice.status, 200);
      snapshot = choice.body.snapshot;
      assert.equal(snapshot.history.length, day);
      assert.equal(validateSnapshot(snapshot).isValid, true);
      assert.equal(isSnapshot(snapshot), true, '前端必须接受结算快照并能够刷新恢复');
      assert.equal(snapshot.phase, day === 14 ? 'pendingEnding' : 'showResult');
    }
    const ending = await post('endings/generate', snapshot);
    assert.equal(ending.status, 200);
    assert.equal(ending.body.snapshot.phase, 'ended');
    assert.equal(ending.body.snapshot.currentEvent, null);
    assert.equal(ending.body.snapshot.revision, 29);
    assert.equal(validateSnapshot(ending.body.snapshot).isValid, true);
    assert.equal(isSnapshot(ending.body.snapshot), true);
    assert.equal(upstreamRequests.length, 15);
    assert.ok(upstreamRequests.every((request) => request.path === '/chat/completions'));
    assert.match(upstreamRequests[1].body.messages[1].content, /行动 1/);
    assert.match(upstreamRequests[0].body.messages[1].content, /计算机科学/);
    assert.ok(upstreamRequests.every((request) => request.authorization === 'Bearer ci-placeholder'));
    assert.ok(upstreamRequests.every((request) => request.body.model === 'ci-mock-model'));

    process.env.AI_MAX_ATTEMPTS = '3';
    invalidEvent = true;
    const countBeforeInvalid = upstreamRequests.length;
    const failedDraft = await post('events/generate', createInitialSnapshot());
    assert.equal(upstreamRequests.length, countBeforeInvalid + 1, '校验失败不得自动重新生成');
    assert.equal(failedDraft.body.error.code, 'AI_INVALID_OUTPUT');
    assert.ok(failedDraft.frames.some((frame) => frame.k === 'desc'), '覆盖已有正文显示后校验失败');
    assert.ok(failedDraft.frames.every((frame) => frame.k !== 'reset'));
    assert.equal(failedDraft.body.snapshot, undefined, '失败不提交新快照');
    const { generateEvent, loadAiConfig } = require('../dist/ai');
    const countBeforeJson = upstreamRequests.length;
    await assert.rejects(generateEvent({ day: 1, attributes: createInitialSnapshot().attributes, history: [] }, loadAiConfig()),
      (error) => error.code === 'AI_INVALID_OUTPUT');
    assert.equal(upstreamRequests.length, countBeforeJson + 1, '非流式事件也只能调用一次');
    invalidEvent = false;
    numericVariants = true;
    const countBeforeNormalized = upstreamRequests.length;
    const manualRetry = await post('events/generate', createInitialSnapshot());
    assert.equal(manualRetry.body.snapshot.phase, 'pendingChoice', '手动重试仍能生成事件');
    assert.equal(upstreamRequests.length, countBeforeNormalized + 1, '数值规范化不增加模型调用');
    const normalized = manualRetry.body.snapshot;
    assert.deepEqual(normalized.currentEvent.options[1].effects, { academics: 1, social: 1, energy: -1, money: 0 });
    const settledNormalized = await post('events/choose', normalized, {
      eventId: normalized.currentEvent.id, optionId: normalized.currentEvent.options[1].id,
    });
    assert.equal(settledNormalized.status, 200);
    assert.equal(isSnapshot(settledNormalized.body.snapshot), true, '规范化结果必须能够结算和存档');
    numericVariants = false;

    for (const [status, code, retryable] of [
      [401, 'AI_CONFIG_ERROR', false],
      [429, 'AI_RATE_LIMIT', true],
      [500, 'AI_UPSTREAM_ERROR', true],
    ]) {
      upstreamStatus = status;
      const countBeforeFailure = upstreamRequests.length;
      const failed = await post('events/generate', createInitialSnapshot());
      assert.equal(upstreamRequests.length, countBeforeFailure + 1, '上游故障不得自动重试事件');
      assert.equal(failed.status, 200, '流已开始，上游错误通过终帧传递');
      assert.equal(failed.body.error.code, code);
      assert.equal(failed.body.error.retryable, retryable);
    }
  } finally {
    globalThis.fetch = originalFetch;
    server.closeAllConnections();
    upstream.closeAllConnections();
    await Promise.all([server, upstream].map((item) => new Promise((resolve) => item.close(resolve))));
  }
});

// 针对完整审查发现的边界回归，全部使用内存数据，不调用真实模型。
test('前端收到终帧立即结束读取，离开流程能够取消挂起请求', async () => {
  const api = loadClientModule('api/gameApi.ts');
  const original = global.fetch;
  let cancelled = false;
  try {
    global.fetch = async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"k":"end","requestId":"done"}\n'));
        // 刻意不关闭流，客户端应以终帧为结束标志。
      },
      cancel() { cancelled = true; },
    }), { headers: { 'Content-Type': 'application/x-ndjson' } });
    const result = await api.generateEvent(createInitialSnapshot(), 'done');
    assert.equal(result.requestId, 'done');
    assert.equal(cancelled, true);
    global.fetch = (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('已取消', 'AbortError')), { once: true });
    });
    const pending = api.generateEvent(createInitialSnapshot(), 'cancel');
    api.cancelPendingRequest();
    await assert.rejects(pending, e => e.name === 'AbortError');
  } finally { global.fetch = original; }
});

test('空响应不会绕过前端校验；存档被清空或更新后不覆盖其他标签页', () => {
  const { isApiResult } = loadClientModule('state/useGame.ts');
  assert.equal(isApiResult({ requestId: 'audit', baseRevision: 0, snapshot: null }), false);
  const storage = loadClientModule('storage/index.ts');
  const previous = global.localStorage;
  const values = new Map();
  global.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  try {
    const initial = createInitialSnapshot();
    storage.loadSnapshot();
    assert.equal(storage.saveSnapshot(initial), true);
    values.clear();
    assert.equal(storage.saveSnapshot(initial), false);
    assert.equal(storage.hasStorageConflict(), true);
    assert.equal(values.size, 0);
    storage.loadSnapshot();
    assert.equal(storage.saveSnapshot(initial), true);
    values.set(storage.STORAGE_KEY, JSON.stringify({ ...initial, revision: 2 }));
    assert.equal(storage.saveSnapshot(initial), false);
    assert.equal(JSON.parse(values.get(storage.STORAGE_KEY)).revision, 2);
  } finally { global.localStorage = previous; }
});

test('字段乱序、逐字符分片和转义不影响正文及选项提取', () => {
  const { createEventStreamParser } = require('../dist/ai/streamParse');
  const source = {
    description: '你听见有人说："你好"。\n新的一天。',
    options: [0, 1, 2].map(() => ({ resultText: '读完一页书。', effects: { money: 500, energy: 0, social: 0, academics: 0 }, text: '去图书馆' })),
    title: '校园一角',
  };
  for (const chunkSize of [1, 2, 7, 999]) {
    let title = '', description = '';
    const options = [], results = [];
    const parser = createEventStreamParser({
      onTitle: text => title = text, onDescriptionDelta: text => description += text,
      onOptionText: (i, text) => options[i] = text, onResultText: (i, text) => results[i] = text,
    });
    const wire = JSON.stringify(source).replace('你', '\\u4f60');
    for (let i = 0; i < wire.length; i += chunkSize) parser.feed(wire.slice(i, i + chunkSize));
    assert.equal(description, source.description);
    assert.equal(title, source.title);
    assert.deepEqual(options, source.options.map(o => o.text));
    assert.deepEqual(results, source.options.map(o => o.resultText));
  }
  assert.equal(validateEventOutput(source).options[0].effects.money, 500);
  source.options[0].effects.money = -500;
  assert.equal(validateEventOutput(source).options[0].effects.money, -500);
  source.options[0].effects.money = 501;
  assert.throws(() => validateEventOutput(source));
  source.options[0].effects.money = 0;
  source.description = '今天参加军训。';
  assert.throws(() => validateEventOutput(source), e => e.code === 'AI_INVALID_OUTPUT');
});

test('空上游响应分类正确，只有心跳会超时，取消不会触发结局重试', async () => {
  const { chatJSON, chatJSONStream, chatJSONWithRetry } = require('../dist/ai/deepseek');
  const original = global.fetch;
  const cfg = { apiKey: 'mock', baseUrl: 'http://mock', model: 'mock', temperature: 1, timeoutMs: 40, maxAttempts: 3 };
  try {
    global.fetch = async () => new Response('null');
    await assert.rejects(chatJSON(cfg, '', ''), e => e.code === 'AI_UPSTREAM');
    global.fetch = async (_url, init) => new Response(new ReadableStream({ start(controller) {
      const ticker = setInterval(() => controller.enqueue(new TextEncoder().encode(': heartbeat\n\n')), 5);
      init.signal.addEventListener('abort', () => {
        clearInterval(ticker);
        controller.error(new DOMException('请求已取消', 'AbortError'));
      }, { once: true });
    } }));
    await assert.rejects(chatJSONStream(cfg, '', '', () => {}), e => e.code === 'AI_TIMEOUT');
    const abort = new AbortController(); abort.abort();
    let attempts = 0;
    global.fetch = async () => { attempts++; return new Response('{}'); };
    await assert.rejects(chatJSONWithRetry({ ...cfg, signal: abort.signal }, '', () => '', raw => raw));
    assert.equal(attempts, 0);
  } finally { global.fetch = original; }
});

test('并发限制、请求频率、关闭取消和总时限生效', async () => {
  const { EventEmitter } = require('node:events');
  const { createGenerationGuard } = require('../dist/game/requestGuard');
  function response() {
    const res = new EventEmitter(); res.locals = {};
    res.setHeader = () => {};
    res.status = code => { res.code = code; return res; };
    res.json = body => { res.body = body; return res; };
    return res;
  }
  const guard = createGenerationGuard({ concurrency: 1, perMinute: 2, timeoutMs: 30 });
  const req = { body: { requestId: 'guard' } };
  const first = response(); guard(req, first, () => {});
  const blocked = response(); guard(req, blocked, () => assert.fail('并发已满'));
  assert.equal(blocked.code, 429);
  first.emit('close');
  assert.equal(first.locals.aiSignal.aborted, true);
  const second = response(); guard(req, second, () => {});
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(second.locals.aiSignal.aborted, true);
  second.emit('finish'); second.emit('close');
  const limited = response(); guard(req, limited, () => assert.fail('频率已满'));
  assert.equal(limited.code, 429);
});

test('首行空白选项结算有效，重复选择返回既有结果且拒绝改选', () => {
  const { chooseOption } = require('../dist/game/controller');
  const snapshot = createInitialSnapshot(); snapshot.phase = 'pendingChoice';
  snapshot.currentEvent = { id: 'audit', day: 1, title: '校园', description: '校园生活', options: [0, 1, 2].map(i => ({
    id: String(i), text: '\n 去图书馆 ', resultText: '读完一页书。', effects: { academics: 1, social: 0, energy: 0, money: 500 },
  })) };
  const req = { body: { requestId: 'audit', snapshot, eventId: 'audit', optionId: '0' } };
  let result;
  const res = { json: value => result = value, status: code => { res.code = code; return res; } };
  chooseOption(req, res);
  assert.equal(validateSnapshot(result.snapshot).isValid, true);
  assert.equal(isSnapshot(result.snapshot), true);
  const settled = result.snapshot; req.body.snapshot = settled;
  chooseOption(req, res);
  assert.deepEqual(result.snapshot, settled);
  req.body.optionId = '1'; chooseOption(req, res);
  assert.equal(result.error.code, 'OPTION_MISMATCH');
});
