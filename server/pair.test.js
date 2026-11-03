// Mailboxes for pairing codes: the rules of pair.js, with a clock that is moved by hand, and a run over real connections.
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const nacl = require('tweetnacl');
const { encodeBase64 } = require('tweetnacl-util');
const { createServer } = require('./server');
const { createPairs, clientIp } = require('./pair');

const Y = n => encodeBase64(new Uint8Array(32).fill(n));   // a well-formed public value (the server only checks the shape)
const S = (n, len = 60) => encodeBase64(new Uint8Array(len).fill(n));

// ---- the rules, one call at a time
function rig(opts = {}) {
  let t = 1_000_000;
  const p = createPairs({ now: () => t, ...opts });
  const out = [], pushed = [];
  const call = (who, m, ip = 'ip-' + who) => { out.length = 0; p.handle(who, ip, m, o => out.push(o), (to, o) => { pushed.push({ to, o }); return true; }); return out.at(-1); };
  return { p, call, out, pushed, tick: ms => { t += ms; }, now: () => t };
}
{
  const { p, call, out, pushed, tick } = rig();
  const st = (who, m, ip) => call(who, m, ip).st;

  // the box number must be four digits
  for (const box of [undefined, 5, '123', '12345', 'abcd', '12 3', '']) assert.equal(st('A', { type: 'pair-open', box, Y: Y(1) }), 'bad', `box ${JSON.stringify(box)}`);
  assert.equal(st('A', { type: 'pair-what', box: '4829' }), 'bad', 'unknown message');
  assert.equal(st('A', { type: 'pair-open', box: '4829', Y: 'nope' }), 'bad', 'public value must be 32 bytes of base64');
  assert.equal(st('A', { type: 'pair-open', box: '4829', Y: Y(1).slice(0, 40) }), 'bad');
  assert.equal(p.size(), 0);

  // A opens, nobody else can take the same box
  assert.equal(st('A', { type: 'pair-open', box: '4829', Y: Y(1) }), 'opened');
  assert.equal(st('X', { type: 'pair-open', box: '4829', Y: Y(9) }), 'busy', 'a box that is taken is busy for others');
  assert.equal(st('A', { type: 'pair-open', box: '4829', Y: Y(1) }), 'opened', 'the same phone opening again is fine (after a restart or a lost connection)');
  assert.equal(p.size(), 1);

  // nothing to poll yet, for A or for a stranger
  assert.equal(st('A', { type: 'pair-poll', box: '4829' }), 'wait');
  assert.equal(st('B', { type: 'pair-poll', box: '4829' }), 'used', 'someone who is not part of it gets nothing');
  assert.equal(st('B', { type: 'pair-poll', box: '1111' }), 'none');

  // B claims and gets A's value; nobody else may claim, and A cannot answer its own code
  assert.equal(st('B', { type: 'pair-claim', box: '1111' }), 'none');
  assert.equal(st('A', { type: 'pair-claim', box: '4829' }), 'used', 'the owner cannot claim its own code');
  assert.deepEqual(call('B', { type: 'pair-claim', box: '4829' }), { type: 'pair', box: '4829', st: 'offer', Y: Y(1) });
  assert.equal(st('B', { type: 'pair-claim', box: '4829' }), 'offer', 'B asking again (lost connection) gets the same');
  assert.equal(st('C', { type: 'pair-claim', box: '4829' }), 'used', 'a second claimant is refused: one try per code');

  // join: only the claimant, with well-formed parts
  assert.equal(st('C', { type: 'pair-join', box: '4829', Y: Y(2), sealed: S(3) }), 'used');
  assert.equal(st('B', { type: 'pair-join', box: '4829', Y: 'x', sealed: S(3) }), 'bad');
  assert.equal(st('B', { type: 'pair-join', box: '4829', Y: Y(2), sealed: '' }), 'bad');
  assert.equal(st('B', { type: 'pair-join', box: '4829', Y: Y(2), sealed: '$$$' }), 'bad');
  assert.equal(st('B', { type: 'pair-join', box: '4829', Y: Y(2), sealed: S(3, 2000) }), 'bad', 'too big');
  assert.equal(st('B', { type: 'pair-join', box: '4829', Y: Y(2), sealed: 5 }), 'bad');
  assert.equal(pushed.length, 0, 'nothing was passed on yet');
  assert.equal(st('B', { type: 'pair-join', box: '4829', Y: Y(2), sealed: S(3) }), 'joined');
  assert.deepEqual(pushed.at(-1), { to: 'A', o: { type: 'pair', box: '4829', st: 'join', Y: Y(2), sealed: S(3) } }, 'A is told at once');
  assert.equal(st('B', { type: 'pair-join', box: '4829', Y: Y(2), sealed: S(3) }), 'joined', 'the same join again is fine');
  assert.equal(st('B', { type: 'pair-join', box: '4829', Y: Y(4), sealed: S(5) }), 'used', 'a different join is not');
  assert.equal(pushed.length, 1);

  // A was offline: asking later gives the join, and opening again gives it too
  assert.deepEqual(call('A', { type: 'pair-poll', box: '4829' }), { type: 'pair', box: '4829', st: 'join', Y: Y(2), sealed: S(3) });
  call('A', { type: 'pair-open', box: '4829', Y: Y(1) });
  assert.deepEqual(out.map(o => o.st), ['opened', 'join'], 're-opening hands over what waits');
  // while B waits for the reply
  assert.equal(st('B', { type: 'pair-poll', box: '4829' }), 'wait');

  // reply: only the owner, and only after a join
  assert.equal(st('B', { type: 'pair-reply', box: '4829', sealed: S(7) }), 'used');
  assert.equal(st('A', { type: 'pair-reply', box: '4829', sealed: 'x!' }), 'bad');
  assert.equal(st('A', { type: 'pair-reply', box: '4829', sealed: S(7) }), 'replied');
  assert.deepEqual(pushed.at(-1), { to: 'B', o: { type: 'pair', box: '4829', st: 'reply', sealed: S(7) } });
  assert.deepEqual(call('B', { type: 'pair-poll', box: '4829' }), { type: 'pair', box: '4829', st: 'reply', sealed: S(7) }, 'B can fetch it later');
  assert.equal(st('A', { type: 'pair-poll', box: '4829' }), 'join', 'A still sees B\'s join until the box is ended');

  // ending: only the two of them; ending something that is gone is fine
  assert.equal(st('C', { type: 'pair-end', box: '4829' }), 'used');
  assert.equal(p.size(), 1);
  assert.equal(st('B', { type: 'pair-end', box: '4829' }), 'ended');
  assert.deepEqual(pushed.at(-1), { to: 'A', o: { type: 'pair', box: '4829', st: 'ended' } }, 'the other phone is told that it is over');
  assert.equal(p.size(), 0);
  assert.equal(st('B', { type: 'pair-poll', box: '4829' }), 'none');
  assert.equal(st('B', { type: 'pair-end', box: '4829' }), 'ended');
  assert.equal(st('A', { type: 'pair-reply', box: '4829', sealed: S(7) }), 'none');
  assert.equal(st('B', { type: 'pair-join', box: '4829', Y: Y(2), sealed: S(3) }), 'none');

  // the owner can also end it (a wrong code), and the claimant then finds nothing
  call('A', { type: 'pair-open', box: '2000', Y: Y(1) }); call('B', { type: 'pair-claim', box: '2000' });
  call('B', { type: 'pair-join', box: '2000', Y: Y(2), sealed: S(3) });
  assert.equal(st('A', { type: 'pair-end', box: '2000' }), 'ended');
  assert.deepEqual(pushed.at(-1), { to: 'B', o: { type: 'pair', box: '2000', st: 'ended' } }, 'B is told at once');
  assert.equal(st('B', { type: 'pair-poll', box: '2000' }), 'none', 'burned: B sees that the code is gone');

  // a box that was only claimed and never answered is let go after a while; one that has been answered is not
  call('A', { type: 'pair-open', box: '3000', Y: Y(1) });
  assert.equal(st('B', { type: 'pair-claim', box: '3000' }), 'offer');
  tick(60_000);
  assert.equal(st('C', { type: 'pair-claim', box: '3000' }), 'used', 'still held a minute later');
  tick(3 * 60_000);
  assert.equal(st('C', { type: 'pair-claim', box: '3000' }), 'offer', 'let go after three minutes without an answer');
  call('C', { type: 'pair-join', box: '3000', Y: Y(2), sealed: S(3) });
  tick(10 * 60_000);
  assert.equal(st('D', { type: 'pair-claim', box: '3000' }), 'used', 'an answered box is never handed to someone else');

  // time: a box lives at most 24 hours; an opening may ask for less, and a later opening cannot stretch it
  call('A', { type: 'pair-open', box: '5000', Y: Y(1), ttl: 3600 });
  call('A', { type: 'pair-open', box: '5000', Y: Y(1), ttl: 999999 });
  tick(3600_000 + 1);
  assert.equal(st('B', { type: 'pair-poll', box: '5000' }), 'none', 'gone after the hour it asked for');
  call('A', { type: 'pair-open', box: '5001', Y: Y(1) });
  tick(24 * 3600_000 - 1000);
  assert.equal(st('A', { type: 'pair-poll', box: '5001' }), 'wait');
  tick(1500);
  assert.equal(st('A', { type: 'pair-poll', box: '5001' }), 'none', 'gone after 24 hours');
  assert.equal(st('X', { type: 'pair-open', box: '5001', Y: Y(1) }), 'opened', 'and the number can be used again');
  p.sweep();
  tick(25 * 3600_000);
  p.sweep();
  assert.equal(p.size(), 0, 'sweep removes what has expired');
}

// a reply before there is anything to reply to is refused (and goes nowhere)
{
  const { call, pushed } = rig();
  call('A', { type: 'pair-open', box: '1234', Y: Y(1) });
  assert.equal(call('A', { type: 'pair-reply', box: '1234', sealed: S(7) }).st, 'bad', 'nobody has claimed it');
  call('B', { type: 'pair-claim', box: '1234' });
  assert.equal(call('A', { type: 'pair-reply', box: '1234', sealed: S(7) }).st, 'bad', 'claimed but not answered');
  assert.equal(pushed.length, 0);
}

// opening again with another public value starts the box over
{
  const { call } = rig();
  call('A', { type: 'pair-open', box: '1234', Y: Y(1) }); call('B', { type: 'pair-claim', box: '1234' });
  call('B', { type: 'pair-join', box: '1234', Y: Y(2), sealed: S(3) });
  assert.equal(call('A', { type: 'pair-open', box: '1234', Y: Y(8) }).st, 'opened');
  assert.equal(call('A', { type: 'pair-poll', box: '1234' }).st, 'wait', 'the old join is gone');
  assert.deepEqual(call('C', { type: 'pair-claim', box: '1234' }), { type: 'pair', box: '1234', st: 'offer', Y: Y(8) });
}

// ---- limits
{
  // someone who guesses boxes: twelve misses from one address, then nothing from that address for ten minutes
  const { call, tick } = rig();
  call('A', { type: 'pair-open', box: '7777', Y: Y(1) });
  for (let i = 0; i < 12; i++) assert.equal(call('G' + i, { type: 'pair-claim', box: '0' + String(100 + i) }, 'evil').st, 'none');
  assert.equal(call('G13', { type: 'pair-claim', box: '7777' }, 'evil').st, 'limit', 'even a right guess is refused now');
  assert.equal(call('B', { type: 'pair-claim', box: '7777' }, 'friend').st, 'offer', 'another address is not affected');
  tick(10 * 60_000 + 1);
  assert.equal(call('G14', { type: 'pair-claim', box: '0100' }, 'evil').st, 'none', 'the window ends');
}
{
  // many addresses together: a limit for the whole server
  const { call } = rig({ failsAll: 20 });
  for (let i = 0; i < 20; i++) call('G' + i, { type: 'pair-claim', box: '0' + String(100 + i) }, 'ip' + i);
  assert.equal(call('G99', { type: 'pair-claim', box: '0500' }, 'ip99').st, 'limit');
}
{
  // a right claim does not count against the address
  const { call } = rig();
  for (let i = 0; i < 30; i++) { call('A' + i, { type: 'pair-open', box: String(1000 + i), Y: Y(1) }, 'owners'); }
  for (let i = 0; i < 30; i++) assert.equal(call('B' + i, { type: 'pair-claim', box: String(1000 + i) }, 'same-wifi').st, 'offer');
}
{
  const { call, tick } = rig({ opensPerIp: 3, perOwner: 2, maxBoxes: 4 });
  assert.equal(call('A', { type: 'pair-open', box: '1001', Y: Y(1) }, 'ip').st, 'opened');
  assert.equal(call('A', { type: 'pair-open', box: '1002', Y: Y(1) }, 'ip').st, 'opened');
  assert.equal(call('A', { type: 'pair-open', box: '1003', Y: Y(1) }, 'ip').st, 'limit', 'one phone holds two codes at most');
  assert.equal(call('B', { type: 'pair-open', box: '1003', Y: Y(1) }, 'ip').st, 'opened');
  assert.equal(call('C', { type: 'pair-open', box: '1004', Y: Y(1) }, 'ip').st, 'limit', 'three openings per address and hour');
  assert.equal(call('C', { type: 'pair-open', box: '1004', Y: Y(1) }, 'other').st, 'opened');
  assert.equal(call('D', { type: 'pair-open', box: '1005', Y: Y(1) }, 'third').st, 'limit', 'room for four boxes in all');
  tick(3600_000 + 1);
  call('A', { type: 'pair-end', box: '1001' });
  assert.equal(call('E', { type: 'pair-open', box: '1001', Y: Y(1) }, 'ip').st, 'opened', 'room again');
}
{
  const { call } = rig({ opsPerKey: 5 });
  for (let i = 0; i < 5; i++) assert.equal(call('A', { type: 'pair-poll', box: '1000' }).st, 'none');
  assert.equal(call('A', { type: 'pair-poll', box: '1000' }).st, 'limit', 'a key can only ask so often');
  assert.equal(call('B', { type: 'pair-poll', box: '1000' }).st, 'none');
}

// ---- the address of a connection
{
  const req = (xf, addr = '10.0.0.1') => ({ headers: xf === undefined ? {} : { 'x-forwarded-for': xf }, socket: { remoteAddress: addr } });
  assert.equal(clientIp(req('1.2.3.4'), 0), '10.0.0.1', 'no proxy: the connection');
  assert.equal(clientIp(req('1.2.3.4, 9.9.9.9'), 1), '9.9.9.9', 'one proxy: the entry it added');
  assert.equal(clientIp(req('6.6.6.6, 1.2.3.4, 9.9.9.9'), 2), '1.2.3.4', 'two proxies');
  assert.equal(clientIp(req('1.2.3.4'), 3), '1.2.3.4', 'fewer entries than hops: the first');
  assert.equal(clientIp(req(undefined), 1), '10.0.0.1', 'no header: the connection');
  assert.equal(clientIp(req(' , '), 1), '10.0.0.1', 'empty header');
}

// ---- over real connections
function client(url, kp) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url); const inbox = [];
    ws.on('message', raw => {
      const m = JSON.parse(raw);
      if (m.type === 'challenge') ws.send(JSON.stringify({ type: 'hello', sign: encodeBase64(kp.publicKey), sig: encodeBase64(nacl.sign.detached(new TextEncoder().encode(m.nonce), kp.secretKey)) }));
      else if (m.type === 'ready') resolve({ ws, inbox, pub: encodeBase64(kp.publicKey), send: o => ws.send(JSON.stringify(o)) });
      else inbox.push(m);
    });
    ws.on('error', reject);
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const srv = createServer({ port: 18082, host: '127.0.0.1' });
  const url = 'ws://127.0.0.1:18082';
  const a = await client(url, nacl.sign.keyPair()), b = await client(url, nacl.sign.keyPair());
  const last = c => c.inbox.at(-1);

  a.send({ type: 'pair-open', box: '4829', Y: Y(1) }); await wait(60);
  assert.equal(last(a).st, 'opened');
  b.send({ type: 'pair-claim', box: '4829' }); await wait(60);
  assert.deepEqual(last(b), { type: 'pair', box: '4829', st: 'offer', Y: Y(1) });
  b.send({ type: 'pair-join', box: '4829', Y: Y(2), sealed: S(3) }); await wait(60);
  assert.equal(last(b).st, 'joined');
  assert.deepEqual(last(a), { type: 'pair', box: '4829', st: 'join', Y: Y(2), sealed: S(3) }, 'A is told without asking');
  a.send({ type: 'pair-reply', box: '4829', sealed: S(7) }); await wait(60);
  assert.equal(last(a).st, 'replied');
  assert.deepEqual(last(b), { type: 'pair', box: '4829', st: 'reply', sealed: S(7) }, 'and B too');
  b.send({ type: 'pair-end', box: '4829' }); await wait(60);
  assert.equal(last(b).st, 'ended');
  assert.deepEqual(last(a), { type: 'pair', box: '4829', st: 'ended' }, 'A is told that B is finished');

  // B offline while A answers: B comes back later and asks
  a.send({ type: 'pair-open', box: '5555', Y: Y(1) });
  b.send({ type: 'pair-claim', box: '5555' }); await wait(60);
  const bk = nacl.sign.keyPair();
  const b3 = await client(url, bk);
  b3.send({ type: 'pair-claim', box: '6666' }); await wait(60);
  assert.equal(last(b3).st, 'none');
  b.send({ type: 'pair-join', box: '5555', Y: Y(2), sealed: S(3) }); await wait(60);
  b.ws.close(); await wait(60);
  a.send({ type: 'pair-reply', box: '5555', sealed: S(7) }); await wait(60);
  assert.equal(last(a).st, 'replied', 'the reply is accepted though B is not there');
  const b2 = await client(url, nacl.sign.keyPair());
  b2.send({ type: 'pair-poll', box: '5555' }); await wait(60);
  assert.equal(last(b2).st, 'used', 'a new key is not B');

  // junk does not hurt the server, with or without a login
  const raw = new WebSocket(url); await new Promise(r => raw.on('open', r));
  for (const j of ['null', '[]', '5', '"x"', '{"type":"pair-open"}', '{"type":5}', '{']) raw.send(j);
  for (const j of ['null', '[]', '5', '"x"', '{"type":"pair-open"}', '{"type":"pair-claim","box":{}}', '{"type":"pair-join","box":"1234"}', '{"type":"pair-open","box":"9999","Y":null}', '{']) a.ws.send(j);
  await wait(100);
  a.send({ type: 'pair-poll', box: '5555' }); await wait(60);
  assert.equal(last(a).st, 'join', 'still working after junk (A sees the join that B left)');
  raw.close();
  await srv.close();
  console.log('server pair: all tests OK');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
