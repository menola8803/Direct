// Samtalslogik (1:1 och konferens, mesh) utan beroenden till React Native – kan testas i Node.
// Signaling goes as encrypted messages over the already open data channel.
import { Plain } from '../core/protocol';

export type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'active';
export type PeerState = 'ringing' | 'connecting' | 'in' | 'declined';
export type CallView = {
  status: CallStatus; cid: string; video: boolean; from?: string;
  peers: Record<string, PeerState>; muted: boolean; camOff: boolean; local: any | null; startedAt?: number;
};
export const MAX_VIDEO = 4, MAX_AUDIO = 8; // including yourself (mesh: every participant sends to all others)

export type CallDeps = {
  mySign: string;
  contactBySign: (sign: string) => { id: string; signPub: string } | undefined;
  contactById: (id: string) => { id: string; signPub: string } | undefined;
  send: (id: string, p: Plain) => boolean;
  connect: (id: string) => void;
  isOpen: (id: string) => boolean;
  getMedia: (video: boolean) => Promise<any>;
  stopMedia: (s: any) => void;
  setLocal: (id: string, s: any | null) => void;
  onChange: (v: CallView) => void;
  newId: () => string;
  ringMs?: number;
};

const idle = (): CallView => ({ status: 'idle', cid: '', video: false, peers: {}, muted: false, camOff: false, local: null });

export class CallController {
  v: CallView = idle();
  private members: string[] = [];           // signPub of everyone in the call (incl. me)
  private pendingSend = new Map<string, Plain>(); // messages waiting for an open link
  private early = new Set<string>();        // som tackat ja innan jag svarat
  private ring: any;
  constructor(private d: CallDeps) {}

  private set(p: Partial<CallView>) { this.v = { ...this.v, ...p }; this.d.onChange(this.v); }
  private peer(id: string, s: PeerState) { this.set({ peers: { ...this.v.peers, [id]: s } }); }
  private drop(id: string) { const p = { ...this.v.peers }; delete p[id]; this.set({ peers: p }); }

  private deliver(id: string, p: Plain) {
    if (this.d.isOpen(id) && this.d.send(id, p)) { this.pendingSend.delete(id + p.t + (p as any).k); return; }
    this.pendingSend.set(id + p.t + (p as any).k, p);
    (this.pendingSend.get(id + p.t + (p as any).k) as any)._to = id;
    this.d.connect(id);
  }
  onLink(id: string, st: string) {
    if (st !== 'open') return;
    for (const [k, p] of [...this.pendingSend]) if ((p as any)._to === id) { const { _to, ...clean } = p as any; if (this.d.send(id, clean)) this.pendingSend.delete(k); }
    if (this.v.local && this.v.peers[id] === 'in') this.d.setLocal(id, this.v.local);
  }

  async start(ids: string[], video: boolean): Promise<boolean> {
    if (this.v.status !== 'idle') return false;
    if (ids.length + 1 > (video ? MAX_VIDEO : MAX_AUDIO) || ids.length === 0) return false;
    let local: any;
    try { local = await this.d.getMedia(video); } catch { return false; }
    const cid = this.d.newId();
    this.members = [this.d.mySign, ...ids.map(i => this.d.contactById(i)!.signPub)];
    const peers: Record<string, PeerState> = {};
    for (const i of ids) peers[i] = 'ringing';
    this.v = { ...idle(), status: 'outgoing', cid, video, peers, local };
    this.d.onChange(this.v);
    for (const i of ids) this.deliver(i, { t: 'call', k: 'invite', cid, video, members: this.members });
    this.armRing();
    return true;
  }

  async accept(): Promise<boolean> {
    if (this.v.status !== 'incoming') return false;
    clearTimeout(this.ring);
    let local: any;
    try { local = await this.d.getMedia(this.v.video); } catch { this.decline(); return false; }
    const { cid, from } = this.v;
    const peers: Record<string, PeerState> = {};
    for (const sign of this.members) {
      if (sign === this.d.mySign) continue;
      const c = this.d.contactBySign(sign); if (!c) continue; // unknown to me: cannot connect
      peers[c.id] = this.early.has(c.id) || c.id === from ? 'in' : 'connecting';
    }
    this.set({ status: 'active', peers, local, startedAt: Date.now() });
    for (const id of Object.keys(peers)) {
      this.deliver(id, { t: 'call', k: 'accept', cid, video: this.v.video });
      if (peers[id] === 'in' && this.d.isOpen(id)) this.d.setLocal(id, local);
    }
    this.early.clear();
    this.armRing();
    return true;
  }

  decline() {
    if (this.v.status !== 'incoming') return;
    clearTimeout(this.ring);
    if (this.v.from) this.deliver(this.v.from, { t: 'call', k: 'decline', cid: this.v.cid, video: this.v.video });
    this.reset();
  }

  end() {
    if (this.v.status === 'idle') return;
    if (this.v.status === 'incoming') return this.decline();
    for (const [id, st] of Object.entries(this.v.peers)) {
      if (st !== 'declined') this.deliver(id, { t: 'call', k: 'end', cid: this.v.cid, video: this.v.video });
      this.d.setLocal(id, null);
    }
    this.reset();
  }

  private reset() {
    clearTimeout(this.ring);
    if (this.v.local) this.d.stopMedia(this.v.local);
    this.members = []; this.early.clear(); this.pendingSend.clear();
    this.v = idle(); this.d.onChange(this.v);
  }

  private armRing() {
    clearTimeout(this.ring);
    this.ring = setTimeout(() => {
      if (this.v.status === 'incoming') return this.decline();
      if (this.v.status === 'outgoing' || this.v.status === 'active') {
        // Anyone who has not answered (ringing) or never connected (connecting) is dropped.
        for (const [id, st] of Object.entries(this.v.peers)) if (st === 'ringing' || st === 'connecting') { this.deliver(id, { t: 'call', k: 'end', cid: this.v.cid, video: this.v.video }); this.drop(id); }
        this.check();
      }
    }, this.d.ringMs ?? 45000);
  }

  // End the call if there is nobody left to talk to.
  private check() {
    if (this.v.status === 'idle' || this.v.status === 'incoming') return;
    const live = Object.values(this.v.peers).some(s => s === 'in' || s === 'ringing' || s === 'connecting');
    if (!live) this.end();
  }

  toggleMute() {
    const muted = !this.v.muted;
    this.v.local?.getAudioTracks?.().forEach((t: any) => { t.enabled = !muted; });
    this.set({ muted });
  }
  toggleCam() {
    const camOff = !this.v.camOff;
    this.v.local?.getVideoTracks?.().forEach((t: any) => { t.enabled = !camOff; });
    this.set({ camOff });
  }

  handle(id: string, p: Plain) {
    if (p.t !== 'call') return;
    const k = p.k;
    if (k === 'invite') {
      if (this.v.status !== 'idle') { if (this.v.cid !== p.cid) this.d.send(id, { t: 'call', k: 'decline', cid: p.cid, video: p.video }); return; }
      const cap = p.video ? MAX_VIDEO : MAX_AUDIO;
      if (!p.members || p.members.length > cap) { this.d.send(id, { t: 'call', k: 'decline', cid: p.cid, video: p.video }); return; }
      this.members = p.members.slice(0, 16);
      this.v = { ...idle(), status: 'incoming', cid: p.cid, video: p.video, from: id };
      this.d.onChange(this.v);
      this.armRing();
      return;
    }
    if (p.cid !== this.v.cid && !(this.v.status === 'idle' && k === 'accept')) return;
    if (k === 'accept') {
      if (this.v.status === 'incoming') { this.early.add(id); return; }
      if (this.v.status === 'idle') return;
      const first = this.v.status === 'outgoing';
      this.set({ peers: { ...this.v.peers, [id]: 'in' }, ...(first ? { status: 'active' as const, startedAt: Date.now() } : {}) });
      if (this.v.local && this.d.isOpen(id)) this.d.setLocal(id, this.v.local);
    } else if (k === 'decline') {
      if (this.v.status === 'outgoing' || this.v.status === 'active') { this.peer(id, 'declined'); this.check(); }
    } else if (k === 'end') {
      if (this.v.status === 'incoming') { if (id === this.v.from) { clearTimeout(this.ring); this.reset(); } return; }
      if (this.v.peers[id]) { this.d.setLocal(id, null); this.drop(id); this.check(); }
    }
  }
}
