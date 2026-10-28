import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getLocales } from 'expo-localization';
import { Theme, ThemeName, themes } from './theme';
import { migrateSaved } from './core/migrate';
import { dict, Lang, LangChoice, Strings } from './i18n';
import { Contact, Identity, newIdentity } from './core/crypto';
import { FileKind, MsgStatus } from './core/protocol';
import { DEFAULT_RETENTION, cutoffFor, pruneMessages } from './core/retention';
import { deleteStored, probePublic, sweepOldFiles, wipeAllFiles } from './files';

export type Attach = { name: string; mime: string; size: number; kind: FileKind; uri: string; dur?: number };
export type Msg = { id: string; mine: boolean; text: string; at: number; status?: MsgStatus; file?: Attach };
// Contact from the phone book (for SMS invites). Has no keys.
export type Person = { id: string; name: string; phone?: string };

type Saved = {
  themeName: ThemeName; langChoice: LangChoice; name: string;
  contacts: Record<string, Contact>; blocked: Record<string, string>; messages: Record<string, Msg[]>;
  signalUrl: string; stunList: string; turnList: string; hideIp: boolean; tcpOnly: boolean;
  introSeen: boolean; // the getting-started guide has been shown after install
  retentionDays: number; // how long conversations and files are kept on this phone
  storagePrompted: boolean; // the question about the Download/Direct folder has been asked
  orphanAsked: boolean; // the question about files left by an earlier install has been asked
};
const KEY = 'direct.state.v2';
const ID_KEY = 'direct.identity.v1';
const empty: Saved = {
  themeName: 'dark', langChoice: 'en', name: '', contacts: {}, blocked: {}, messages: {},
  signalUrl: '', stunList: '', turnList: '', hideIp: false, tcpOnly: false, introSeen: false,
  retentionDays: DEFAULT_RETENTION, storagePrompted: false, orphanAsked: false,
};

type Ctx = Saved & {
  ready: boolean; identity: Identity | null; theme: Theme; t: Strings; lang: Lang;
  publicStorage: boolean; refreshStorage: () => void; wipeAll: () => Promise<void>;
  setTheme: (n: ThemeName) => void; setLang: (l: LangChoice) => void;
  createIdentity: (name: string) => Promise<void>;
  addContact: (c: Contact) => void; removeContact: (id: string) => void; setVerified: (id: string, v: boolean) => void;
  addMessage: (cid: string, m: Msg) => boolean;
  setStatus: (cid: string, msgId: string, st: MsgStatus) => void;
  setSettings: (p: Partial<Pick<Saved, 'signalUrl' | 'stunList' | 'turnList' | 'hideIp' | 'tcpOnly' | 'introSeen' | 'retentionDays' | 'storagePrompted' | 'orphanAsked'>>) => void;
  clearChat: (id: string) => void; block: (id: string, name: string) => void; unblock: (id: string) => void; clearChats: () => void;
};
const C = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(C);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<Saved>(empty);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);
  const [publicStorage, setPublicStorage] = useState(false);
  const sRef = useRef(s); sRef.current = s;

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(KEY);
        if (v) {
          const saved = migrateSaved(JSON.parse(v)); // settings from older versions (theme name, single TURN server)
          if (!themes[saved.themeName as ThemeName]) saved.themeName = empty.themeName;
          setS({ ...empty, ...saved });
        }
      } catch {}
      try { const v = await SecureStore.getItemAsync(ID_KEY); if (v) setIdentity(JSON.parse(v)); } catch {}
      setReady(true);
    })();
  }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {}); }, [s, ready]);

  // Is Download/Direct usable? Checked at start and every time the app comes back (for example from the Android setting).
  const refreshStorage = useCallback(() => setPublicStorage(probePublic()), []);
  useEffect(() => {
    if (!ready) return;
    refreshStorage();
    const sub = AppState.addEventListener('change', st => { if (st === 'active') refreshStorage(); });
    return () => sub.remove();
  }, [ready, refreshStorage]);

  // Retention: messages and files older than the chosen time are removed from this phone. Runs at start, when the
  // app comes back, once an hour while it is open, and straight away when the setting changes.
  useEffect(() => {
    if (!ready) return;
    const sweep = () => {
      const o = sRef.current, now = Date.now();
      const r = pruneMessages(o.messages, o.retentionDays, now);
      if (r.changed) setS(x => ({ ...x, messages: pruneMessages(x.messages, x.retentionDays, now).messages }));
      deleteStored(r.removedUris);
      const keep = Object.values(r.messages).flat().flatMap(m => (m.file ? [m.file.uri] : []));
      sweepOldFiles(cutoffFor(o.retentionDays, now), keep);
    };
    sweep();
    const iv = setInterval(sweep, 3_600_000);
    const sub = AppState.addEventListener('change', st => { if (st === 'active') sweep(); });
    return () => { clearInterval(iv); sub.remove(); };
  }, [ready, s.retentionDays]);

  const sys: Lang = getLocales()[0]?.languageCode === 'sv' ? 'sv' : 'en';
  const lang: Lang = s.langChoice === 'system' ? sys : s.langChoice;

  const addMessage = useCallback((cid: string, m: Msg) => {
    let added = true;
    setS(o => {
      const list = o.messages[cid] ?? [];
      if (list.some(x => x.id === m.id)) { added = false; return o; }
      return { ...o, messages: { ...o.messages, [cid]: [...list, m] } };
    });
    return added;
  }, []);

  const value = useMemo<Ctx>(() => ({
    ...s, ready, identity, lang, theme: themes[s.themeName], t: dict[lang], publicStorage, refreshStorage,
    // Everything this app has stored: files (also Download/Direct), messages, contacts and the key.
    wipeAll: async () => {
      wipeAllFiles();
      try { await SecureStore.deleteItemAsync(ID_KEY); } catch {}
      try { await AsyncStorage.removeItem(KEY); } catch {}
      setIdentity(null); setPublicStorage(false); setS({ ...empty });
    },
    setTheme: themeName => setS(o => ({ ...o, themeName })),
    setLang: langChoice => setS(o => ({ ...o, langChoice })),
    createIdentity: async name => {
      const id = newIdentity();
      await SecureStore.setItemAsync(ID_KEY, JSON.stringify(id));
      setIdentity(id); setS(o => ({ ...o, name: name.trim() }));
    },
    addContact: c => setS(o => ({ ...o, contacts: { ...o.contacts, [c.id]: o.contacts[c.id] ?? c } })),
    removeContact: id => setS(o => { const c = { ...o.contacts }; delete c[id]; const m = { ...o.messages }; delete m[id]; return { ...o, contacts: c, messages: m }; }),
    setVerified: (id, v) => setS(o => (o.contacts[id] ? { ...o, contacts: { ...o.contacts, [id]: { ...o.contacts[id], verified: v } } } : o)),
    addMessage,
    setStatus: (cid, msgId, st) => setS(o => {
      const list = o.messages[cid]; if (!list) return o;
      return { ...o, messages: { ...o.messages, [cid]: list.map(m => (m.id === msgId && m.status !== 'delivered' ? { ...m, status: st } : m)) } };
    }),
    setSettings: p => setS(o => ({ ...o, ...p })),
    block: (id, name) => setS(o => ({ ...o, blocked: { ...o.blocked, [id]: name } })),
    unblock: id => setS(o => { const b = { ...o.blocked }; delete b[id]; return { ...o, blocked: b }; }),
    clearChat: id => setS(o => { const m = { ...o.messages }; delete m[id]; return { ...o, messages: m }; }),
    clearChats: () => setS(o => ({ ...o, messages: {} })),
  }), [s, ready, identity, lang, addMessage, publicStorage, refreshStorage]);

  return <C.Provider value={value}>{children}</C.Provider>;
}
