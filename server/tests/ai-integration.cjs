const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const express = require('express');

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

test('延迟配置、AI 调用、完整结算与结局快照保持兼容', async () => {
  const upstreamRequests = [];
  const upstream = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    upstreamRequests.push({ path: req.url, body: JSON.parse(body) });
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
    const baseUrl = await listen(server);
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
    assert.equal(missing.body.error.retryable, false);
    assert.equal(upstreamRequests.length, 0);

    // 配置晚于路由初始化，后续请求仍应正常调用上游。
    process.env.DEEPSEEK_API_KEY = 'ci-placeholder';
    for (let day = 1; day <= 14; day++) {
      const event = await post('events/generate', snapshot);
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
  } finally {
    server.closeAllConnections();
    upstream.closeAllConnections();
    await Promise.all([server, upstream].map((item) => new Promise((resolve) => item.close(resolve))));
  }
});
