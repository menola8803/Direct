// Plattformsoberoende anslutningshanterare: signalering via WebSocket-relä, meddelanden via WebRTC data channel.
// WebRTC-implementationen injiceras (react-native-webrtc i appen, wrtc i testerna).
import { Contact, Identity, open, seal, signText } from '../core/crypto';
import { isInitiator, Plain, Signal } from '../core/protocol';

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
  connectTimeoutMs?: number;
};

type Peer = { pc: any; dc: any | null; remoteSet: boolean; ice: any[]; state: LinkState; timer?: any };

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

  // Försök koppla upp mot en kontakt (om inte redan igång).
  connect(c: Contact) {
    const p = this.peers.get(c.id);
    if (p && p.state !== 'closed') return;
    if (isInitiator(this.o.identity.signPublic, c.signPub)) this.startOffer(c);
    else this.sendSignal(c, { k: 'hello' });
  }

  send(c: Contact, plain: Plain): boolean {
    const p = this.peers.get(c.id);
    if (!p?.dc || p.dc.readyState !== 'open') return false;
    try { p.dc.send(JSON.stringify(seal(plain, this.o.identity.boxSecret, c.boxPub))); return true; } catch { return false; }
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
    if (!c) return; // okända avsändare ignoreras
    const s = open<Signal>(payload, c.boxPub, this.o.identity.boxSecret);
    if (!s || typeof s !== 'object') return;
    if (s.k === 'hello') {
      const ex = this.peers.get(c.id);
      if (ex && ex.state !== 'closed') return; // pågående försök, starta inte ett till
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
  private makePeer(c: Contact): Peer {
    this.drop(c.id, 'closed', true);
    const pc = new this.o.rtc.RTCPeerConnection({ iceServers: this.o.iceServers, iceTransportPolicy: this.o.relayOnly ? 'relay' : 'all' });
    const p: Peer = { pc, dc: null, remoteSet: false, ice: [], state: 'connecting' };
    this.peers.set(c.id, p);
    this.o.onLink(c.id, 'connecting');
    pc.addEventListener('icecandidate', (e: any) => {
      if (e.candidate) this.sendSignal(c, { k: 'ice', c: { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex } });
    });
    pc.addEventListener('connectionstatechange', () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) this.drop(c.id, 'closed');
    });
    pc.addEventListener('datachannel', (e: any) => this.attach(c, p, e.channel));
    p.timer = setTimeout(() => { if (p.state !== 'open') this.drop(c.id, 'closed'); }, this.o.connectTimeoutMs ?? 20000);
    return p;
  }

  private attach(c: Contact, p: Peer, dc: any) {
    p.dc = dc;
    const opened = () => { p.state = 'open'; clearTimeout(p.timer); this.o.onLink(c.id, 'open'); };
    dc.addEventListener('open', opened);
    if (dc.readyState === 'open') opened();
    dc.addEventListener('close', () => this.drop(c.id, 'closed'));
    dc.addEventListener('message', (e: any) => {
      let env: any; try { env = JSON.parse(String(e.data)); } catch { return; }
      const plain = open<Plain>(env, c.boxPub, this.o.identity.boxSecret);
      if (plain) this.o.onPlain(c, plain);
    });
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
    try { p.dc?.close(); } catch {}
    try { p.pc.close(); } catch {}
    if (!silent || wasOpen) this.o.onLink(id, to);
  }
}
