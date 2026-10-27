import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp, Attach } from '../store';
import { Contact } from '../core/crypto';
import { FileKind, newId, Plain } from '../core/protocol';
import { Receiver, sendFile } from '../core/transfer';
import { fileSource, makeSink } from '../files';
import { IceServer, LinkState, PeerManager, SignalState } from './peers';
import { CallController, CallView } from './calls';
import { mediaDevices, rtc } from './rtc';

const idleCall: CallView = { status: 'idle', cid: '', video: false, peers: {}, muted: false, camOff: false, local: null };
export type SendFileArgs = { uri: string; name: string; mime: string; kind: FileKind; dur?: number };

type NetCtx = {
  available: boolean; signal: SignalState; link: Record<string, LinkState>;
  progress: Record<string, number>;
  call: CallView; remote: Record<string, any>; calls: CallController | null;
  sendText: (c: Contact, text: string) => void; connect: (c: Contact) => void;
  sendFile: (c: Contact, a: SendFileArgs) => void;
  manualOffer: (c: Contact) => Promise<string>; manualAnswer: (c: Contact, code: string) => Promise<string>; manualFinish: (c: Contact, code: string) => Promise<void>;
};
const none = async () => { throw new Error('no rtc'); };
const N = createContext<NetCtx>({ available: false, signal: 'offline', link: {}, progress: {}, call: idleCall, remote: {}, calls: null, sendText: () => {}, connect: () => {}, sendFile: () => {}, manualOffer: none, manualAnswer: none, manualFinish: none });
export const useNet = () => useContext(N);

export function NetProvider({ children }: { children: React.ReactNode }) {
  const app = useApp();
  const appRef = useRef(app); appRef.current = app;
  const mgr = useRef<PeerManager | null>(null);
  const receivers = useRef(new Map<string, Receiver>());
  const sending = useRef(new Set<string>());
  const [signal, setSignal] = useState<SignalState>('offline');
  const [link, setLink] = useState<Record<string, LinkState>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [call, setCall] = useState<CallView>(idleCall);
  const [remote, setRemote] = useState<Record<string, any>>({});
  const [calls, setCalls] = useState<CallController | null>(null);

  const { identity, signalUrl, turnUrl, turnUser, turnCred, hideIp } = app;

  const pushFile = useCallback(async (c: Contact, msgId: string) => {
    const a = appRef.current, m = mgr.current;
    const msg = a.messages[c.id]?.find(x => x.id === msgId);
    if (!m || !msg?.file || sending.current.has(msgId) || !m.isOpen(c.id)) return;
    sending.current.add(msgId);
    let h: ReturnType<typeof fileSource> | null = null;
    try {
      h = fileSource(msg.file.uri);
      const f = msg.file;
      const ok = await sendFile({ id: msgId, name: f.name, mime: f.mime, size: f.size, kind: f.kind, at: msg.at, dur: f.dur }, h.src, {
        send: p => m.send(c, p), buffered: () => m.bufferedAmount(c.id), isOpen: () => m.isOpen(c.id),
        onProgress: (d, t) => setProgress(o => ({ ...o, [msgId]: d / t })),
      });
      if (ok) appRef.current.setStatus(c.id, msgId, 'sent');
    } catch {} finally {
      h?.close(); sending.current.delete(msgId);
      setProgress(o => { const n = { ...o }; delete n[msgId]; return n; });
    }
  }, []);

  // Skicka allt som inte är levererat till en kontakt när kanalen är öppen.
  const flush = useCallback((cid: string) => {
    const a = appRef.current, m = mgr.current, c = a.contacts[cid];
    if (!m || !c) return;
    for (const msg of a.messages[cid] ?? []) {
      if (!msg.mine || msg.status === 'delivered') continue;
      if (msg.file) { pushFile(c, msg.id); continue; }
      if (m.send(c, { t: 'msg', id: msg.id, text: msg.text, at: msg.at })) a.setStatus(cid, msg.id, 'sent');
    }
  }, [pushFile]);

  useEffect(() => {
    if (!rtc || !identity) return;
    const ice: IceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
    if (turnUrl) ice.push({ urls: turnUrl, username: turnUser || undefined, credential: turnCred || undefined });
    const byId = (id: string) => appRef.current.contacts[id];
    const receiverFor = (c: Contact) => {
      let r = receivers.current.get(c.id);
      if (!r) {
        r = new Receiver({
          makeSink: makeSink(c.id),
          onDone: (meta, uri) => {
            const file: Attach = { name: meta.name, mime: meta.mime, size: meta.size, kind: meta.kind, uri, dur: meta.dur };
            appRef.current.addMessage(c.id, { id: meta.id, mine: false, text: meta.name, at: meta.at, file });
            mgr.current?.send(c, { t: 'ack', id: meta.id });
          },
          onFail: id => { mgr.current?.send(c, { t: 'abort', id }); },
        });
        receivers.current.set(c.id, r);
      }
      return r;
    };
    const cc = new CallController({
      mySign: identity.signPublic,
      contactBySign: s => Object.values(appRef.current.contacts).find(c => c.signPub === s && !appRef.current.blocked[c.id]),
      contactById: id => byId(id),
      send: (id, p) => (byId(id) ? mgr.current?.send(byId(id), p) ?? false : false),
      connect: id => { if (byId(id)) mgr.current?.connect(byId(id)); },
      isOpen: id => mgr.current?.isOpen(id) ?? false,
      getMedia: v => mediaDevices!.getUserMedia({ audio: true, video: v ? { width: 640, height: 480, frameRate: 24, facingMode: 'user' } : false }),
      stopMedia: s => { try { s.getTracks().forEach((t: any) => t.stop()); } catch {} },
      setLocal: (id, s) => mgr.current?.setLocalStream(id, s),
      onChange: v => { setCall(v); if (v.status === 'idle') setRemote({}); },
      newId,
    });
    setCalls(cc);

    const m = new PeerManager({
      identity, signalUrl, iceServers: hideIp && turnUrl ? ice.slice(1) : ice, relayOnly: hideIp && !!turnUrl, rtc,
      getContactBySign: s => Object.values(appRef.current.contacts).find(c => c.signPub === s && !appRef.current.blocked[c.id]),
      onPlain: (c, p: Plain) => {
        if (p.t === 'msg') {
          appRef.current.addMessage(c.id, { id: p.id, mine: false, text: p.text, at: p.at });
          m.send(c, { t: 'ack', id: p.id }); // kvittera även dubbletter
        } else if (p.t === 'ack') appRef.current.setStatus(c.id, p.id, 'delivered');
        else if (p.t === 'file' || p.t === 'chunk' || p.t === 'abort') {
          if (p.t === 'file' && appRef.current.messages[c.id]?.some(x => x.id === p.id)) { m.send(c, { t: 'ack', id: p.id }); return; } // redan mottagen
          receiverFor(c).handle(p).catch(() => {});
        } else if (p.t === 'call') cc.handle(c.id, p);
      },
      onLink: (id, st) => {
        setLink(o => ({ ...o, [id]: st }));
        if (st === 'open') flush(id); else receivers.current.get(id)?.dropAll();
        cc.onLink(id, st);
      },
      onSignal: st => {
        setSignal(st);
        if (st === 'online') Object.values(appRef.current.contacts).forEach(c => !appRef.current.blocked[c.id] && m.connect(c));
      },
      onTrack: (c, stream) => { if (stream) setRemote(o => ({ ...o, [c.id]: stream })); },
    });
    mgr.current = m; m.start();
    // Försök igen för kontakter med meddelanden som väntar.
    const iv = setInterval(() => {
      const a = appRef.current;
      Object.values(a.contacts).forEach(c => {
        const waiting = (a.messages[c.id] ?? []).some(x => x.mine && x.status !== 'delivered');
        if (waiting && !a.blocked[c.id] && m.isSignalOnline() && !m.isOpen(c.id)) m.connect(c);
      });
    }, 10000);
    return () => { clearInterval(iv); cc.end(); m.stop(); mgr.current = null; setCalls(null); receivers.current.clear(); setLink({}); setSignal('offline'); };
  }, [identity, signalUrl, turnUrl, turnUser, turnCred, hideIp, flush]);

  const connect = useCallback((c: Contact) => { mgr.current?.connect(c); }, []);
  const sendText = useCallback((c: Contact, text: string) => {
    const msg = { id: newId(), mine: true, text, at: Date.now() };
    appRef.current.addMessage(c.id, { ...msg, status: 'queued' });
    const m = mgr.current;
    if (m?.send(c, { t: 'msg', id: msg.id, text, at: msg.at })) appRef.current.setStatus(c.id, msg.id, 'sent');
    else m?.connect(c);
  }, []);
  const sendFileMsg = useCallback((c: Contact, a: SendFileArgs) => {
    let size = 0;
    try { const h = fileSource(a.uri); size = h.src.size; h.close(); } catch { return; }
    const id = newId();
    appRef.current.addMessage(c.id, { id, mine: true, text: a.name, at: Date.now(), status: 'queued', file: { name: a.name, mime: a.mime, size, kind: a.kind, uri: a.uri, dur: a.dur } });
    if (mgr.current?.isOpen(c.id)) setTimeout(() => pushFile(c, id), 0); else mgr.current?.connect(c);
  }, [pushFile]);

  const value = useMemo<NetCtx>(() => ({
    available: !!rtc, signal, link, progress, call, remote, calls,
    sendText, connect, sendFile: sendFileMsg,
    manualOffer: c => mgr.current ? mgr.current.manualOffer(c) : none(),
    manualAnswer: (c, code) => mgr.current ? mgr.current.manualAnswer(c, code) : none(),
    manualFinish: (c, code) => mgr.current ? mgr.current.manualFinish(c, code) : none(),
  }), [signal, link, progress, call, remote, calls, sendText, connect, sendFileMsg]);
  return <N.Provider value={value}>{children}</N.Provider>;
}
