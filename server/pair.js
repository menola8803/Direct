// Direct: mailboxes for one-time pairing codes.
//
// Two phones that share a short code (4829-17305-6) add each other without a QR code. The code is the password of a
// password-authenticated key exchange (see app/src/core/pair.ts); this file only keeps the mail between the two phones:
//
//   A (made the code)   pair-open  {box, Y}            leaves its public value in the mailbox "box" (the first 4 digits)
//   B (typed the code)  pair-claim {box}               gets Y back, and is the only one who may answer this code
//   B                   pair-join  {box, Y, sealed}    its own public value and its contact card, sealed with the shared key
//   A                   pair-reply {box, sealed}       its own card, sealed, once it has opened B's
//   either              pair-poll  {box}               asks for what is waiting (for a phone that was offline)
//   either              pair-end   {box}               done, or give up (the other phone is told)
//
// The server sees public values and sealed boxes. Nothing in them lets anyone check a guess of the code offline (that is what
// the key exchange is for), and nothing here can open a sealed card. A wrong code is found out by A, who then ends the box:
// one try per code, so someone who has not got the code succeeds with a chance of about 1 in 100 000 and only if he also
// happened to name the right box. A phone that has the right code and a wrong guess burns the code, which is why the app
// checks the last digit before it asks the server anything.
//
// Everything is in memory and for at most 24 hours. A server that restarts forgets all boxes; the phone that made the code
// opens it again when it reconnects.
const B64_32 = /^[A-Za-z0-9+/]{43}=$/;       // 32 bytes in base64
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const BOX = /^\d{4}$/;
const MAX_SEALED = 2048;                     // base64 characters; a sealed card is a few hundred

function createPairs(opts = {}) {
  const now = opts.now || Date.now;
  const TTL_MAX = opts.ttlMs ?? 24 * 3600e3;
  const CLAIM_MS = opts.claimMs ?? 3 * 60e3;           // a claim that is not followed by a join is let go after this
  const MAX_BOXES = opts.maxBoxes ?? 2000;
  const PER_OWNER = opts.perOwner ?? 5;
  const lim = {
    fail: { max: opts.failsPerIp ?? 12, win: opts.failWinMs ?? 600e3, m: new Map() },         // wrong or used boxes, per address
    failAll: { max: opts.failsAll ?? 100, win: opts.failWinMs ?? 600e3, m: new Map() },       // the same for the whole server
    open: { max: opts.opensPerIp ?? 30, win: opts.openWinMs ?? 3600e3, m: new Map() },
    ops: { max: opts.opsPerKey ?? 60, win: 60e3, m: new Map() },
  };
  const boxes = new Map();

  // Fixed windows: the count starts at the first hit and is forgotten win ms later.
  const over = (l, k, t) => { const e = l.m.get(k); return !!e && t - e.t < l.win && e.n >= l.max; };
  const add = (l, k, t) => { const e = l.m.get(k); if (!e || t - e.t >= l.win) l.m.set(k, { t, n: 1 }); else e.n++; };

  function sweep() {
    const t = now();
    for (const [k, r] of boxes) if (r.exp <= t) boxes.delete(k);
    for (const l of Object.values(lim)) for (const [k, e] of l.m) if (t - e.t >= l.win) l.m.delete(k);
  }

  // who: the key of the connection that sent it (proved by the signature at login). ip: its address. m: the message.
  // send(obj) answers the sender; push(key, obj) hands something to another connected phone and says if it got there.
  function handle(who, ip, m, send, push) {
    const t = now();
    const say = (st, extra) => send({ type: 'pair', box: typeof m.box === 'string' ? m.box.slice(0, 8) : undefined, st, ...extra });
    if (typeof m.box !== 'string' || !BOX.test(m.box)) return say('bad');
    if (over(lim.ops, who, t)) return say('limit');
    add(lim.ops, who, t);
    const id = m.box;
    let r = boxes.get(id);
    if (r && r.exp <= t) { boxes.delete(id); r = undefined; }
    const fail = () => { add(lim.fail, ip, t); add(lim.failAll, 'all', t); };
    const sealedOk = s => typeof s === 'string' && s.length > 0 && s.length <= MAX_SEALED && B64.test(s);

    switch (m.type) {
      case 'pair-open': {
        if (typeof m.Y !== 'string' || !B64_32.test(m.Y)) return say('bad');
        const ttl = Math.min(TTL_MAX, Math.max(1000, Number(m.ttl) * 1000 || TTL_MAX));
        if (r) {
          if (r.owner !== who) return say('busy');
          if (r.Y !== m.Y) { r.Y = m.Y; r.claimedBy = null; r.claimAt = 0; r.join = null; r.reply = null; }
          r.exp = Math.min(r.exp, t + ttl);        // an opening can shorten the life of a box, never lengthen it
          say('opened');
          if (r.join) say('join', { Y: r.join.Y, sealed: r.join.sealed });
          return;
        }
        if (over(lim.open, ip, t) || boxes.size >= MAX_BOXES) return say('limit');
        let own = 0; for (const x of boxes.values()) if (x.owner === who) own++;
        if (own >= PER_OWNER) return say('limit');
        add(lim.open, ip, t);
        boxes.set(id, { owner: who, Y: m.Y, exp: t + ttl, claimedBy: null, claimAt: 0, join: null, reply: null });
        return say('opened');
      }
      case 'pair-claim': {
        if (over(lim.fail, ip, t) || over(lim.failAll, 'all', t)) return say('limit');
        if (!r) { fail(); return say('none'); }
        if (r.owner === who) return say('used');
        if (r.claimedBy && r.claimedBy !== who) {
          if (r.join || t - r.claimAt <= CLAIM_MS) { fail(); return say('used'); }
        }
        r.claimedBy = who; r.claimAt = t;
        return say('offer', { Y: r.Y });
      }
      case 'pair-join': {
        if (!r) { fail(); return say('none'); }
        if (r.claimedBy !== who) { fail(); return say('used'); }
        if (typeof m.Y !== 'string' || !B64_32.test(m.Y) || !sealedOk(m.sealed)) return say('bad');
        if (r.join) return r.join.Y === m.Y && r.join.sealed === m.sealed ? say('joined') : say('used');
        r.join = { Y: m.Y, sealed: m.sealed };
        push(r.owner, { type: 'pair', box: id, st: 'join', Y: m.Y, sealed: m.sealed });
        return say('joined');
      }
      case 'pair-reply': {
        if (!r) return say('none');
        if (r.owner !== who) return say('used');
        if (!r.join || !sealedOk(m.sealed)) return say('bad');
        r.reply = m.sealed;
        push(r.claimedBy, { type: 'pair', box: id, st: 'reply', sealed: m.sealed });
        return say('replied');
      }
      case 'pair-poll': {
        if (!r) return say('none');
        if (who === r.owner) return r.join ? say('join', { Y: r.join.Y, sealed: r.join.sealed }) : say('wait');
        if (who === r.claimedBy) return r.reply ? say('reply', { sealed: r.reply }) : say('wait');
        fail();
        return say('used');
      }
      case 'pair-end': {
        if (!r) return say('ended');
        if (who !== r.owner && who !== r.claimedBy) { fail(); return say('used'); }
        boxes.delete(id);
        const other = who === r.owner ? r.claimedBy : r.owner;
        if (other) push(other, { type: 'pair', box: id, st: 'ended' });   // the other phone finds out at once, not when it next asks
        return say('ended');
      }
      default: return say('bad');
    }
  }
  return { handle, sweep, size: () => boxes.size };
}

// The address of the phone that connected. Behind a proxy it is in X-Forwarded-For, where the proxies add their own entry to the
// right of what the client sent: the client's address is `hops` entries from the right. Which entry is right depends on how many
// proxies sit in front of the server (Render: see docs/BYGGA.md); a wrong choice only makes the limits shared between users.
function clientIp(req, hops = 0) {
  const xf = hops > 0 && req.headers['x-forwarded-for'];
  if (xf) {
    const parts = String(xf).split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts[Math.max(0, parts.length - hops)];
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = { createPairs, clientIp };
