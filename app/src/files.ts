// Filer på telefonen: privat lagring per kontakt (appens egen mapp), källa/mål för överföringar.
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { Meta, Sink, Source, safeName } from './core/transfer';

const root = () => new Directory(Paths.document, 'direct');
const dirFor = (contactId: string) => new Directory(root(), contactId.replace(/[^a-z0-9]/gi, ''));

export function fileSource(uri: string): { src: Source; close: () => void } {
  const f = new File(uri);
  const h = f.open(FileMode.ReadOnly);
  return {
    src: { size: f.size, read: async (offset, len) => { h.offset = offset; return h.readBytes(len); } },
    close: () => { try { h.close(); } catch {} },
  };
}

export const makeSink = (contactId: string) => async (m: Meta): Promise<Sink> => {
  const dir = dirFor(contactId);
  dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, `${m.id}-${safeName(m.name)}`);
  file.create({ overwrite: true });
  const h = file.open(FileMode.ReadWrite);
  return {
    write: async b => { await h.writeBytes(b); },
    finish: async () => { h.close(); return file.uri; },
    abort: async () => { try { h.close(); } catch {} try { file.delete(); } catch {} },
  };
};

// Radera sparade filer: för en kontakt, eller allt.
export function deleteFiles(contactId?: string) {
  try { const d = contactId ? dirFor(contactId) : root(); if (d.exists) d.delete(); } catch {}
}
export function deleteCache() {
  try { for (const x of Paths.cache.list()) { try { x.delete(); } catch {} } } catch {}
}
export function usedBytes(contactId?: string): number {
  try { const d = contactId ? dirFor(contactId) : root(); return d.exists ? d.size ?? 0 : 0; } catch { return 0; }
}
export const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} kB` : `${(n / 1048576).toFixed(1)} MB`);
