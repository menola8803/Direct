// Files on the phone. There are two places:
//  - Download/Direct: a folder you can open in the Files app. Used when Android has given Direct "all files access".
//    Android does not delete it when the app is uninstalled (see "Delete everything and uninstall" in Settings → Storage).
//  - The app's own private folder: the fallback without that permission, and where files from older versions stay.
//    Android deletes it when the app is uninstalled.
// An update of the app never touches either place.
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { Meta, Sink, Source, safeName } from './core/transfer';
import { folderName, folderTag, sameUri, uniqueName } from './core/retention';

export const PUBLIC_LABEL = 'Download/Direct';
const DOWNLOADS_URI = 'file:///storage/emulated/0/Download';
const PUBLIC_URI = `${DOWNLOADS_URI}/Direct`;
const NOMEDIA = '.nomedia';

const publicRoot = () => new Directory(PUBLIC_URI);
const privateRoot = () => new Directory(Paths.document, 'direct');
const cleanId = (id: string) => id.replace(/[^a-z0-9]/gi, '');
const legacyDir = (id: string) => new Directory(privateRoot(), cleanId(id));

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

const openDir = (id: string, name: string): Directory => (publicOk
  ? ensureDir(publicRoot(), folderName(name, id))
  : ensureDir(ensureDir(Paths.document, 'direct'), cleanId(id)));
// The folder for new files of a contact. If Download/Direct stops working (permission taken away) the private folder is used.
function usableDir(id: string, name: string): Directory {
  try { return openDir(id, name); }
  catch (e) { if (!publicOk) throw e; publicOk = false; return openDir(id, name); }
}
// The folders that belong to one contact, in both places.
function dirsOf(id: string): Directory[] {
  const out: Directory[] = [legacyDir(id)];
  try {
    const r = publicRoot();
    if (r.exists) for (const x of r.list()) if (x instanceof Directory && x.name.endsWith(folderTag(id))) out.push(x);
  } catch {}
  return out;
}
function allContactDirs(): Directory[] {
  const out: Directory[] = [];
  for (const r of [publicRoot(), privateRoot()]) {
    try { if (r.exists) for (const x of r.list()) if (x instanceof Directory) out.push(x); } catch {}
  }
  return out;
}
const freeName = (dir: Directory, name: string) => uniqueName(n => new File(dir, n).exists, name);
const slash = (u: string) => (u.endsWith('/') ? u : `${u}/`);
// Only files inside the app's own places may be deleted by the retention rules.
const ours = (uri: string) => [PUBLIC_URI, privateRoot().uri, Paths.cache.uri].some(p => uri.startsWith(slash(p)));

export function fileSource(uri: string): { src: Source; close: () => void } {
  const f = new File(uri);
  const h = f.open(FileMode.ReadOnly);
  return {
    src: { size: f.size, read: async (offset, len) => { h.offset = offset; return h.readBytes(len); } },
    close: () => { try { h.close(); } catch {} },
  };
}

// A received file is written to the contact's folder as it arrives.
export const makeSink = (contactId: string, contactName: string) => async (m: Meta): Promise<Sink> => {
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
export async function storeOutgoing(contactId: string, contactName: string, uri: string, name: string): Promise<string> {
  try {
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
// Removes all the app's files: Download/Direct (the whole folder), the private folder and the cache.
export function wipeAllFiles() {
  for (const d of [publicRoot(), privateRoot()]) { try { if (d.exists) d.delete(); } catch {} }
  deleteCache();
  publicOk = false;
}
