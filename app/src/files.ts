// Files on the phone. There are two places:
//  - Download/Direct: a folder you can open in the Files app. Used when Android has given Direct "all files access".
//    Android does not delete it when the app is uninstalled (see "Delete everything and uninstall" in Settings → Storage).
//  - The app's own private folder: the fallback without that permission, and where files from older versions stay.
//    Android deletes it when the app is uninstalled.
// A third place is chosen in Settings → Storage: "private and encrypted". Files are then sealed with a key from the phone's
// secure storage (core/filecrypt.ts) and kept in the app's own folder direct-enc, where neither the Files app nor the
// Gallery sees them. Android deletes that folder when the app is uninstalled too.
// An update of the app never touches any of these places.
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { Meta, Sink, Source, safeName } from './core/transfer';
import { folderName, folderTag, sameUri, uniqueName } from './core/retention';
import { FRAME, FileEncryptor, decryptAll, openEncrypted } from './core/filecrypt';

export const PUBLIC_LABEL = 'Download/Direct';
const DOWNLOADS_URI = 'file:///storage/emulated/0/Download';
const PUBLIC_URI = `${DOWNLOADS_URI}/Direct`;
const NOMEDIA = '.nomedia';

const publicRoot = () => new Directory(PUBLIC_URI);
const privateRoot = () => new Directory(Paths.document, 'direct');
const cleanId = (id: string) => id.replace(/[^a-z0-9]/gi, '');
const legacyDir = (id: string) => new Directory(privateRoot(), cleanId(id));
const encRoot = () => new Directory(Paths.document, 'direct-enc');
const encDir = (id: string) => new Directory(encRoot(), cleanId(id));

// Where new files go, set by the store from the Settings choice, and the key that seals the private files.
export type StoreMode = 'visible' | 'private';
let mode: StoreMode = 'visible';
let dataKey: Uint8Array | null = null;
export const setFileMode = (m: StoreMode) => { mode = m === 'private' ? 'private' : 'visible'; };
export const setFileKey = (k: Uint8Array | null) => { dataKey = k; };
const pause = () => new Promise<void>(r => setTimeout(r, 0)); // lets the app draw between two steps of heavy work

let publicOk = false;
export const usingPublic = () => publicOk;

// expo-file-system asks Android "may I write here?" about the very path being created. For a path that does not exist
// yet Android says no (File.canWrite() is false), even with all-files access, so Directory.create() and File.create()
// fail outside the app's own folders. createDirectory() and createFile() on an existing parent check the parent instead,
// so every folder and file below is made that way.
function ensureDir(parent: Directory, name: string): Directory {
  if (!new Directory(parent, name).exists) parent.createDirectory(name);
  return new Directory(parent, name);
}
// An existing, writable, empty file called `name` in `dir` (an old file of that name is replaced when `replace` is set).
function makeFile(dir: Directory, name: string, replace = false): File {
  const f = new File(dir, name);
  if (replace && f.exists) f.delete();
  if (!new File(dir, name).exists) dir.createFile(name, null);
  return new File(dir, name);
}

// Tries to create Download/Direct and write in it. Returns true when the folder is usable.
export function probePublic(): boolean {
  try {
    const root = ensureDir(new Directory(DOWNLOADS_URI), 'Direct');
    // .nomedia keeps received pictures and videos out of the Gallery and its cloud backup.
    makeFile(root, NOMEDIA);
    publicOk = root.exists && new File(root, NOMEDIA).exists;
  } catch { publicOk = false; }
  return publicOk;
}

// An encrypted file is recognised by where it is kept, not by its name.
export const isEncrypted = (uri: string) => uri.startsWith(slash(encRoot().uri));

const openDir = (id: string, name: string): Directory => (publicOk
  ? ensureDir(publicRoot(), folderName(name, id))
  : ensureDir(ensureDir(Paths.document, 'direct'), cleanId(id)));
// The folder for new files of a contact. If Download/Direct stops working (permission taken away) the private folder is used.
function usableDir(id: string, name: string): Directory {
  if (mode === 'private') return ensureDir(ensureDir(Paths.document, 'direct-enc'), cleanId(id));
  try { return openDir(id, name); }
  catch (e) { if (!publicOk) throw e; publicOk = false; return openDir(id, name); }
}
// The folders that belong to one contact, in both places.
function dirsOf(id: string): Directory[] {
  const out: Directory[] = [legacyDir(id), encDir(id)];
  try {
    const r = publicRoot();
    if (r.exists) for (const x of r.list()) if (x instanceof Directory && x.name.endsWith(folderTag(id))) out.push(x);
  } catch {}
  return out;
}
function allContactDirs(): Directory[] {
  const out: Directory[] = [];
  for (const r of [publicRoot(), privateRoot(), encRoot()]) {
    try { if (r.exists) for (const x of r.list()) if (x instanceof Directory) out.push(x); } catch {}
  }
  return out;
}
const freeName = (dir: Directory, name: string) => uniqueName(n => new File(dir, n).exists, name);
const slash = (u: string) => (u.endsWith('/') ? u : `${u}/`);
// Only files inside the app's own places may be deleted by the retention rules.
const ours = (uri: string) => [PUBLIC_URI, privateRoot().uri, encRoot().uri, Paths.cache.uri].some(p => uri.startsWith(slash(p)));

export function fileSource(uri: string): { src: Source; close: () => void } {
  const f = new File(uri);
  const h = f.open(FileMode.ReadOnly);
  return {
    src: { size: f.size, read: async (offset, len) => { h.offset = offset; return h.readBytes(len); } },
    close: () => { try { h.close(); } catch {} },
  };
}

// The same for a file that may be encrypted: the content is decrypted piece by piece as it is read.
export async function openSource(uri: string): Promise<{ src: Source; close: () => void }> {
  if (!isEncrypted(uri)) return fileSource(uri);
  if (!dataKey) throw new Error('no key');
  const f = new File(uri);
  const h = f.open(FileMode.ReadOnly);
  try {
    const src = await openEncrypted(dataKey, f.size, async (o, n) => { h.offset = o; return h.readBytes(n); });
    return { src, close: () => { src.close(); try { h.close(); } catch {} } };
  } catch (e) { try { h.close(); } catch {} throw e; }
}

// A plain copy of a file for playing, opening or sharing. An ordinary file is used as it is; an encrypted one is
// decrypted into the cache folder (cache/dec), so a readable copy exists only for as long as it is needed.
// Remove it with discardPlain() when done; clearPlain() removes old ones.
export async function plainCopy(uri: string, name: string): Promise<string> {
  if (!isEncrypted(uri)) return uri;
  if (!dataKey) throw new Error('no key');
  const dir = ensureDir(Paths.cache, 'dec');
  const dest = makeFile(dir, `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}-${safeName(name)}`);
  const f = new File(uri);
  let sh: ReturnType<File['open']> | null = null, dh: ReturnType<File['open']> | null = null;
  try {
    sh = f.open(FileMode.ReadOnly); dh = dest.open(FileMode.ReadWrite);
    const r = sh, w = dh;
    await decryptAll(dataKey, f.size, async (o, n) => { r.offset = o; return r.readBytes(n); }, async b => { await w.writeBytes(b); }, pause);
    return dest.uri;
  } catch (e) { try { dh?.close(); } catch {} try { dest.delete(); } catch {} throw e; } // never leave a half-written readable copy
  finally { try { sh?.close(); } catch {} try { dh?.close(); } catch {} }
}
export function discardPlain(uri: string) {
  try { if (uri.startsWith(slash(new Directory(Paths.cache, 'dec').uri))) { const f = new File(uri); if (f.exists) f.delete(); } } catch {}
}
// The backup file for sharing is written to the cache (it is encrypted by its passphrase). Old ones are removed at start.
export async function writeCacheText(name: string, text: string): Promise<string> {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  await f.write(text);
  return f.uri;
}
export async function readText(uri: string): Promise<string> { return new File(uri).text(); }
export function clearBackupTemps() {
  try { for (const x of Paths.cache.list()) { if (x instanceof File && x.name.startsWith('Direct-backup-')) { try { x.delete(); } catch {} } } } catch {}
}
// Removes decrypted copies older than `maxAgeMs` (0 = all). Called when the app starts and now and then.
export function clearPlain(maxAgeMs = 0) {
  try {
    const d = new Directory(Paths.cache, 'dec');
    if (!d.exists) return;
    const cut = Date.now() - maxAgeMs;
    for (const x of d.list()) { try { if (maxAgeMs === 0 || (x instanceof File && (x.modificationTime ?? 0) < cut)) x.delete(); } catch {} }
  } catch {}
}

// A received file is written to the contact's folder as it arrives. In private mode it is encrypted on the way.
async function encryptedSink(contactId: string, m: Meta): Promise<Sink> {
  if (!dataKey) throw new Error('no key'); // never fall back to an unencrypted copy
  const dir = usableDir(contactId, '');
  const file = makeFile(dir, `${cleanId(m.id) || Date.now().toString(36)}.denc`, true);
  const enc = new FileEncryptor(dataKey);
  const h = file.open(FileMode.ReadWrite);
  try { await h.writeBytes(enc.header()); } catch (e) { try { h.close(); } catch {} try { file.delete(); } catch {} throw e; }
  return {
    write: async b => { const out = enc.push(b); if (out.length) await h.writeBytes(out); },
    finish: async () => { await h.writeBytes(enc.finish()); h.close(); return file.uri; },
    abort: async () => { try { h.close(); } catch {} try { file.delete(); } catch {} },
  };
}
export const makeSink = (contactId: string, contactName: string) => async (m: Meta): Promise<Sink> => {
  if (mode === 'private') return encryptedSink(contactId, m);
  const dir = usableDir(contactId, contactName);
  const file = publicOk ? makeFile(dir, freeName(dir, safeName(m.name))) : makeFile(dir, `${m.id}-${safeName(m.name)}`, true);
  const h = file.open(FileMode.ReadWrite);
  return {
    write: async b => { await h.writeBytes(b); },
    finish: async () => { h.close(); return file.uri; },
    abort: async () => { try { h.close(); } catch {} try { file.delete(); } catch {} },
  };
};

// A file you send is copied to the same place as received files, so it stays in the conversation (and is cleaned up
// by the same rules). Returns the address to use; the original address if copying fails.
async function encryptOutgoing(contactId: string, uri: string): Promise<string> {
  if (!dataKey) throw new Error('no key');
  const dir = usableDir(contactId, '');
  const dest = makeFile(dir, uniqueName(n => new File(dir, n).exists, `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.denc`));
  const src = new File(uri);
  let sh: ReturnType<File['open']> | null = null, dh: ReturnType<File['open']> | null = null;
  try {
    sh = src.open(FileMode.ReadOnly); dh = dest.open(FileMode.ReadWrite);
    const enc = new FileEncryptor(dataKey), size = src.size;
    await dh.writeBytes(enc.header());
    for (let off = 0; off < size; off += FRAME) {
      sh.offset = off;
      const out = enc.push(await sh.readBytes(Math.min(FRAME, size - off)));
      if (out.length) await dh.writeBytes(out);
      await pause();
    }
    await dh.writeBytes(enc.finish());
  } catch (e) { try { dh?.close(); } catch {} try { dest.delete(); } catch {} throw e; } // no empty leftover
  finally { try { sh?.close(); } catch {} try { dh?.close(); } catch {} }
  return dest.uri;
}
export async function storeOutgoing(contactId: string, contactName: string, uri: string, name: string): Promise<string> {
  try {
    if (mode === 'private') {
      const out = await encryptOutgoing(contactId, uri);
      if (uri.startsWith(Paths.cache.uri)) { try { new File(uri).delete(); } catch {} }
      return out;
    }
    const dir = usableDir(contactId, contactName);
    const src = new File(uri);
    const dest = makeFile(dir, freeName(dir, safeName(name)));
    try { await src.copy(dest, { overwrite: true }); } catch (e) { try { dest.delete(); } catch {} throw e; } // no empty leftover
    if (uri.startsWith(Paths.cache.uri)) { try { src.delete(); } catch {} } // the temporary original is not needed any more
    return dest.uri;
  } catch { return uri; }
}

// Delete saved files: for one contact, or everything.
export function deleteFiles(contactId?: string) {
  try {
    if (contactId) { for (const d of dirsOf(contactId)) { try { if (d.exists) d.delete(); } catch {} } return; }
    for (const d of allContactDirs()) { try { d.delete(); } catch {} }
  } catch {}
}
export function deleteCache() {
  try { for (const x of Paths.cache.list()) { try { x.delete(); } catch {} } } catch {}
}
export function usedBytes(contactId?: string): number {
  try {
    const dirs = contactId ? dirsOf(contactId) : allContactDirs();
    return dirs.reduce((n, d) => n + (d.exists ? d.size ?? 0 : 0), 0);
  } catch { return 0; }
}
export const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} kB` : `${(n / 1048576).toFixed(1)} MB`);

// ---- retention (see core/retention.ts)

// Deletes the files that belonged to removed messages.
export function deleteStored(uris: string[]) {
  for (const u of uris) { try { if (ours(u)) { const f = new File(u); if (f.exists) f.delete(); } } catch {} }
}
// Deletes files older than `cutoff` that no remaining message points to, then empty contact folders.
export function sweepOldFiles(cutoff: number, keep: string[]) {
  for (const d of allContactDirs()) {
    try {
      for (const x of d.list()) {
        if (!(x instanceof File)) continue;
        const t = x.modificationTime;
        if (t != null && t < cutoff && !keep.some(k => sameUri(k, x.uri))) { try { x.delete(); } catch {} }
      }
      if (d.list().length === 0) d.delete();
    } catch {}
  }
}

// ---- leftovers and uninstall

// True when Download/Direct holds files (for example from an earlier install that was removed).
export function hasPublicFiles(): boolean {
  try { const r = publicRoot(); return r.exists && r.list().some(x => x.name !== NOMEDIA); } catch { return false; }
}
// Removes all the app's files: Download/Direct (the whole folder), the private folders and the cache.
export function wipeAllFiles() {
  for (const d of [publicRoot(), privateRoot(), encRoot()]) { try { if (d.exists) d.delete(); } catch {} }
  deleteCache();
  publicOk = false;
}
