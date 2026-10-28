import assert from 'node:assert/strict';
import { isSignalUrl, pingSignal } from '../src/net/signal';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServer } = require('../../server/server.js');

(async () => {
  assert.equal(isSignalUrl('wss://signal.example.com'), true);
  assert.equal(isSignalUrl('ws://10.0.0.5:8080/x'), true);
  assert.equal(isSignalUrl('  wss://a.b '), true);
  for (const bad of ['', 'https://a.b', 'signal.example.com', 'wss://', 'ws://a b']) assert.equal(isSignalUrl(bad), false, bad);

  const srv = createServer({ port: 18082, host: '127.0.0.1' });
  const ms = await pingSignal('ws://127.0.0.1:18082');
  assert.equal(typeof ms, 'number');
  assert.ok(ms! >= 0 && ms! < 3000);
  assert.equal(await pingSignal('ws://127.0.0.1:18099', 2000), null, 'closed port');
  assert.equal(await pingSignal('nope'), null, 'not a ws url');

  // A server that never answers hits the timeout.
  class Silent { onopen: any; onerror: any; onclose: any; close() {} }
  const t0 = Date.now();
  assert.equal(await pingSignal('ws://x.y', 300, Silent), null);
  assert.ok(Date.now() - t0 >= 280);
  // No WebSocket available at all
  assert.equal(await pingSignal('ws://x.y', 300, null), null);
  srv.close?.();
  console.log('signal: all tests OK');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
