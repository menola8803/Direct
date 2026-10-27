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
  assert.deepEqual(b.inbox[0], { type: 'relay', from: a.pub, payload: { n: 'x', c: 'y' } }, 'B ska få paketet från A');

  a.ws.send(JSON.stringify({ type: 'relay', to: encodeBase64(E.publicKey), payload: { n: '1', c: '2' } }));
  await wait(100);
  assert.equal(a.inbox[0].type, 'offline', 'okänd mottagare ger offline');

  await assert.rejects(client(url, E, { cheat: true }), /closed 4003/, 'falsk signatur nekas');

  b.ws.send(JSON.stringify({ type: 'relay', to: a.pub, payload: 'sträng' }));
  await wait(100);
  assert.equal(a.inbox.length, 1, 'payload som inte är objekt ignoreras');

  const b2 = await client(url, B); // samma nyckel ansluter igen
  await wait(100);
  assert.equal(srv.online.get(b.pub), srv.online.get(b2.pub));
  await srv.close();
  console.log('server: alla tester OK');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
