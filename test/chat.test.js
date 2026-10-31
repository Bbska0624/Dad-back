// POST /api/chat тест. Gemini-г жинхэнээр дуудахгүй: хуурамч fetch, хуурамч generateReply ашиглана.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { useStore } from '../src/store.js';
import { createMemoryStore } from '../src/store/memory.js';

useStore(createMemoryStore());
import { generateReply } from '../src/services/gemini.js';

async function withServer(options, fn) {
  const server = createApp(options).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}/api`);
  } finally {
    server.close();
  }
}

const post = async (base, body) => {
  const res = await fetch(`${base}/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { res, body: await res.json() };
};

test('POST /chat хариу буцаана, түүхийг сүүлийн 10 болгоно', async () => {
  let received;
  const fake = async (input) => { received = input; return { reply: 'Сайн байна уу!' }; };
  await withServer({ generateReply: fake }, async (base) => {
    const history = Array.from({ length: 15 }, (_, i) => ({ role: i % 2 ? 'user' : 'assistant', content: `m${i}` }));
    const { res, body } = await post(base, { message: '  Төлбөр хэд вэ?  ', lang: 'mn', history });
    assert.equal(res.status, 200);
    assert.deepEqual(body, { reply: 'Сайн байна уу!' });
    assert.equal(received.message, 'Төлбөр хэд вэ?');
    assert.equal(received.history.length, 10);
    assert.equal(received.history[0].content, 'm5');
  });
});

test('POST /chat буруу оролтод 400 validation_error', async () => {
  await withServer({ generateReply: async () => ({ reply: 'x' }) }, async (base) => {
    const cases = [
      [{ message: '', lang: 'mn' }, 'message'],
      [{ message: 'a'.repeat(501), lang: 'mn' }, 'message'],
      [{ message: 'hi', lang: 'fr' }, 'lang'],
      [{ message: 'hi', lang: 'en', history: [{ role: 'system', content: 'x' }] }, 'history'],
      [{ message: 'hi', lang: 'en', history: 'nope' }, 'history'],
    ];
    for (const [input, field] of cases) {
      const { res, body } = await post(base, input);
      assert.equal(res.status, 400, JSON.stringify(input));
      assert.equal(body.error.code, 'validation_error');
      assert.ok(body.error.fields[field], field);
    }
  });
});

test('POST /chat буруу JSON бол 400', async () => {
  await withServer({ generateReply: async () => ({ reply: 'x' }) }, async (base) => {
    const res = await fetch(`${base}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'validation_error');
  });
});

test('POST /chat rate limit: хязгаар давбал 429 rate_limited', async () => {
  await withServer({ generateReply: async () => ({ reply: 'x' }), chatLimit: { windowMs: 60_000, max: 2 } }, async (base) => {
    const ok = { message: 'hi', lang: 'en' };
    assert.equal((await post(base, ok)).res.status, 200);
    assert.equal((await post(base, ok)).res.status, 200);
    const { res, body } = await post(base, ok);
    assert.equal(res.status, 429);
    assert.equal(body.error.code, 'rate_limited');
    assert.ok(res.headers.get('retry-after'));
  });
});

// --- Gemini service ---

const jsonResponse = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('gemini: зөв хүсэлт илгээж, хариуг задлана', async () => {
  let call;
  const fetchImpl = async (url, init) => {
    call = { url, init, body: JSON.parse(init.body) };
    return jsonResponse(200, { candidates: [{ content: { parts: [{ text: ' Hello ' }, { text: 'there' }] } }] });
  };
  const result = await generateReply(
    { message: 'Q', lang: 'en', history: [{ role: 'assistant', content: 'greeting' }, { role: 'user', content: 'u1' }, { role: 'assistant', content: 'a1' }] },
    { fetchImpl, env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' } },
  );
  assert.deepEqual(result, { reply: 'Hello there' });
  assert.match(call.url, /\/test-model:generateContent$/);
  assert.equal(call.init.headers['x-goog-api-key'], 'test-key');
  // Эхний assistant мэндчилгээ хасагдаж, user-ээр эхэлнэ
  assert.deepEqual(call.body.contents.map((c) => c.role), ['user', 'model', 'user']);
  assert.equal(call.body.contents.at(-1).parts[0].text, 'Q');
  assert.match(call.body.systemInstruction.parts[0].text, /Magic Code AI/);
});

test('gemini: key байхгүй бол configuration_error', async () => {
  await assert.rejects(generateReply({ message: 'Q', lang: 'mn' }, { env: {} }), { code: 'configuration_error' });
});

test('gemini: алдааны кодуудыг хөрвүүлнэ, key-г ил гаргахгүй', async () => {
  const env = { GEMINI_API_KEY: 'secret' };
  const original = console.error;
  console.error = () => {};
  try {
    for (const [status, code] of [[429, 'rate_limited'], [403, 'configuration_error'], [500, 'ai_error']]) {
      const fetchImpl = async () => jsonResponse(status, { error: { message: 'API key secret invalid' } });
      await assert.rejects(generateReply({ message: 'Q', lang: 'mn' }, { fetchImpl, env }), (err) => {
        assert.equal(err.code, code);
        assert.doesNotMatch(err.message, /secret/);
        return true;
      });
    }
    const empty = async () => jsonResponse(200, { candidates: [{ finishReason: 'SAFETY' }] });
    await assert.rejects(generateReply({ message: 'Q', lang: 'mn' }, { fetchImpl: empty, env }), { code: 'ai_error' });
    const down = async () => { throw new Error('ECONNREFUSED'); };
    await assert.rejects(generateReply({ message: 'Q', lang: 'mn' }, { fetchImpl: down, env }), { code: 'ai_error' });
  } finally {
    console.error = original;
  }
});
