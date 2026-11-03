const assert = require('node:assert/strict');
const WebSocket = require('ws');
const nacl = require('tweetnacl');
const { decodeBase64, encodeBase64 } = require('tweetnacl-util');
const { createServer } = require('./server');

function client(url, kp, { cheat } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url); const inbox = [];
    ws.on('message', raw => {
      const m = JSON.parse(raw);
      if (m.type === 'challenge') {
        const sig = nacl.sign.detached(new TextEncoder().encode(cheat ? 'fel' : m.nonce), kp.secretKey);
        ws.send(JSON.stringify({ type: 'hello', sign: encodeBase64(kp.publicKey), sig: encodeBase64(sig) }));
      } else if (m.type === 'ready') resolve({ ws, inbox, pub: encodeBase64(kp.publicKey) });
      else inbox.push(m);
    });
    ws.on('close', c => reject(new Error('closed ' + c)));
    ws.on('error', reject);
  });
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const srv = createServer({ port: 18080, host: '127.0.0.1' });
  const url = 'ws://127.0.0.1:18080';
  const A = nacl.sign.keyPair(), B = nacl.sign.keyPair(), E = nacl.sign.keyPair();
  const a = await client(url, A), b = await client(url, B);

  a.ws.send(JSON.stringify({ type: 'relay', to: b.pub, payload: { n: 'x', c: 'y' } }));
  await wait(100);
  assert.deepEqual(b.inbox[0], { type: 'relay', from: a.pub, payload: { n: 'x', c: 'y' } }, 'B should receive the packet from A');

  a.ws.send(JSON.stringify({ type: 'relay', to: encodeBase64(E.publicKey), payload: { n: '1', c: '2' } }));
  await wait(100);
  assert.equal(a.inbox[0].type, 'offline', 'unknown recipient returns offline');

  await assert.rejects(client(url, E, { cheat: true }), /closed 4003/, 'falsk signatur nekas');

  b.ws.send(JSON.stringify({ type: 'relay', to: a.pub, payload: 'string' }));
  await wait(100);
  assert.equal(a.inbox.length, 1, 'non-object payloads are ignored');

  // Valid JSON that is not an object (null, a number, a list) used to throw inside the message handler and stop the whole server.
  for (const j of ['null', '5', '[]', '"x"', 'true']) { a.ws.send(j); b.ws.send(j); }
  const raw = new (require('ws'))(url); await new Promise(r => raw.on('open', r));
  for (const j of ['null', '5', '[]']) raw.send(j); // before login too
  await wait(100);
  a.ws.send(JSON.stringify({ type: 'relay', to: b.pub, payload: { n: 'again', c: 'y' } }));
  await wait(100);
  assert.equal(b.inbox.at(-1).payload.n, 'again', 'the server is still up after non-object JSON');
  raw.close();

  const b2 = await client(url, B); // samma nyckel ansluter igen
  await wait(100);
  assert.equal(srv.online.get(b.pub), srv.online.get(b2.pub));
  await srv.close();

  // A connection that stops answering is dropped, one that answers stays. (A phone that loses its network says nothing.)
  {
    const s2 = createServer({ port: 18081, host: '127.0.0.1', pingMs: 100 });
    const u2 = 'ws://127.0.0.1:18081';
    const live = await client(u2, A), gone = await client(u2, B);
    gone.ws._socket.pause(); // it can no longer read, so it cannot answer the server's question
    await wait(600);
    assert.equal(s2.online.has(live.pub), true, 'a connection that answers stays');
    assert.equal(s2.online.has(gone.pub), false, 'one that does not answer is dropped');
    live.ws.send(JSON.stringify({ type: 'relay', to: gone.pub, payload: { n: 'x', c: 'y' } }));
    await wait(100);
    assert.equal(live.inbox.at(-1)?.type, 'offline', 'and the sender is told the other is offline');
    live.ws.send(JSON.stringify({ type: 'relay', to: live.pub, payload: { hb: 1 } })); // a packet to yourself comes straight back (the heartbeat of the app relies on it)
    await wait(100);
    assert.deepEqual(live.inbox.at(-1), { type: 'relay', from: live.pub, payload: { hb: 1 } });
    gone.ws.terminate();
    await s2.close();
  }
  console.log('server: all tests OK');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
