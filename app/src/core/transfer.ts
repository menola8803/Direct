// Filöverföring i bitar över den krypterade datakanalen (används för filer, röst- och videomeddelanden).
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
import { FileKind, Plain } from './protocol';

export const CHUNK = 8192;
export const MAX_SIZE = 50 * 1024 * 1024;

export interface Source { size: number; read(offset: number, len: number): Promise<Uint8Array> }
export interface Sink { write(b: Uint8Array): Promise<void>; finish(): Promise<string>; abort(): Promise<void> }
export type Meta = { id: string; name: string; mime: string; size: number; kind: FileKind; at: number; dur?: number };

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
export const safeName = (n: string) => (n.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').slice(0, 80) || 'fil');

export async function sendFile(
  meta: Meta, src: Source,
  io: { send: (p: Plain) => boolean; buffered: () => number; isOpen: () => boolean; onProgress?: (done: number, total: number) => void },
): Promise<boolean> {
  if (src.size > MAX_SIZE) return false;
  const chunks = Math.max(1, Math.ceil(src.size / CHUNK));
  if (!io.send({ t: 'file', id: meta.id, name: meta.name, mime: meta.mime, size: src.size, kind: meta.kind, chunks, at: meta.at, dur: meta.dur })) return false;
  for (let i = 0; i < chunks; i++) {
    while (io.buffered() > 256 * 1024) { if (!io.isOpen()) return false; await wait(15); }
    const part = await src.read(i * CHUNK, Math.min(CHUNK, src.size - i * CHUNK));
    if (!io.send({ t: 'chunk', id: meta.id, i, d: encodeBase64(part) })) return false;
    io.onProgress?.(i + 1, chunks);
  }
  return true;
}

type Incoming = { meta: Meta; chunks: number; next: number; got: number; sink: Sink; busy: Promise<void> };

export class Receiver {
  private cur = new Map<string, Incoming>();
  constructor(private o: { makeSink: (m: Meta) => Promise<Sink>; onDone: (m: Meta, uri: string) => void; onFail?: (id: string) => void; maxParallel?: number }) {}

  async handle(p: Plain): Promise<void> {
    if (p.t === 'file') {
      if (this.cur.has(p.id)) return;
      const ok = Number.isInteger(p.size) && p.size >= 0 && p.size <= MAX_SIZE && p.chunks === Math.max(1, Math.ceil(p.size / CHUNK)) && this.cur.size < (this.o.maxParallel ?? 3);
      if (!ok) { this.o.onFail?.(p.id); return; }
      const meta: Meta = { id: p.id, name: safeName(p.name), mime: String(p.mime).slice(0, 80), size: p.size, kind: p.kind, at: p.at, dur: p.dur };
      const inc: Incoming = { meta, chunks: p.chunks, next: 0, got: 0, sink: null as unknown as Sink, busy: Promise.resolve() };
      this.cur.set(p.id, inc);
      inc.busy = this.o.makeSink(meta).then(s => { inc.sink = s; }).catch(() => { this.fail(p.id); });
    } else if (p.t === 'chunk') {
      const inc = this.cur.get(p.id);
      if (!inc) return;
      // Serialisera: bitarna kommer i ordning men skrivningarna är asynkrona.
      inc.busy = inc.busy.then(async () => {
        if (!this.cur.has(p.id)) return;
        if (p.i !== inc.next) { await this.fail(p.id); return; }
        const b = decodeBase64(p.d);
        inc.got += b.length;
        if (inc.got > inc.meta.size) { await this.fail(p.id); return; }
        await inc.sink.write(b);
        inc.next++;
        if (inc.next === inc.chunks) {
          if (inc.got !== inc.meta.size) { await this.fail(p.id); return; }
          this.cur.delete(p.id);
          this.o.onDone(inc.meta, await inc.sink.finish());
        }
      }).catch(() => this.fail(p.id));
      await inc.busy;
    } else if (p.t === 'abort') await this.fail(p.id, true);
  }

  private async fail(id: string, quiet = false) {
    const inc = this.cur.get(id);
    if (!inc) return;
    this.cur.delete(id);
    try { await inc.sink?.abort(); } catch {}
    if (!quiet) this.o.onFail?.(id);
  }

  // Länken föll: kasta halvfärdiga överföringar (avsändaren skickar om hela filen).
  async dropAll() { for (const id of [...this.cur.keys()]) await this.fail(id, true); }
}
