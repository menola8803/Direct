import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getLocales } from 'expo-localization';
import { Theme, ThemeName, themes } from './theme';
import { dict, Lang, LangChoice, Strings } from './i18n';
import { Contact, Identity, newIdentity } from './core/crypto';
import { FileKind, MsgStatus } from './core/protocol';

export type Attach = { name: string; mime: string; size: number; kind: FileKind; uri: string; dur?: number };
export type Msg = { id: string; mine: boolean; text: string; at: number; status?: MsgStatus; file?: Attach };
// Contact from the phone book (for SMS invites). Has no keys.
export type Person = { id: string; name: string; phone?: string };

type Saved = {
  themeName: ThemeName; langChoice: LangChoice; name: string;
  contacts: Record<string, Contact>; blocked: Record<string, string>; messages: Record<string, Msg[]>;
  signalUrl: string; stunList: string; turnUrl: string; turnUser: string; turnCred: string; hideIp: boolean;
};
const KEY = 'direct.state.v2';
const ID_KEY = 'direct.identity.v1';
const empty: Saved = {
  themeName: 'usb', langChoice: 'en', name: '', contacts: {}, blocked: {}, messages: {},
  signalUrl: '', stunList: '', turnUrl: '', turnUser: '', turnCred: '', hideIp: false,
};

type Ctx = Saved & {
  ready: boolean; identity: Identity | null; theme: Theme; t: Strings; lang: Lang;
  setTheme: (n: ThemeName) => void; setLang: (l: LangChoice) => void;
  createIdentity: (name: string) => Promise<void>;
  addContact: (c: Contact) => void; removeContact: (id: string) => void; setVerified: (id: string, v: boolean) => void;
  addMessage: (cid: string, m: Msg) => boolean;
  setStatus: (cid: string, msgId: string, st: MsgStatus) => void;
  setSettings: (p: Partial<Pick<Saved, 'signalUrl' | 'stunList' | 'turnUrl' | 'turnUser' | 'turnCred' | 'hideIp'>>) => void;
  clearChat: (id: string) => void; block: (id: string, name: string) => void; unblock: (id: string) => void; clearChats: () => void;
};
const C = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(C);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<Saved>(empty);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try { const v = await AsyncStorage.getItem(KEY); if (v) setS({ ...empty, ...JSON.parse(v) }); } catch {}
      try { const v = await SecureStore.getItemAsync(ID_KEY); if (v) setIdentity(JSON.parse(v)); } catch {}
      setReady(true);
    })();
  }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {}); }, [s, ready]);

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
    ...s, ready, identity, lang, theme: themes[s.themeName], t: dict[lang],
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
  }), [s, ready, identity, lang, addMessage]);

  return <C.Provider value={value}>{children}</C.Provider>;
}
