// Encryption of the data kept on this phone (contacts, messages, settings). Plain TypeScript, so it can be tested in Node.
//
// The data key is 32 random bytes that live only in the phone's secure storage (Android Keystore, via expo-secure-store).
// The saved state is sealed with it (XSalsa20-Poly1305), so a copy of the app's data folder, a backup or a forensic
// dump of the storage is unreadable without the key. It does not stop someone who can unlock the phone and open the
// app: that is what the app lock is for (see lock.ts).
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';

export const SEALED_PREFIX = 'enc1:';

export const newDataKey = (): Uint8Array => nacl.randomBytes(32);
export const keyToText = (k: Uint8Array) => encodeBase64(k);
// The key from its stored text, or null when it is missing or not a 32-byte key.
export function keyFromText(t: string | null | undefined): Uint8Array | null {
  if (!t) return null;
  try { const k = decodeBase64(t); return k.length === 32 ? k : null; } catch { return null; }
}

export const isSealed = (v: string | null | undefined): boolean => typeof v === 'string' && v.startsWith(SEALED_PREFIX);

// text -> "enc1:" + base64(nonce || ciphertext). A new random nonce every time.
export function sealText(key: Uint8Array, text: string): string {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(decodeUTF8(text), nonce, key);
  const out = new Uint8Array(nonce.length + box.length);
  out.set(nonce); out.set(box, nonce.length);
  return SEALED_PREFIX + encodeBase64(out);
}
// The text, or null when the data is not sealed, was changed, or the key is wrong.
export function openText(key: Uint8Array, sealed: string): string | null {
  try {
    if (!isSealed(sealed) || key.length !== 32) return null;
    const all = decodeBase64(sealed.slice(SEALED_PREFIX.length));
    if (all.length < nacl.secretbox.nonceLength + nacl.secretbox.overheadLength) return null;
    const plain = nacl.secretbox.open(all.slice(nacl.secretbox.nonceLength), all.slice(0, nacl.secretbox.nonceLength), key);
    return plain ? encodeUTF8(plain) : null;
  } catch { return null; }
}

export type Opened = {
  state: unknown | null;
  // fresh: nothing saved yet. ok: read the sealed state. legacy: an older plain-text state (to be sealed on the next save).
  // lost: something was saved but cannot be read (key gone or data damaged); the app starts empty.
  status: 'fresh' | 'ok' | 'legacy' | 'lost';
};
const parse = (t: string): unknown | null => { try { const v = JSON.parse(t); return v && typeof v === 'object' ? v : null; } catch { return null; } };

// Decides what to load. `sealed` is the new sealed state, `legacy` the old plain-text one from before 0.13.0.
// An older plain-text state is only used when the sealed one does not exist or cannot be read.
export function openStored(sealed: string | null, legacy: string | null, key: Uint8Array | null): Opened {
  if (sealed != null) {
    const t = key ? openText(key, sealed) : null;
    const s = t != null ? parse(t) : null;
    if (s) return { state: s, status: 'ok' };
  }
  if (legacy != null) {
    const s = parse(legacy);
    if (s) return { state: s, status: 'legacy' };
  }
  return { state: null, status: sealed != null || legacy != null ? 'lost' : 'fresh' };
}

// Saves with a short delay so a burst of changes is written once, and one write at a time, in order.
// flush() writes at once (when the app goes to the background), cancel() drops what is waiting (when everything is wiped).
export function makeSaver(write: (text: string) => Promise<void>, delay = 400) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latest: (() => string) | null = null;
  let chain: Promise<void> = Promise.resolve();
  const run = (): Promise<void> => {
    timer = null;
    const get = latest; latest = null;
    if (get) { const text = get(); chain = chain.then(() => write(text)).catch(() => {}); }
    return chain;
  };
  return {
    schedule(get: () => string) { latest = get; if (timer == null) timer = setTimeout(run, delay); },
    flush(): Promise<void> { if (timer != null) clearTimeout(timer); return run(); },
    cancel(): Promise<void> { if (timer != null) clearTimeout(timer); timer = null; latest = null; return chain; },
  };
}
