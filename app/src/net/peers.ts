// Platform-independent connection manager: signaling via WebSocket relay, messages via WebRTC data channel.
// WebRTC-implementationen injiceras (react-native-webrtc i appen, wrtc i testerna).
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { decodeBase64, encodeBase64, decodeUTF8, encodeUTF8 } from 'tweetnacl-util';
import { Contact, Identity, open, seal, signText } from '../core/crypto';
import { Frame, Session } from '../core/session';
import { Inner, isInitiator, Plain, Signal } from '../core/protocol';
import type { Diag, SignalInfo } from '../core/diagnose';

export type RtcApi = { RTCPeerConnection: any; RTCIceCandidate: any; RTCSessionDescription: any };
export type IceServer = { urls: string | string[]; username?: string; credential?: string };
export type LinkState = 'connecting' | 'open' | 'closed';
export type SignalState = 'connecting' | 'online' | 'offline';

export type { Diag, SignalInfo };

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
  resendAfterMs?: number; // an unanswered offer is made again after this long when the other phone asks for a connection (default 3000)
  heartbeatMs?: number;        // how often the signal connection is tested (default 20000)
  heartbeatTimeoutMs?: number; // how long to wait for the reply before the connection counts as dead (default 8000)
  wakeCheckMs?: number;        // the same wait when the app has just come back to the front (default 5000)
  connectMs?: number;          // a signal connection that has not got going after this long is given up (default 15000)
  reconnectMs?: number;        // an open link that dies is tried once more after this long (default 1500)
};

type Peer = {
  contact: Contact; pc: any; dc: any | null; remoteSet: boolean; ice: any[]; state: LinkState; timer?: any;
  manual: boolean; eph: { pub: string; secret: Uint8Array }; sess: Session | null; sentEph: boolean;
  making: boolean; polite: boolean; senders: any[];
  since: number; reoffer?: any; // when the attempt started, and the timer that offers again if no answer has come
  diag: Diag;
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
  private lastDiag = new Map<string, Diag>(); // the latest attempt per contact, kept after it has ended
  private sigErr = ''; private sigSince = 0; private sigTries = 0;
  private beat: any; private pongTimer: any; private connTimer: any; // heartbeat, its reply deadline, and the deadline for getting started
  private lastRx = 0; // when the signal connection last delivered anything
  private pend = 0; private due = 0; // when the oldest unanswered check was sent (0: none), and when its answer is due

  constructor(private o: PeerOpts) {}

  // ---- for the report
  signalInfo(): SignalInfo { return { url: this.o.signalUrl, state: this.signal, err: this.sigErr, since: this.sigSince, tries: this.sigTries }; }
  getDiag(id: string): Diag | undefined {
    const p = this.peers.get(id);
    if (p) { // refresh from the live connection
      try { p.diag.gather = String(p.pc.iceGatheringState ?? p.diag.gather); p.diag.ice = String(p.pc.iceConnectionState ?? p.diag.ice); p.diag.conn = String(p.pc.connectionState ?? p.diag.conn); p.diag.dc = String(p.dc?.readyState ?? p.diag.dc); } catch {}
    }
    const d = p?.diag ?? this.lastDiag.get(id);
    return d ? JSON.parse(JSON.stringify(d)) : undefined;
  }
  private note(id: string, e: unknown) {
    const d = this.peers.get(id)?.diag ?? this.lastDiag.get(id);
    if (d && d.errors.length < 5) d.errors.push(String((e as any)?.message ?? e).slice(0, 140));
  }


  start() {
    this.stopped = false;
    this.openWs();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    this.stopBeat();
    this.ws?.close();
    this.ws = null;
    for (const id of [...this.peers.keys()]) this.drop(id, 'closed', false, 'stopped');
    this.setSignal('offline');
  }

  isOpen(contactId: string) { return this.peers.get(contactId)?.state === 'open'; }
  isSignalOnline() { return this.signal === 'online'; }

  // Try to connect to a contact (unless already in progress).
  connect(c: Contact) {
    const p = this.peers.get(c.id);
    if (p && p.state !== 'closed') return;
    if (!this.isSignalOnline()) return; // utan server: koppla med manuell kod
    if (isInitiator(this.o.identity.signPublic, c.signPub)) this.startOffer(c).catch(e => this.note(c.id, e));
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
    const p = this.makePeer(c, 'manual');
    this.attach(c, p, p.pc.createDataChannel('direct'));
    const offer = await p.pc.createOffer();
    await p.pc.setLocalDescription(offer);
    await this.gathered(p.pc);
    return this.encodeManual({ k: 'offer', sdp: p.pc.localDescription.sdp }, c);
  }

  async manualAnswer(c: Contact, code: string): Promise<string> {
    const s = this.decodeManual(code, c);
    if (s?.k !== 'offer') throw new Error('bad code');
    const p = this.makePeer(c, 'manual'); p.diag.heard = true;
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
    p.remoteSet = true; p.diag.heard = true;
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
    clearTimeout(this.retryTimer);
    this.setSignal('connecting'); this.sigSince = Date.now(); this.sigTries++;
    let ws: WebSocket;
    try { ws = new WebSocket(this.o.signalUrl); } catch (e) { this.sigErr = 'bad address: ' + String((e as any)?.message ?? e).slice(0, 80); return this.scheduleRetry(); }
    this.ws = ws;
    // A path that swallows packets leaves the connection half made for ever: no error, no answer. Give up and try again.
    clearTimeout(this.connTimer);
    this.connTimer = setTimeout(() => this.dead(ws, 'no answer from the server'), this.o.connectMs ?? 15000);
    ws.onmessage = ev => {
      if (this.ws !== ws) return;
      this.lastRx = Date.now();
      let m: any; try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m.type === 'challenge') {
        ws.send(JSON.stringify({ type: 'hello', sign: this.o.identity.signPublic, sig: signText(m.nonce, this.o.identity.signSecret) }));
      } else if (m.type === 'ready') {
        clearTimeout(this.connTimer);
        this.retry = 0; this.sigErr = ''; this.sigTries = 0;
        // An attempt that began before this connection was made may have sent its offer into the void: start those again.
        for (const [id, p] of [...this.peers]) if (p.state === 'connecting' && !p.manual && !p.diag.heard) this.drop(id, 'closed', false, 'signal server reconnected');
        this.setSignal('online');
        this.startBeat(ws);
      } else if (m.type === 'relay') {
        if (m.from === this.o.identity.signPublic) return; // our own heartbeat coming back
        this.onRelay(m.from, m.payload).catch(e => { const c = this.o.getContactBySign(m.from); if (c) this.note(c.id, e); });
      } else if (m.type === 'offline') { // the server has no connection from the phone we wrote to
        const c = typeof m.to === 'string' ? this.o.getContactBySign(m.to) : undefined;
        const p = c && this.peers.get(c.id);
        if (p && !p.manual) p.diag.offline = true;
      }
    };
    ws.onclose = (ev: any) => {
      if (this.ws !== ws) return;
      this.stopBeat(); this.ws = null;
      this.sigErr = `closed (${ev?.code ?? '?'}${ev?.reason ? ' ' + String(ev.reason).slice(0, 60) : ''})`;
      this.setSignal('offline'); this.scheduleRetry();
    };
    ws.onerror = (ev: any) => { this.sigErr = 'error: ' + String(ev?.message ?? 'could not connect').slice(0, 80); };
  }

  private scheduleRetry() {
    if (this.stopped) return;
    const delay = Math.min(30000, 1000 * 2 ** this.retry++);
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.openWs(), delay);
  }

  // ---- keeping the signal connection honest
  // A phone that changes network or wakes from sleep can be left with a connection that looks open but carries nothing.
  // Every so often we send a packet to ourselves through the server; if it does not come back the connection is dead.
  // (Works with every version of the server: it hands a packet addressed to your own key straight back.)
  private startBeat(ws: WebSocket) {
    clearInterval(this.beat);
    this.beat = setInterval(() => this.ping(ws, this.o.heartbeatTimeoutMs ?? 8000), this.o.heartbeatMs ?? 20000);
  }
  private stopBeat() { clearInterval(this.beat); clearTimeout(this.pongTimer); clearTimeout(this.connTimer); this.pend = 0; }

  private ping(ws: WebSocket, wait: number) {
    if (this.ws !== ws || ws.readyState !== 1 || this.signal !== 'online') return;
    const now = Date.now();
    if (!this.pend || this.lastRx >= this.pend) { // nothing is waiting for an answer: send a new check
      this.pend = now;
      try { ws.send(JSON.stringify({ type: 'relay', to: this.o.identity.signPublic, payload: { hb: now } })); } catch { return this.dead(ws, 'could not send'); }
      this.due = now + wait;
    } else this.due = Math.min(this.due, this.pend + wait); // one is already out: keep its clock, only tighten the deadline
    clearTimeout(this.pongTimer);
    this.pongTimer = setTimeout(() => this.checkPong(ws, wait), Math.max(0, this.due - now));
  }
  private checkPong(ws: WebSocket, wait: number) {
    if (this.ws !== ws || this.lastRx >= this.pend) return;
    // A timer that fires long after it was due means the phone was asleep, and the reply may be waiting in the queue: ask again.
    if (Date.now() - this.due > wait) { this.pend = 0; return this.ping(ws, wait); }
    this.dead(ws, 'no reply from the server');
  }

  // Give up on a signal connection (it is not going to work) and make a new one soon. Its own close event may never come.
  private dead(ws: WebSocket, why: string) {
    if (this.ws !== ws) return;
    const wasOnline = this.signal === 'online';
    this.stopBeat();
    ws.onmessage = ws.onclose = ws.onerror = null;
    try { ws.close(); } catch {}
    this.ws = null; this.sigErr = why;
    this.setSignal('offline');
    if (wasOnline) this.retry = 0; // it worked a moment ago: try again at once rather than after a long pause
    this.scheduleRetry();
  }

  // The app is in front again (or the network has changed): check the connection now instead of waiting for a timer.
  wake() {
    if (this.stopped || !this.o.signalUrl) return;
    const ws = this.ws;
    if (!ws) { this.retry = 0; this.openWs(); return; } // waiting for a retry timer, possibly a long one
    if (this.signal === 'online') this.ping(ws, this.o.wakeCheckMs ?? 5000);
    else if (Date.now() - this.sigSince > 4000) { this.retry = 0; this.dead(ws, 'gave up on a stale attempt'); } // still "connecting" after a network change: start over
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
      if (ex && ex.state !== 'closed') { this.reofferIfUnanswered(c, ex); return; } // attempt in progress, do not start another
      if (isInitiator(this.o.identity.signPublic, c.signPub)) await this.startOffer(c);
      return;
    }
    if (s.k === 'offer') return this.onOffer(c, s.sdp);
    const p = this.peers.get(c.id);
    if (!p) return;
    if (s.k === 'answer') { if (p.pc.signalingState !== 'have-local-offer') return; p.diag.heard = true; await p.pc.setRemoteDescription(new this.o.rtc.RTCSessionDescription({ type: 'answer', sdp: s.sdp })); p.remoteSet = true; await this.flushIce(p); }
    if (s.k === 'ice') { p.diag.remote++; if (p.remoteSet) await p.pc.addIceCandidate(new this.o.rtc.RTCIceCandidate(s.c)).catch(() => {}); else p.ice.push(s.c); }
  }

  // ---- WebRTC ----
  private makePeer(c: Contact, how: Diag['how'] = 'offer'): Peer {
    const manual = how === 'manual';
    this.drop(c.id, 'closed', true, 'replaced');
    const pc = new this.o.rtc.RTCPeerConnection({ iceServers: this.o.iceServers, iceTransportPolicy: this.o.relayOnly ? 'relay' : 'all' });
    const p: Peer = { contact: c, pc, dc: null, remoteSet: false, ice: [], state: 'connecting', manual, eph: Session.newEphemeral(), sess: null, sentEph: false, making: false, polite: !isInitiator(this.o.identity.signPublic, c.signPub), senders: [], since: Date.now(),
      diag: { at: Date.now(), how, heard: false, gather: 'new', ice: 'new', conn: 'new', dc: 'none', cand: { host: 0, srflx: 0, relay: 0, other: 0 }, remote: 0, errors: [] } };
    this.peers.set(c.id, p);
    this.o.onLink(c.id, 'connecting');
    pc.addEventListener('icecandidate', (e: any) => {
      if (e.candidate && e.candidate.candidate) { const k = / typ (\w+)/.exec(String(e.candidate.candidate))?.[1] ?? ''; p.diag.cand[k === 'host' || k === 'srflx' || k === 'relay' ? k : 'other']++; }
      if (e.candidate && !p.manual) this.sendSignal(c, { k: 'ice', c: { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex } });
    });
    pc.addEventListener('icegatheringstatechange', () => { p.diag.gather = String(pc.iceGatheringState); });
    pc.addEventListener('iceconnectionstatechange', () => { p.diag.ice = String(pc.iceConnectionState); });
    pc.addEventListener('connectionstatechange', () => {
      p.diag.conn = String(pc.connectionState);
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState) && this.peers.get(c.id) === p) this.drop(c.id, 'closed', false, `connection ${pc.connectionState}`); // not a newer attempt
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
    p.timer = setTimeout(() => { if (p.state !== 'open') this.drop(c.id, 'closed', false, `timeout after ${Math.round(tmo / 1000)} s`); }, tmo);
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
    dc.addEventListener('close', () => { if (this.peers.get(c.id) === p) this.drop(c.id, 'closed', false, 'channel closed'); }); // not a newer attempt
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

  // Our offer can reach a phone that has not added us yet. It ignores the offer (unknown sender) and the attempt then hangs
  // until it times out. When that phone later adds us and asks for a connection (hello), offer again instead of making it
  // wait: but only if our offer is still unanswered after a few seconds (a normal answer takes well under a second, and
  // restarting in the middle of a handshake would break it), and never for a manual pairing.
  private reofferIfUnanswered(c: Contact, p: Peer) {
    if (!isInitiator(this.o.identity.signPublic, c.signPub) || p.manual || p.remoteSet || p.state !== 'connecting' || p.reoffer) return;
    const again = () => {
      p.reoffer = undefined;
      if (this.peers.get(c.id) !== p || p.state !== 'connecting' || p.remoteSet || !this.isSignalOnline()) return;
      this.startOffer(c).catch(e => this.note(c.id, e));
    };
    const wait = (this.o.resendAfterMs ?? 3000) - (Date.now() - p.since);
    if (wait <= 0) again(); else p.reoffer = setTimeout(again, wait + 50);
  }

  private async startOffer(c: Contact) {
    const p = this.makePeer(c, 'offer');
    this.attach(c, p, p.pc.createDataChannel('direct'));
    const offer = await p.pc.createOffer();
    await p.pc.setLocalDescription(offer);
    this.sendSignal(c, { k: 'offer', sdp: offer.sdp });
  }

  private async onOffer(c: Contact, sdp: string) {
    const p = this.makePeer(c, 'answer'); p.diag.heard = true;
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

  private drop(id: string, to: LinkState, silent = false, why = 'closed') {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    if (!p.diag.ended) p.diag.ended = { at: Date.now(), why };
    try { p.diag.dc = String(p.dc?.readyState ?? p.diag.dc); } catch {}
    this.lastDiag.set(id, p.diag);
    clearTimeout(p.timer); clearTimeout(p.reoffer);
    const wasOpen = p.state === 'open';
    p.state = 'closed';
    p.sess?.close(); p.eph.secret.fill(0);
    try { p.dc?.close(); } catch {}
    try { p.pc.close(); } catch {}
    if (!silent || wasOpen) this.o.onLink(id, to);
    if (wasOpen && !silent) this.reconnectSoon(p.contact);
  }

  // A link that was open and then died (the other phone went away for a moment, a network changed) is tried once more soon,
  // without waiting for someone to open the chat. Only once: an attempt that never got open is not repeated here.
  private reconnectSoon(c: Contact) {
    if (this.stopped) return;
    setTimeout(() => {
      if (this.stopped || this.peers.has(c.id) || !this.isSignalOnline()) return;
      const now = this.o.getContactBySign(c.signPub); // still a contact, and not blocked
      if (now) this.connect(now);
    }, this.o.reconnectMs ?? 1500);
  }
}
