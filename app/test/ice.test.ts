import assert from 'node:assert/strict';
import wrtc from '@roamhq/wrtc';
import { MAX_TURN, parseTurn, pingTurn, turnLine, turnText } from '../src/net/turn';
import { planIce, asTcp } from '../src/net/ice';
import { DEFAULT_STUN } from '../src/net/stun';
import { migrateSaved } from '../src/core/migrate';

// ---- parseTurn
assert.deepEqual(parseTurn('turn:turn.example.org:3478 anna secret'), [{ urls: 'turn:turn.example.org:3478', username: 'anna', credential: 'secret' }]);
assert.deepEqual(parseTurn('turn.example.org:443'), [{ urls: 'turn:turn.example.org:443' }], 'bare host:port becomes turn:');
assert.deepEqual(parseTurn('turns://t.example.org:443?transport=TCP u p w'), [{ urls: 'turns:t.example.org:443?transport=tcp', username: 'u', credential: 'p w' }], 'turns, transport lower-cased, spaces in password');
assert.deepEqual(parseTurn('TURN:a.org:3478\nturn:a.org:3478\n\n  turn:b.org:3478?transport=udp  x  y  '), [{ urls: 'turn:a.org:3478' }, { urls: 'turn:b.org:3478?transport=udp', username: 'x', credential: 'y' }], 'duplicates dropped, blanks ignored');
assert.deepEqual(parseTurn('javascript:alert(1)\nhttp://x.org\nturn:bad/host\nturn:a.org?transport=sctp'), [], 'junk is rejected');
assert.equal(parseTurn(Array.from({ length: 12 }, (_, i) => `turn:s${i}.org:3478`).join('\n')).length, MAX_TURN, 'max servers');
const l = parseTurn('turn:a.org:3478 u p');
assert.deepEqual(parseTurn(turnText(l)), l, 'text round trip');
assert.equal(turnLine(l[0]), 'turn:a.org:3478 u p');

// ---- planIce
const turnList = 'turn:t.example.org:3478 u p\nturns:t.example.org:443 u p';
let p = planIce({ stunList: '', turnList: '', hideIp: false, tcpOnly: false });
assert.deepEqual(p, { iceServers: [{ urls: DEFAULT_STUN }], relayOnly: false, needsTurn: false }, 'default: STUN only, direct');
p = planIce({ stunList: 'stun.a.org', turnList, hideIp: false, tcpOnly: false });
assert.deepEqual(p.iceServers.map(s => s.urls), [['stun:stun.a.org'], 'turn:t.example.org:3478', 'turns:t.example.org:443'], 'STUN plus TURN');
assert.equal(p.relayOnly, false);
p = planIce({ stunList: '', turnList, hideIp: true, tcpOnly: false });
assert.deepEqual(p.iceServers.map(s => s.urls), ['turn:t.example.org:3478', 'turns:t.example.org:443'], 'hide IP: no STUN, TURN only');
assert.equal(p.relayOnly, true); assert.equal(p.needsTurn, false);
p = planIce({ stunList: '', turnList, hideIp: false, tcpOnly: true });
assert.deepEqual(p.iceServers.map(s => s.urls), ['turn:t.example.org:3478?transport=tcp', 'turns:t.example.org:443'], 'TCP only: UDP TURN forced to TCP, TLS kept');
assert.equal(p.relayOnly, true, 'TCP only implies relay only');
assert.equal(planIce({ stunList: '', turnList: '', hideIp: true, tcpOnly: false }).needsTurn, true, 'hide IP without TURN must not silently fall back to a direct connection');
assert.deepEqual(planIce({ stunList: '', turnList: '', hideIp: true, tcpOnly: false }).iceServers, []);
assert.equal(asTcp('turn:a.org:3478?transport=udp'), 'turn:a.org:3478?transport=udp', 'an explicit transport is respected');

// ---- migrateSaved
assert.deepEqual(migrateSaved({ themeName: 'usb', turnUrl: 'turn:a.org:3478', turnUser: 'u', turnCred: 'p', hideIp: true }), { themeName: 'dark', turnList: 'turn:a.org:3478 u p', hideIp: true, introSeen: true });
assert.deepEqual(migrateSaved({ turnUrl: '', turnUser: '', turnCred: '' }), { introSeen: true }, 'empty old fields vanish');
assert.deepEqual(migrateSaved({ turnList: 'turn:x.org:3478', turnUrl: 'turn:old.org:1' }), { turnList: 'turn:x.org:3478', introSeen: true }, 'an existing list wins');
assert.deepEqual(migrateSaved(null), {});
assert.equal(migrateSaved({ themeName: 'beige' }).themeName, 'beige');
assert.equal(migrateSaved({ themeName: 'dark' }).introSeen, true, 'an older install does not get the first-run guide');
assert.equal(migrateSaved({ introSeen: false }).introSeen, false, 'a fresh install that has not finished the guide keeps it');
assert.equal(migrateSaved({ introSeen: true }).introSeen, true);

// ---- an address that cannot hand out a relay must report failure (and not hang)
(async () => {
  assert.equal(await pingTurn(wrtc as any, { urls: 'turn:127.0.0.1:9', username: 'a', credential: 'b' }, 1500), null);
  console.log('ice: all tests OK');
  process.exit(0);
})();
