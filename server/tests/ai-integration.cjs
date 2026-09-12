const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const express = require('express');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

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
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
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
      const body = await response.json();
      assert.equal(body.requestId, requestId);
      return { status: response.status, body };
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
      const event = await post('events/generate', snapshot, { profile: { gender: '女', major: '计算机科学' } });
      assert.equal(event.status, 200, JSON.stringify(event.body));
      assert.equal(event.body.baseRevision, snapshot.revision);
      snapshot = event.body.snapshot;
      assert.equal(snapshot.currentEvent.day, day);
      assert.equal(validateSnapshot(snapshot).isValid, true);
      const choice = await post('events/choose', snapshot, {
        eventId: snapshot.currentEvent.id, optionId: snapshot.currentEvent.options[0].id,
      });
      assert.equal(choice.status, 200);
      snapshot = choice.body.snapshot;
      assert.equal(snapshot.history.length, day);
      assert.equal(validateSnapshot(snapshot).isValid, true);
    }
    const ending = await post('endings/generate', snapshot);
    assert.equal(ending.status, 200);
    assert.equal(ending.body.snapshot.phase, 'ended');
    assert.equal(ending.body.snapshot.currentEvent, null);
    assert.equal(ending.body.snapshot.revision, 29);
    assert.equal(validateSnapshot(ending.body.snapshot).isValid, true);
    assert.equal(upstreamRequests.length, 15);
    assert.ok(upstreamRequests.every((request) => request.path === '/chat/completions'));
    assert.match(upstreamRequests[1].body.messages[1].content, /行动 1/);
    assert.match(upstreamRequests[0].body.messages[1].content, /计算机科学/);
    assert.ok(upstreamRequests.every((request) => request.authorization === 'Bearer ci-placeholder'));
    assert.ok(upstreamRequests.every((request) => request.body.model === 'ci-mock-model'));

    for (const [status, code, retryable] of [
      [401, 'AI_CONFIG_ERROR', false],
      [429, 'AI_RATE_LIMIT', true],
      [500, 'AI_UPSTREAM_ERROR', true],
    ]) {
      upstreamStatus = status;
      const failed = await post('events/generate', createInitialSnapshot());
      assert.equal(failed.status, 400);
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
