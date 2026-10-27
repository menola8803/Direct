// Platform-independent connection manager: signaling via WebSocket relay, messages via WebRTC data channel.
// WebRTC-implementationen injiceras (react-native-webrtc i appen, wrtc i testerna).
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { decodeBase64, encodeBase64, decodeUTF8, encodeUTF8 } from 'tweetnacl-util';
import { Contact, Identity, open, seal, signText } from '../core/crypto';
import { Frame, Session } from '../core/session';
import { Inner, isInitiator, Plain, Signal } from '../core/protocol';

export type RtcApi = { RTCPeerConnection: any; RTCIceCandidate: any; RTCSessionDescription: any };
export type IceServer = { urls: string | string[]; username?: string; credential?: string };
export type LinkState = 'connecting' | 'open' | 'closed';
export type SignalState = 'connecting' | 'online' | 'offline';

export type PeerOpts = {
  identity: Identity;
  signalUrl: string;
  iceServers: IceServer[];
  relayOnly?: boolean;
  rtc: RtcApi;
  getContactBySign: (signPub: string) => Contact | undefined;
  onPlain: (c: Contact, p: Plain) => void;
  onLink: (contactId: string, s: LinkState) => void;
  onSignal?: (s: SignalState) => void;
  onTrack?: (c: Contact, stream: any, track: any) => void;
  manualTimeoutMs?: number;
  connectTimeoutMs?: number;
};

type Peer = {
  pc: any; dc: any | null; remoteSet: boolean; ice: any[]; state: LinkState; timer?: any;
  manual: boolean; eph: { pub: string; secret: Uint8Array }; sess: Session | null; sentEph: boolean;
  making: boolean; polite: boolean; senders: any[];
};
const b64url = (s: string) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); return t + '='.repeat((4 - (t.length % 4)) % 4); };
export const MANUAL_PREFIX = 'directm1:';

export class PeerManager {
  private ws: WebSocket | null = null;
  private peers = new Map<string, Peer>();
  private stopped = true;
  private retry = 0;
  private retryTimer: any;
  signal: SignalState = 'offline';

  constructor(private o: PeerOpts) {}

  start() {
    this.stopped = false;
    this.openWs();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    this.ws?.close();
    this.ws = null;
    for (const id of [...this.peers.keys()]) this.drop(id, 'closed');
    this.setSignal('offline');
  }

  isOpen(contactId: string) { return this.peers.get(contactId)?.state === 'open'; }
  isSignalOnline() { return this.signal === 'online'; }

  // Try to connect to a contact (unless already in progress).
  connect(c: Contact) {
    const p = this.peers.get(c.id);
    if (p && p.state !== 'closed') return;
    if (!this.isSignalOnline()) return; // utan server: koppla med manuell kod
    if (isInitiator(this.o.identity.signPublic, c.signPub)) this.startOffer(c);
    else this.sendSignal(c, { k: 'hello' });
  }

  send(c: Contact, plain: Plain): boolean {
    return this.sendRaw(c.id, plain);
  }

  private sendRaw(id: string, msg: Plain | Inner): boolean {
    const p = this.peers.get(id);
    if (!p?.dc || p.dc.readyState !== 'open' || !p.sess || p.state !== 'open') return false;
    try { p.dc.send(JSON.stringify(p.sess.encrypt(msg))); return true; } catch { return false; }
  }

  bufferedAmount(id: string): number { return this.peers.get(id)?.dc?.bufferedAmount ?? 0; }

  // ---- media (samtal) ----
  // Adds/replaces local tracks; renegotiated automatically over the encrypted data channel (works without a server too).
  setLocalStream(id: string, stream: any | null) {
    const p = this.peers.get(id);
    if (!p) return;
    for (const s of p.senders) { try { p.pc.removeTrack(s); } catch {} }
    p.senders = [];
    if (stream) for (const t of stream.getTracks()) p.senders.push(p.pc.addTrack(t, stream));
  }

  // ---- manuell koppling utan server ----
  async manualOffer(c: Contact): Promise<string> {
    const p = this.makePeer(c, true);
    this.attach(c, p, p.pc.createDataChannel('direct'));
    const offer = await p.pc.createOffer();
    await p.pc.setLocalDescription(offer);
    await this.gathered(p.pc);
    return this.encodeManual({ k: 'offer', sdp: p.pc.localDescription.sdp }, c);
  }

  async manualAnswer(c: Contact, code: string): Promise<string> {
    const s = this.decodeManual(code, c);
    if (s?.k !== 'offer') throw new Error('bad code');
    const p = this.makePeer(c, true);
    await p.pc.setRemoteDescription(new this.o.rtc.RTCSessionDescription({ type: 'offer', sdp: s.sdp }));
    p.remoteSet = true;
    const answer = await p.pc.createAnswer();
    await p.pc.setLocalDescription(answer);
    await this.gathered(p.pc);
    return this.encodeManual({ k: 'answer', sdp: p.pc.localDescription.sdp }, c);
  }

  async manualFinish(c: Contact, code: string) {
    const s = this.decodeManual(code, c);
    const p = this.peers.get(c.id);
    if (s?.k !== 'answer' || !p || p.pc.signalingState !== 'have-local-offer') throw new Error('bad code');
    await p.pc.setRemoteDescription(new this.o.rtc.RTCSessionDescription({ type: 'answer', sdp: s.sdp }));
    p.remoteSet = true;
  }

  // SDP is compressed before encryption so the code is short enough for QR/SMS.
  private encodeManual(s: Signal, c: Contact) {
    const z = s.k === 'offer' || s.k === 'answer' ? { k: s.k, z: encodeBase64(deflateSync(strToU8(s.sdp), { level: 9 })) } : s;
    const body = JSON.stringify({ f: this.o.identity.signPublic, p: seal(z, this.o.identity.boxSecret, c.boxPub) });
    return MANUAL_PREFIX + b64url(encodeBase64(decodeUTF8(body)));
  }
  // Returns the sender's signing key without requiring a known contact (to pick the right contact).
  static manualSender(code: string): string | null {
    try { const i = code.indexOf(MANUAL_PREFIX); if (i < 0) return null; return JSON.parse(encodeUTF8(decodeBase64(unb64url(code.slice(i + MANUAL_PREFIX.length).split(/\s/)[0])))).f ?? null; } catch { return null; }
  }
  private decodeManual(code: string, c: Contact): Signal | null {
    try {
      const i = code.indexOf(MANUAL_PREFIX);
      const j = JSON.parse(encodeUTF8(decodeBase64(unb64url(code.slice(i + MANUAL_PREFIX.length).split(/\s/)[0]))));
      if (j.f !== c.signPub) return null;
      const o = open<any>(j.p, c.boxPub, this.o.identity.boxSecret);
      if (o && typeof o.z === 'string' && (o.k === 'offer' || o.k === 'answer')) return { k: o.k, sdp: strFromU8(inflateSync(decodeBase64(o.z))) };
      return null;
    } catch { return null; }
  }
  private gathered(pc: any, ms = 6000) {
    return new Promise<void>(res => {
      if (pc.iceGatheringState === 'complete') return res();
      const done = () => { clearTimeout(t); pc.removeEventListener('icegatheringstatechange', ch); res(); };
      const ch = () => { if (pc.iceGatheringState === 'complete') done(); };
      const t = setTimeout(done, ms);
      pc.addEventListener('icegatheringstatechange', ch);
    });
  }

  // ---- signalering ----
  private setSignal(s: SignalState) { if (this.signal !== s) { this.signal = s; this.o.onSignal?.(s); } }

  private openWs() {
    if (this.stopped || !this.o.signalUrl) return;
    this.setSignal('connecting');
    let ws: WebSocket;
    try { ws = new WebSocket(this.o.signalUrl); } catch { return this.scheduleRetry(); }
    this.ws = ws;
    ws.onmessage = ev => {
      let m: any; try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m.type === 'challenge') {
        ws.send(JSON.stringify({ type: 'hello', sign: this.o.identity.signPublic, sig: signText(m.nonce, this.o.identity.signSecret) }));
      } else if (m.type === 'ready') {
        this.retry = 0; this.setSignal('online');
      } else if (m.type === 'relay') {
        this.onRelay(m.from, m.payload).catch(() => {});
      }
    };
    ws.onclose = () => { if (this.ws === ws) { this.ws = null; this.setSignal('offline'); this.scheduleRetry(); } };
    ws.onerror = () => {};
  }

  private scheduleRetry() {
    if (this.stopped) return;
    const delay = Math.min(30000, 1000 * 2 ** this.retry++);
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.openWs(), delay);
  }

  private sendSignal(c: Contact, s: Signal) {
    if (this.ws?.readyState !== 1) return;
    this.ws.send(JSON.stringify({ type: 'relay', to: c.signPub, payload: seal(s, this.o.identity.boxSecret, c.boxPub) }));
  }

  private async onRelay(from: string, payload: any) {
    const c = this.o.getContactBySign(from);
    if (!c) return; // unknown senders are ignored
    const s = open<Signal>(payload, c.boxPub, this.o.identity.boxSecret);
    if (!s || typeof s !== 'object') return;
    if (s.k === 'hello') {
      const ex = this.peers.get(c.id);
      if (ex && ex.state !== 'closed') return; // attempt in progress, do not start another
      if (isInitiator(this.o.identity.signPublic, c.signPub)) await this.startOffer(c);
      return;
    }
    if (s.k === 'offer') return this.onOffer(c, s.sdp);
    const p = this.peers.get(c.id);
    if (!p) return;
    if (s.k === 'answer') { if (p.pc.signalingState !== 'have-local-offer') return; await p.pc.setRemoteDescription(new this.o.rtc.RTCSessionDescription({ type: 'answer', sdp: s.sdp })); p.remoteSet = true; await this.flushIce(p); }
    if (s.k === 'ice') { if (p.remoteSet) await p.pc.addIceCandidate(new this.o.rtc.RTCIceCandidate(s.c)).catch(() => {}); else p.ice.push(s.c); }
  }

  // ---- WebRTC ----
  private makePeer(c: Contact, manual = false): Peer {
    this.drop(c.id, 'closed', true);
    const pc = new this.o.rtc.RTCPeerConnection({ iceServers: this.o.iceServers, iceTransportPolicy: this.o.relayOnly ? 'relay' : 'all' });
    const p: Peer = { pc, dc: null, remoteSet: false, ice: [], state: 'connecting', manual, eph: Session.newEphemeral(), sess: null, sentEph: false, making: false, polite: !isInitiator(this.o.identity.signPublic, c.signPub), senders: [] };
    this.peers.set(c.id, p);
    this.o.onLink(c.id, 'connecting');
    pc.addEventListener('icecandidate', (e: any) => {
      if (e.candidate && !p.manual) this.sendSignal(c, { k: 'ice', c: { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex } });
    });
    pc.addEventListener('connectionstatechange', () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) this.drop(c.id, 'closed');
    });
    pc.addEventListener('datachannel', (e: any) => this.attach(c, p, e.channel));
    pc.addEventListener('track', (e: any) => this.o.onTrack?.(c, e.streams?.[0] ?? null, e.track));
    pc.addEventListener('negotiationneeded', async () => {
      if (p.state !== 'open' || pc.signalingState !== 'stable') return;
      try {
        p.making = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        this.sendRaw(c.id, { t: 'rtc', k: 'offer', sdp: offer.sdp });
      } catch {} finally { p.making = false; }
    });
    const tmo = manual ? (this.o.manualTimeoutMs ?? 180000) : (this.o.connectTimeoutMs ?? 20000);
    p.timer = setTimeout(() => { if (p.state !== 'open') this.drop(c.id, 'closed'); }, tmo);
    return p;
  }

  private attach(c: Contact, p: Peer, dc: any) {
    p.dc = dc;
    const hello = () => {
      if (p.sentEph) return;
      p.sentEph = true;
      try { dc.send(JSON.stringify(seal({ t: 'eph', pub: p.eph.pub }, this.o.identity.boxSecret, c.boxPub))); } catch {}
      this.maybeOpen(c, p);
    };
    dc.addEventListener('open', hello);
    if (dc.readyState === 'open') hello();
    dc.addEventListener('close', () => this.drop(c.id, 'closed'));
    dc.addEventListener('message', (e: any) => {
      let env: any; try { env = JSON.parse(String(e.data)); } catch { return; }
      if (env && env.s === 1) {
        if (!p.sess) return;
        const m = p.sess.decrypt<Plain | Inner>(env as Frame);
        if (!m) return;
        if (m.t === 'rtc') { this.onRtc(c, p, m).catch(() => {}); return; }
        this.o.onPlain(c, m);
        return;
      }
      // Handshake: the only message type allowed to be statically encrypted.
      if (p.sess) return;
      const hs = open<{ t: string; pub: string }>(env, c.boxPub, this.o.identity.boxSecret);
      if (!hs || hs.t !== 'eph' || typeof hs.pub !== 'string') return;
      try { p.sess = new Session(p.eph.secret, hs.pub, isInitiator(this.o.identity.signPublic, c.signPub)); } catch { return; }
      p.eph.secret.fill(0); // the ephemeral secret key is no longer needed
      this.maybeOpen(c, p);
    });
  }

  private maybeOpen(c: Contact, p: Peer) {
    if (p.state === 'open' || !p.sess || !p.sentEph) return;
    p.state = 'open'; clearTimeout(p.timer);
    this.o.onLink(c.id, 'open');
  }

  private async onRtc(c: Contact, p: Peer, m: { k: 'offer' | 'answer'; sdp: string }) {
    const pc = p.pc;
    if (m.k === 'offer') {
      const collision = p.making || pc.signalingState !== 'stable';
      if (collision && !p.polite) return; // den artiga parten vinner
      if (collision) await pc.setLocalDescription({ type: 'rollback' }).catch(() => {});
      await pc.setRemoteDescription(new this.o.rtc.RTCSessionDescription({ type: 'offer', sdp: m.sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.sendRaw(c.id, { t: 'rtc', k: 'answer', sdp: answer.sdp });
    } else if (pc.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription(new this.o.rtc.RTCSessionDescription({ type: 'answer', sdp: m.sdp }));
    }
  }

  private async startOffer(c: Contact) {
    const p = this.makePeer(c);
    this.attach(c, p, p.pc.createDataChannel('direct'));
    const offer = await p.pc.createOffer();
    await p.pc.setLocalDescription(offer);
    this.sendSignal(c, { k: 'offer', sdp: offer.sdp });
  }

  private async onOffer(c: Contact, sdp: string) {
    const p = this.makePeer(c);
    await p.pc.setRemoteDescription(new this.o.rtc.RTCSessionDescription({ type: 'offer', sdp }));
    p.remoteSet = true;
    await this.flushIce(p);
    const answer = await p.pc.createAnswer();
    await p.pc.setLocalDescription(answer);
    this.sendSignal(c, { k: 'answer', sdp: answer.sdp });
  }

  private async flushIce(p: Peer) {
    const q = p.ice.splice(0);
    for (const c of q) await p.pc.addIceCandidate(new this.o.rtc.RTCIceCandidate(c)).catch(() => {});
  }

  private drop(id: string, to: LinkState, silent = false) {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    clearTimeout(p.timer);
    const wasOpen = p.state === 'open';
    p.state = 'closed';
    p.sess?.close(); p.eph.secret.fill(0);
    try { p.dc?.close(); } catch {}
    try { p.pc.close(); } catch {}
    if (!silent || wasOpen) this.o.onLink(id, to);
  }
}
