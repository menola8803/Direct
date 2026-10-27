import assert from 'node:assert/strict';
import wrtc from '@roamhq/wrtc';
import { DEFAULT_STUN, parseStun, stunOrDefault, testStun } from '../src/net/stun';

assert.deepEqual(parseStun('stun.example.org:3478\nstun:other.example.org:19302, stun://third.example.org'), ['stun:stun.example.org:3478', 'stun:other.example.org:19302', 'stun:third.example.org']);
assert.deepEqual(parseStun('stun.a.org stun.a.org'), ['stun:stun.a.org'], 'duplicates removed');
assert.deepEqual(parseStun('javascript:alert(1) http://x.org bad/host'), [], 'junk is rejected');
assert.equal(parseStun(Array.from({ length: 20 }, (_, i) => `s${i}.org`).join('\n')).length, 8, 'max 8');
assert.deepEqual(stunOrDefault('   '), DEFAULT_STUN);
// an address that cannot answer must report failure (and not hang)
(async () => {
  assert.equal(await testStun(wrtc as any, 'stun:127.0.0.1:9', 1200), false);
  console.log('stun: all tests OK');
  process.exit(0);
})();
