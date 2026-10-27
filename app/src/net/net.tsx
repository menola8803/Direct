import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { Contact } from '../core/crypto';
import { newId, Plain } from '../core/protocol';
import { IceServer, LinkState, PeerManager, SignalState } from './peers';
import { rtc } from './rtc';

type NetCtx = {
  available: boolean; signal: SignalState; link: Record<string, LinkState>;
  sendText: (c: Contact, text: string) => void; connect: (c: Contact) => void;
};
const N = createContext<NetCtx>({ available: false, signal: 'offline', link: {}, sendText: () => {}, connect: () => {} });
export const useNet = () => useContext(N);

export function NetProvider({ children }: { children: React.ReactNode }) {
  const app = useApp();
  const appRef = useRef(app); appRef.current = app;
  const mgr = useRef<PeerManager | null>(null);
  const [signal, setSignal] = useState<SignalState>('offline');
  const [link, setLink] = useState<Record<string, LinkState>>({});

  // Skicka allt som inte är levererat till en kontakt när kanalen är öppen.
  const flush = useCallback((cid: string) => {
    const a = appRef.current, m = mgr.current, c = a.contacts[cid];
    if (!m || !c) return;
    for (const msg of a.messages[cid] ?? []) {
      if (msg.mine && msg.status !== 'delivered') {
        if (m.send(c, { t: 'msg', id: msg.id, text: msg.text, at: msg.at })) a.setStatus(cid, msg.id, 'sent');
      }
    }
  }, []);

  const { identity, signalUrl, turnUrl, turnUser, turnCred, hideIp } = app;
  useEffect(() => {
    if (!rtc || !identity || !signalUrl) return;
    const ice: IceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
    if (turnUrl) ice.push({ urls: turnUrl, username: turnUser || undefined, credential: turnCred || undefined });
    const m = new PeerManager({
      identity, signalUrl, iceServers: hideIp && turnUrl ? ice.slice(1) : ice, relayOnly: hideIp && !!turnUrl, rtc,
      getContactBySign: s => Object.values(appRef.current.contacts).find(c => c.signPub === s && !appRef.current.blocked[c.id]),
      onPlain: (c, p: Plain) => {
        if (p.t === 'msg') {
          appRef.current.addMessage(c.id, { id: p.id, mine: false, text: p.text, at: p.at });
          m.send(c, { t: 'ack', id: p.id }); // kvittera även dubbletter
        } else if (p.t === 'ack') appRef.current.setStatus(c.id, p.id, 'delivered');
      },
      onLink: (id, st) => { setLink(o => ({ ...o, [id]: st })); if (st === 'open') flush(id); },
      onSignal: st => {
        setSignal(st);
        if (st === 'online') Object.values(appRef.current.contacts).forEach(c => !appRef.current.blocked[c.id] && m.connect(c));
      },
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
    return () => { clearInterval(iv); m.stop(); mgr.current = null; setLink({}); setSignal('offline'); };
  }, [identity, signalUrl, turnUrl, turnUser, turnCred, hideIp, flush]);

  const connect = useCallback((c: Contact) => { mgr.current?.connect(c); }, []);
  const sendText = useCallback((c: Contact, text: string) => {
    const msg = { id: newId(), mine: true, text, at: Date.now() };
    appRef.current.addMessage(c.id, { ...msg, status: 'queued' });
    const m = mgr.current;
    if (m?.send(c, { t: 'msg', id: msg.id, text, at: msg.at })) appRef.current.setStatus(c.id, msg.id, 'sent');
    else m?.connect(c);
  }, []);

  const value = useMemo<NetCtx>(() => ({ available: !!rtc, signal, link, sendText, connect }), [signal, link, sendText, connect]);
  return <N.Provider value={value}>{children}</N.Provider>;
}
