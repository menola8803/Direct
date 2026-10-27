import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { Theme, ThemeName, themes } from './theme';
import { dict, Lang, LangChoice, Strings } from './i18n';

export type Msg = { id: string; mine: boolean; text: string; at: number };
export type Profile = { phone: string; createdAt: number };
export type Person = { id: string; name: string; phone?: string; demo?: boolean };

type Saved = {
  themeName: ThemeName; langChoice: LangChoice; profile: Profile | null;
  blocked: Record<string, string>; messages: Record<string, Msg[]>;
};
const KEY = 'direct.state.v1';
const empty: Saved = { themeName: 'beige', langChoice: 'system', profile: null, blocked: {}, messages: {} };

type Ctx = Saved & {
  ready: boolean; theme: Theme; t: Strings; lang: Lang;
  setTheme: (n: ThemeName) => void; setLang: (l: LangChoice) => void;
  createProfile: (phone: string) => void;
  send: (p: Person, text: string) => void;
  block: (p: Person) => void; unblock: (id: string) => void; clearChats: () => void;
};
const C = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(C);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<Saved>(empty);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(v => { if (v) setS({ ...empty, ...JSON.parse(v) }); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {}); }, [s, ready]);

  const sys: Lang = getLocales()[0]?.languageCode === 'sv' ? 'sv' : 'en';
  const lang: Lang = s.langChoice === 'system' ? sys : s.langChoice;

  const send = useCallback((p: Person, text: string) => {
    const mine: Msg = { id: uid(), mine: true, text, at: Date.now() };
    setS(o => ({ ...o, messages: { ...o.messages, [p.id]: [...(o.messages[p.id] ?? []), mine] } }));
    if (p.demo) {
      setTimeout(() => {
        const reply: Msg = { id: uid(), mine: false, text: dict[lang].demoReply, at: Date.now() };
        setS(o => ({ ...o, messages: { ...o.messages, [p.id]: [...(o.messages[p.id] ?? []), reply] } }));
      }, 700);
    }
  }, [lang]);

  const value = useMemo<Ctx>(() => ({
    ...s, ready, lang, theme: themes[s.themeName], t: dict[lang],
    setTheme: themeName => setS(o => ({ ...o, themeName })),
    setLang: langChoice => setS(o => ({ ...o, langChoice })),
    createProfile: phone => setS(o => ({ ...o, profile: { phone, createdAt: Date.now() } })),
    send,
    block: p => setS(o => ({ ...o, blocked: { ...o.blocked, [p.id]: p.name } })),
    unblock: id => setS(o => { const b = { ...o.blocked }; delete b[id]; return { ...o, blocked: b }; }),
    clearChats: () => setS(o => ({ ...o, messages: {} })),
  }), [s, ready, lang, send]);

  return <C.Provider value={value}>{children}</C.Provider>;
}
