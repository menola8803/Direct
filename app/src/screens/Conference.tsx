import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../ui';
import { useApp } from '../store';
import { useNet } from '../net/net';
import { MAX_AUDIO, MAX_VIDEO } from '../net/calls';
import { Avatar, Btn, Header, Screen } from '../ui';

export default function Conference({ onBack }: { onBack: () => void }) {
  const { theme, t, contacts, blocked } = useApp();
  const { link, calls } = useNet();
  const [sel, setSel] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const list = Object.values(contacts).filter(c => !blocked[c.id]);
  const toggle = (id: string) => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  const go = async (video: boolean) => {
    if (!calls) { setErr(t.noCalls); return; }
    if (sel.length + 1 > (video ? MAX_VIDEO : MAX_AUDIO)) { setErr(t.pickMembers); return; }
    const ok = await calls.start(sel, video);
    if (!ok) setErr(t.callFail);
  };
  return (
    <Screen>
      <Header title={t.groupCall} sub={t.pickMembers} onBack={onBack} />
      <ScrollView contentContainerStyle={{ gap: 6 }}>
        {list.map(c => {
          const on = link[c.id] === 'open';
          return (
            <Pressable key={c.id} disabled={!on} onPress={() => toggle(c.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, opacity: on ? 1 : 0.45 }}>
              <Avatar name={c.name} ring={sel.includes(c.id) ? theme.good : theme.line} />
              <View style={{ flex: 1 }}><Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink }}>{c.name}</Text><Text style={{ fontSize: 13, color: theme.muted }}>{on ? t.online : t.needLink}</Text></View>
              <Text style={{ fontSize: 20, color: theme.accent }}>{sel.includes(c.id) ? '✓' : ''}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {err ? <Text style={{ color: theme.danger }}>{err}</Text> : null}
      <Btn title={t.call} kind="secondary" onPress={() => go(false)} />
      <Btn title={t.videoCall} onPress={() => go(true)} />
    </Screen>
  );
}
