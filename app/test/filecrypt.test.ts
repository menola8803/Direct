import assert from 'node:assert/strict';
import nacl from 'tweetnacl';
import { FRAME, HEADER, TAG, FileEncryptor, decryptAll, encryptedSize, fileKey, openEncrypted, parseHeader, plainSize } from '../src/core/filecrypt';

const key = nacl.randomBytes(32);
const rnd = (n: number) => { const b = new Uint8Array(n); for (let i = 0; i < n; i += 65536) b.set(nacl.randomBytes(Math.min(65536, n - i)), i); return b; };
const eq = (a: Uint8Array, b: Uint8Array) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
const join = (parts: Uint8Array[]) => new Uint8Array(Buffer.concat(parts.map(p => Buffer.from(p))));
// Encrypts `plain`, delivered in pieces of `piece` bytes (as received chunks would be).
function encrypt(plain: Uint8Array, piece: number, k = key): Uint8Array {
  const e = new FileEncryptor(k);
  const out: Uint8Array[] = [e.header()];
  for (let i = 0; i < plain.length; i += piece) out.push(e.push(plain.subarray(i, i + piece)));
  out.push(e.finish());
  return join(out);
}
const rawOf = (f: Uint8Array) => (o: number, n: number) => f.slice(o, o + n);

(async () => {
  assert.equal(FRAME, 65536); assert.equal(TAG, 16); assert.equal(HEADER, 24);

  // ---- sizes
  assert.equal(encryptedSize(0), 24 + 16);
  assert.equal(encryptedSize(1), 24 + 1 + 16);
  assert.equal(encryptedSize(FRAME), 24 + FRAME + 16);
  assert.equal(encryptedSize(FRAME + 1), 24 + FRAME + 1 + 32);
  for (const n of [0, 1, 100, FRAME - 1, FRAME, FRAME + 1, 2 * FRAME, 2 * FRAME + 5, 5 * FRAME + 123]) {
    assert.equal(plainSize(encryptedSize(n)), n, `plain size of ${n} is recovered from the file size`);
  }
  assert.equal(plainSize(10), null, 'too small');
  assert.equal(plainSize(24 + 15), null, 'a frame needs its 16 authentication bytes');
  assert.equal(plainSize(HEADER + FRAME + TAG + 5), null, 'a second frame shorter than its authentication bytes cannot come from this format');

  // ---- round trip for many sizes and piece sizes
  const sizes = [0, 1, 100, FRAME - 1, FRAME, FRAME + 1, 2 * FRAME, 2 * FRAME + 5, 3 * FRAME - 1, 5 * FRAME + 123];
  for (const n of sizes) {
    const plain = rnd(n);
    for (const piece of [1000, 8192, 65536, 70001]) {
      const enc = encrypt(plain, piece);
      assert.equal(enc.length, encryptedSize(n), `encrypted size of ${n} bytes, pieces of ${piece}`);
      const src = await openEncrypted(key, enc.length, rawOf(enc));
      assert.equal(src.size, n);
      assert.ok(eq(await src.read(0, n + 10), plain), `content of ${n} bytes, pieces of ${piece}`);
      src.close();
    }
  }
  const same = rnd(300_000);
  assert.ok(eq(encrypt(same, 8192), encrypt(same, 8192)) === false, 'two encryptions of the same file differ (random salt)');
  const one = encrypt(same, 8192);
  assert.equal(Buffer.from(one).includes(Buffer.from(same.subarray(1000, 1100))), false, 'the plain content is nowhere in the file');

  // ---- random access as used when sending (8 kB reads) and for odd ranges
  const big = rnd(5 * FRAME + 123), encBig = encrypt(big, 8192);
  const src = await openEncrypted(key, encBig.length, rawOf(encBig));
  assert.equal(src.size, big.length);
  const parts: Uint8Array[] = [];
  for (let off = 0; off < src.size; off += 8192) parts.push(await src.read(off, Math.min(8192, src.size - off)));
  assert.ok(eq(join(parts), big), 'reading in 8 kB steps gives the file back');
  for (const [o, l] of [[0, 1], [FRAME - 1, 2], [FRAME, 1], [FRAME - 5, 3 * FRAME], [2 * FRAME + 7, 100], [big.length - 3, 50], [big.length, 10], [big.length + 5, 10], [10, 0]] as [number, number][]) {
    assert.ok(eq(await src.read(o, l), big.slice(o, o + l)), `range ${o}+${l}`);
  }
  src.close();

  // ---- decrypt the whole file piece by piece
  const out: Uint8Array[] = []; let paused = 0;
  await decryptAll(key, encBig.length, rawOf(encBig), b => { out.push(b); }, async () => { paused++; });
  assert.ok(eq(join(out), big), 'decryptAll gives the file back');
  assert.equal(paused, 6, 'one pause per frame');

  // ---- wrong key, damage, truncation, reordering, other files
  const bad = (f: Uint8Array, k = key) => openEncrypted(k, f.length, rawOf(f)).then(s => s.read(0, s.size)).then(() => false, () => true);
  assert.equal(await bad(encBig, nacl.randomBytes(32)), true, 'wrong key');
  const flipped = encBig.slice(); flipped[HEADER + 100000] ^= 1;
  assert.equal(await bad(flipped), true, 'a changed byte is detected');
  const flippedTag = encBig.slice(); flippedTag[encBig.length - 1] ^= 1;
  assert.equal(await bad(flippedTag), true, 'a changed last frame is detected');
  const cut = encBig.slice(0, HEADER + 3 * (FRAME + TAG)); // exactly three whole frames: looks like a smaller file
  assert.equal(plainSize(cut.length), 3 * FRAME, 'the size alone looks valid');
  assert.equal(await bad(cut), true, 'but cutting frames off the end is detected: the last frame must be marked as last');
  const swapped = encBig.slice();
  swapped.set(encBig.slice(HEADER + (FRAME + TAG), HEADER + 2 * (FRAME + TAG)), HEADER);
  assert.equal(await bad(swapped), true, 'a frame moved to another place does not open');
  const dropped = join([encBig.slice(0, HEADER + (FRAME + TAG)), encBig.slice(HEADER + 2 * (FRAME + TAG))]);
  assert.equal(await bad(dropped), true, 'a missing frame in the middle is detected');
  assert.equal(await bad(new Uint8Array(100)), true, 'not an encrypted file');
  assert.equal(await bad(encBig.slice(0, 30)), true, 'cut inside the first frame');
  const other = encrypt(rnd(2 * FRAME), 8192);
  const mixed = encBig.slice(); mixed.set(other.slice(0, HEADER), 0); // header (salt) of another file
  assert.equal(await bad(mixed), true, 'another file\'s header gives another key');
  const empty = encrypt(new Uint8Array(0), 100);
  assert.equal(await bad(empty), false, 'an empty file is fine');
  const emptyCut = empty.slice(0, HEADER);
  assert.equal(await bad(emptyCut), true, 'an empty file with the frame removed is detected');

  // ---- header and keys
  assert.equal(parseHeader(new Uint8Array(24)), null);
  const hdr = new FileEncryptor(key).header();
  assert.ok(parseHeader(hdr));
  const h2 = hdr.slice(); h2[23] ^= 1;
  assert.equal(parseHeader(h2), null, 'frame size must match');
  const salt = nacl.randomBytes(16);
  assert.ok(eq(fileKey(key, salt), fileKey(key, salt)), 'same inputs, same key');
  assert.ok(!eq(fileKey(key, salt), fileKey(key, nacl.randomBytes(16))), 'another salt, another key');
  assert.ok(!eq(fileKey(key, salt), fileKey(nacl.randomBytes(32), salt)), 'another data key, another key');

  // ---- speed (information only): how long a 20 MB file takes in this runtime
  const mb = rnd(20 * 1024 * 1024);
  let t0 = Date.now(); const big20 = encrypt(mb, 8192); const tEnc = Date.now() - t0;
  t0 = Date.now(); const o2: Uint8Array[] = []; await decryptAll(key, big20.length, rawOf(big20), b => { o2.push(b); }); const tDec = Date.now() - t0;
  assert.ok(eq(join(o2), mb));
  console.log(`filecrypt.test.ts OK (Node: 20 MB encrypt ${tEnc} ms, decrypt ${tDec} ms)`);
})().catch(e => { console.error(e); process.exit(1); });
