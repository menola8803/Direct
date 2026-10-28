// Encrypted files at rest ("private" file storage). Plain TypeScript, so it can be tested in Node.
//
// Layout of an encrypted file:  header (24 bytes)  then frames.
//   header = "DEF1" | 16 random bytes (salt) | frame size as 4 bytes (big endian)
//   frame  = secretbox(plain part of up to 64 kB) = the encrypted part + 16 bytes of authentication
// The key of a file is SHA-512("direct-file-v1" | data key | salt) cut to 32 bytes, so every file has its own key.
// The nonce of a frame is its number plus a flag for the last frame. That makes a frame that is moved, repeated,
// removed or cut off from the end detectable: it no longer opens. Every frame except the last holds exactly 64 kB.
import nacl from 'tweetnacl';
import type { Source } from './transfer';

export const FRAME = 65536;
export const TAG = nacl.secretbox.overheadLength; // 16
export const HEADER = 24;
const MAGIC = [0x44, 0x45, 0x46, 0x31]; // "DEF1"
const EMPTY = new Uint8Array(0);

const concat = (parts: Uint8Array[]): Uint8Array => {
  if (parts.length === 1) return parts[0];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const ascii = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));

export function fileKey(dataKey: Uint8Array, salt: Uint8Array): Uint8Array {
  return nacl.hash(concat([ascii('direct-file-v1'), dataKey, salt])).slice(0, 32);
}
function nonce(index: number, last: boolean): Uint8Array {
  const n = new Uint8Array(24);
  n[16] = last ? 1 : 0;
  n[20] = (index >>> 24) & 255; n[21] = (index >>> 16) & 255; n[22] = (index >>> 8) & 255; n[23] = index & 255;
  return n;
}
const makeHeader = (salt: Uint8Array): Uint8Array => {
  const h = new Uint8Array(HEADER);
  h.set(MAGIC); h.set(salt, 4);
  h[20] = (FRAME >>> 24) & 255; h[21] = (FRAME >>> 16) & 255; h[22] = (FRAME >>> 8) & 255; h[23] = FRAME & 255;
  return h;
};
// The salt of a header, or null if it is not one of ours.
export function parseHeader(h: Uint8Array): Uint8Array | null {
  if (h.length < HEADER || MAGIC.some((b, i) => h[i] !== b)) return null;
  const size = ((h[20] << 24) | (h[21] << 16) | (h[22] << 8) | h[23]) >>> 0;
  return size === FRAME ? h.slice(4, 20) : null;
}

// Size of the encrypted file for a plain size, and the other way round (null when the size cannot be right).
export const encryptedSize = (plain: number) => HEADER + plain + TAG * Math.max(1, Math.ceil(plain / FRAME));
export function plainSize(fileSize: number): number | null {
  const body = fileSize - HEADER;
  if (!Number.isInteger(body) || body < TAG) return null;
  const frames = Math.ceil(body / (FRAME + TAG));
  const plain = body - frames * TAG;
  return plain >= 0 && frames === Math.max(1, Math.ceil(plain / FRAME)) ? plain : null;
}

// Encrypts a stream of bytes: write header(), then push() every piece as it arrives, then finish().
export class FileEncryptor {
  private key: Uint8Array;
  private salt: Uint8Array;
  private index = 0;
  private parts: Uint8Array[] = [];
  private len = 0;
  constructor(dataKey: Uint8Array, salt: Uint8Array = nacl.randomBytes(16)) { this.salt = salt; this.key = fileKey(dataKey, salt); }
  header(): Uint8Array { return makeHeader(this.salt); }
  private seal(plain: Uint8Array, last: boolean): Uint8Array { return nacl.secretbox(plain, nonce(this.index++, last), this.key); }
  // The encrypted bytes that are ready to be written (can be empty). At least one byte is always held back, because the
  // last frame is sealed differently and we do not know yet which one it is.
  push(b: Uint8Array): Uint8Array {
    if (b.length === 0) return EMPTY;
    this.parts.push(b); this.len += b.length;
    if (this.len <= FRAME) return EMPTY;
    const all = concat(this.parts);
    const frames = Math.floor((this.len - 1) / FRAME);
    const out: Uint8Array[] = [];
    for (let i = 0; i < frames; i++) out.push(this.seal(all.subarray(i * FRAME, (i + 1) * FRAME), false));
    const rest = all.slice(frames * FRAME);
    this.parts = [rest]; this.len = rest.length;
    return concat(out);
  }
  // The last frame. Call once, after the last push().
  finish(): Uint8Array {
    const last = this.len ? concat(this.parts) : EMPTY;
    this.parts = []; this.len = 0;
    const out = this.seal(last, true);
    this.key.fill(0);
    return out;
  }
}

export type RawRead = (offset: number, len: number) => Promise<Uint8Array> | Uint8Array;

// Random access to the plain content of an encrypted file (reads one frame at a time and keeps the last one).
// Throws if the file is not one of ours, has been changed, or the key is wrong.
export async function openEncrypted(dataKey: Uint8Array, fileSize: number, raw: RawRead): Promise<Source & { close(): void }> {
  const total = plainSize(fileSize);
  const salt = total == null ? null : parseHeader(await raw(0, HEADER));
  if (total == null || !salt) throw new Error('not an encrypted file');
  const key = fileKey(dataKey, salt);
  const frames = Math.max(1, Math.ceil(total / FRAME));
  let cached: { i: number; plain: Uint8Array } | null = null;
  const frame = async (i: number): Promise<Uint8Array> => {
    if (cached?.i === i) return cached.plain;
    const cipher = await raw(HEADER + i * (FRAME + TAG), Math.min(FRAME + TAG, fileSize - HEADER - i * (FRAME + TAG)));
    const plain = nacl.secretbox.open(cipher, nonce(i, i === frames - 1), key);
    if (!plain) throw new Error('file damaged or wrong key');
    cached = { i, plain };
    return plain;
  };
  return {
    size: total,
    read: async (offset, len) => {
      const end = Math.min(total, offset + len);
      if (offset >= end) return EMPTY;
      const out = new Uint8Array(end - offset);
      for (let i = Math.floor(offset / FRAME); i * FRAME < end; i++) {
        const p = await frame(i);
        const from = Math.max(offset, i * FRAME), to = Math.min(end, i * FRAME + p.length);
        out.set(p.subarray(from - i * FRAME, to - i * FRAME), from - offset);
      }
      return out;
    },
    close: () => { key.fill(0); cached = null; },
  };
}

// Writes the whole plain content of an encrypted file piece by piece (for playing, opening and sharing).
// `pause` is called between frames so a large file does not block the app.
export async function decryptAll(dataKey: Uint8Array, fileSize: number, raw: RawRead, write: (b: Uint8Array) => Promise<void> | void, pause?: () => Promise<void>) {
  const src = await openEncrypted(dataKey, fileSize, raw);
  try {
    for (let off = 0; off < src.size; off += FRAME) {
      await write(await src.read(off, FRAME));
      if (pause) await pause();
    }
  } finally { src.close(); }
}
