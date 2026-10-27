// Direct signaleringsserver.
// - Klienter bevisar sin identitet med en signatur (challenge/response).
// - The server forwards encrypted packets between two connected keys.
// - The server stores no messages and cannot read the content (it is end-to-end encrypted).
// - Messages, calls and files go directly between the phones (WebRTC), not through the server.
const { WebSocketServer } = require('ws');
const nacl = require('tweetnacl');
const { decodeBase64, encodeBase64 } = require('tweetnacl-util');

const MAX_PAYLOAD = 64 * 1024;       // byte per paket
const MAX_PER_MIN = 120;             // paket per minut och anslutning
const HELLO_TIMEOUT_MS = 10_000;

function createServer(opts = {}) {
  const wss = new WebSocketServer({ port: opts.port ?? 8080, host: opts.host, maxPayload: MAX_PAYLOAD });
  const online = new Map(); // signPub (base64) -> ws

  wss.on('connection', ws => {
    const nonce = encodeBase64(nacl.randomBytes(24));
    let who = null, count = 0;
    const reset = setInterval(() => { count = 0; }, 60_000);
    const timer = setTimeout(() => { if (!who) ws.close(4001, 'hello timeout'); }, HELLO_TIMEOUT_MS);
    const send = o => ws.readyState === 1 && ws.send(JSON.stringify(o));
    send({ type: 'challenge', nonce });

    ws.on('message', raw => {
      if (++count > MAX_PER_MIN) return ws.close(4008, 'rate limit');
      let m; try { m = JSON.parse(raw.toString()); } catch { return; }
      if (!who) {
        if (m.type !== 'hello' || typeof m.sign !== 'string' || typeof m.sig !== 'string') return;
        try {
          const pub = decodeBase64(m.sign);
          if (pub.length !== 32 || !nacl.sign.detached.verify(new TextEncoder().encode(nonce), decodeBase64(m.sig), pub)) return ws.close(4003, 'bad signature');
        } catch { return ws.close(4003, 'bad hello'); }
        who = m.sign;
        const old = online.get(who);
        if (old && old !== ws) old.close(4000, 'replaced');
        online.set(who, ws);
        clearTimeout(timer);
        return send({ type: 'ready' });
      }
      if (m.type === 'relay' && typeof m.to === 'string' && typeof m.payload === 'object' && m.payload) {
        const peer = online.get(m.to);
        if (peer && peer.readyState === 1) peer.send(JSON.stringify({ type: 'relay', from: who, payload: m.payload }));
        else send({ type: 'offline', to: m.to });
      }
    });
    ws.on('close', () => { clearInterval(reset); clearTimeout(timer); if (who && online.get(who) === ws) online.delete(who); });
    ws.on('error', () => {});
  });
  return { wss, online, close: () => new Promise(r => { wss.clients.forEach(c => c.terminate()); wss.close(() => r()); }) };
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  createServer({ port });
  console.log(`Direct signaling listening on port ${port}`);
}
