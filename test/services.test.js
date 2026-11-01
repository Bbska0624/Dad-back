import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

test('public services provide localized cards, prices, images and details', async () => {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/services`;
  try {
    const response = await fetch(base);
    assert.equal(response.status, 200);
    const items = await response.json();
    assert.equal(items.length, 3);
    for (const item of items) {
      assert.ok(item.title.mn && item.title.en && item.text.mn && item.text.en);
      assert.ok(item.price.includes('₮'));
      assert.ok(item.image.src.startsWith('/assets/services/'));
      assert.ok(item.features.every((feature) => feature.mn && feature.en));
      const detail = await fetch(`${base}/${item.id}`);
      assert.deepEqual(await detail.json(), item);
    }
    assert.equal((await fetch(`${base}/missing`)).status, 404);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
