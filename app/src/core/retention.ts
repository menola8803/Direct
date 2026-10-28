// How long conversations are kept on THIS phone. Pure functions, so they can be tested without the app.
// The setting is local: every person sets their own time, and nothing is deleted on the other person's phone.
export const RETENTION_DAYS = [1, 7, 14, 30, 60, 90] as const;
export const DEFAULT_RETENTION = 14; // two weeks
export const MAX_RETENTION = 90; // three months
const DAY = 86_400_000;

// Anything that is not a sensible number of days becomes the default; the value never exceeds the maximum.
export function normRetention(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v < 1) return DEFAULT_RETENTION;
  return Math.min(MAX_RETENTION, v);
}

// Messages and files older than this moment (milliseconds since epoch) are removed.
export const cutoffFor = (days: unknown, now: number) => now - normRetention(days) * DAY;

type Keepable = { at: number; file?: { uri: string } };

// Drops every message older than the retention time. Returns the same object when nothing was removed, so callers
// can skip saving, and the addresses of the attachments that belonged to the removed messages.
export function pruneMessages<T extends Keepable>(all: Record<string, T[]>, days: unknown, now: number): { messages: Record<string, T[]>; removedUris: string[]; changed: boolean } {
  const cut = cutoffFor(days, now);
  const removedUris: string[] = [];
  let changed = false;
  const messages: Record<string, T[]> = {};
  for (const [id, list] of Object.entries(all)) {
    const kept = list.filter(m => m.at >= cut);
    if (kept.length !== list.length) {
      changed = true;
      for (const m of list) if (m.at < cut && m.file?.uri) removedUris.push(m.file.uri);
    }
    if (kept.length) messages[id] = kept;
    else if (list.length === 0) messages[id] = list;
  }
  return changed ? { messages, removedUris, changed } : { messages: all, removedUris, changed };
}

// Folder name for one contact inside Download/Direct: the name people recognise plus the start of the id,
// so two contacts with the same name never share a folder and the folder can be found from the id.
export function folderName(name: string, contactId: string): string {
  const tag = contactId.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'x';
  const base = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim().slice(0, 40) || 'kontakt';
  return `${base}-${tag}`;
}
// photo.jpg, then photo (2).jpg, photo (3).jpg ... the first name that is free. `taken` says if a name is already used.
export function uniqueName(taken: (name: string) => boolean, name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 1; i < 1000; i++) {
    const n = i === 1 ? name : `${base} (${i})${ext}`;
    if (!taken(n)) return n;
  }
  return `${Date.now()}-${name}`;
}

// Compares two file addresses even if one of them has spaces written as %20.
export function sameUri(a: string, b: string): boolean {
  const dec = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
  return a === b || dec(a) === dec(b);
}

export const folderTag = (contactId: string) => `-${contactId.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'x'}`;
