// Encrypted backup of the identity and the conversations, protected by a passphrase. Plain TypeScript, so it can be tested in Node.
//
// File: JSON text { "direct-backup": 1, "kdf": "scrypt", "N", "r", "p", "salt", "nonce", "ct" }.
//   key = scrypt(passphrase, salt, N, r, p) (32 bytes);  ct = secretbox(JSON of BackupData, nonce, key)
// The file holds the secret keys of the identity, so it is only as safe as the passphrase. Files (pictures, voice,
// video) are not part of it.
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';
import { scrypt } from 'scrypt-js';
import { Identity } from './crypto';

export const BACKUP_VERSION = 1;
export const BACKUP_EXT = 'direct';
export const MIN_PASSPHRASE = 12; // characters
export const KDF_N = 1 << 15; // 32768: about 32 MB of memory
export const KDF_R = 8;
export const KDF_P = 1;
const N_MIN = 1 << 12, N_MAX = 1 << 16; // what a file may ask for (a bad file cannot make the phone run out of memory)

// What goes into a backup. `state` is the saved app state without the settings that belong to one phone.
export type BackupData = { v: 1; at: number; identity: Identity; state: Record<string, any> };
export type BackupError = 'format' | 'passphrase' | 'damaged';
export type BackupResult = { ok: true; data: BackupData } | { ok: false; error: BackupError };
type Progress = (p: number) => void;

// Settings of the phone itself are not carried to another phone: where files go, the app lock and the one-time questions.
export const PHONE_ONLY = ['fileMode', 'lockOn', 'lockDelay', 'storagePrompted', 'orphanAsked', 'introSeen'] as const;
export function backupState(saved: Record<string, any>): Record<string, any> {
  const s = JSON.parse(JSON.stringify(saved)) as Record<string, any>;
  for (const k of PHONE_ONLY) delete s[k];
  // Files are not in the backup. Their messages stay, but without an address that points to nothing.
  for (const list of Object.values(s.messages ?? {}) as any[][]) for (const m of list) if (m?.file) m.file = { ...m.file, uri: '' };
  return s;
}

// A passphrase must be long enough to be worth anything; the phone cannot check that it is a good one.
export function passphraseProblem(p: string): 'short' | 'same' | null {
  if (p.length < MIN_PASSPHRASE) return 'short';
  if (new Set(p).size < 4) return 'same'; // "aaaaaaaaaaaa"
  return null;
}

const pw = (p: string): Uint8Array => {
  let t = p;
  try { t = p.normalize('NFC'); } catch {} // å, ä, ö typed in different ways give the same key
  return decodeUTF8(t);
};

export async function createBackup(data: BackupData, passphrase: string, o: { N?: number; onProgress?: Progress } = {}): Promise<string> {
  const N = o.N ?? KDF_N;
  const salt = nacl.randomBytes(16), nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const key = await scrypt(pw(passphrase), salt, N, KDF_R, KDF_P, 32, o.onProgress ? p => { o.onProgress!(p); } : undefined);
  const ct = nacl.secretbox(decodeUTF8(JSON.stringify(data)), nonce, key);
  key.fill(0);
  return JSON.stringify({ 'direct-backup': BACKUP_VERSION, kdf: 'scrypt', N, r: KDF_R, p: KDF_P, salt: encodeBase64(salt), nonce: encodeBase64(nonce), ct: encodeBase64(ct) });
}

const SIZES = { boxPublic: 32, boxSecret: 32, signPublic: 32, signSecret: 64 } as const;
const decodeLen = (s: string) => { try { return decodeBase64(s).length; } catch { return -1; } };
// A real identity: all four keys, of the right size, and each public key belongs to its secret key.
function isId(i: any): i is Identity {
  if (!i || !Object.entries(SIZES).every(([k, n]) => typeof i[k] === 'string' && decodeLen(i[k]) === n)) return false;
  const box = nacl.box.keyPair.fromSecretKey(decodeBase64(i.boxSecret));
  const sign = nacl.sign.keyPair.fromSecretKey(decodeBase64(i.signSecret));
  return encodeBase64(box.publicKey) === i.boxPublic && encodeBase64(sign.publicKey) === i.signPublic;
}

export async function readBackup(text: string, passphrase: string, onProgress?: Progress): Promise<BackupResult> {
  let f: any, salt: Uint8Array, nonce: Uint8Array, ct: Uint8Array;
  try {
    f = JSON.parse(text);
    if (!f || f['direct-backup'] !== BACKUP_VERSION || f.kdf !== 'scrypt' || f.r !== KDF_R || f.p !== KDF_P) return { ok: false, error: 'format' };
    if (!Number.isInteger(f.N) || f.N < N_MIN || f.N > N_MAX || (f.N & (f.N - 1)) !== 0) return { ok: false, error: 'format' };
    salt = decodeBase64(f.salt); nonce = decodeBase64(f.nonce); ct = decodeBase64(f.ct);
    if (salt.length !== 16 || nonce.length !== nacl.secretbox.nonceLength || ct.length < nacl.secretbox.overheadLength) return { ok: false, error: 'format' };
  } catch { return { ok: false, error: 'format' }; }
  const key = await scrypt(pw(passphrase), salt, f.N, f.r, f.p, 32, onProgress ? p => { onProgress(p); } : undefined);
  const plain = nacl.secretbox.open(ct, nonce, key);
  key.fill(0);
  if (!plain) return { ok: false, error: 'passphrase' }; // wrong passphrase, or the file was changed
  try {
    const d = JSON.parse(encodeUTF8(plain));
    if (d?.v !== 1 || !isId(d.identity) || !d.state || typeof d.state !== 'object' || Array.isArray(d.state)) return { ok: false, error: 'damaged' };
    return { ok: true, data: d as BackupData };
  } catch { return { ok: false, error: 'damaged' }; }
}

// What a restore puts in place of the current state: the backed-up state on top of the phone's own settings.
export function applyBackup(current: Record<string, any>, data: BackupData): Record<string, any> {
  const own: Record<string, any> = {};
  for (const k of PHONE_ONLY) if (k in current) own[k] = current[k];
  return { ...current, ...data.state, ...own, introSeen: true, contacts: data.state.contacts ?? {}, blocked: data.state.blocked ?? {}, messages: data.state.messages ?? {} };
}

export const backupFileName = (d: Date) => `Direct-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.${BACKUP_EXT}`;
