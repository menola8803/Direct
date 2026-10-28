import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../ui';
import { useApp } from '../store';
import { useNet } from '../net/net';
import { MAX_AUDIO, MAX_VIDEO } from '../net/calls';
import { Avatar, Btn, Card, H1, Sub } from '../ui';
import { Route } from '../nav';

// The Conference tab: pick connected contacts and start a group call (mesh, max 4 with video, 8 audio only).
export default function Conference({ go }: { go: (r: Route) => void }) {
  const { theme, t, contacts, blocked } = useApp();
  const { link, calls } = useNet();
  const [sel, setSel] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const list = Object.values(contacts).filter(c => !blocked[c.id]).sort((a, b) => a.name.localeCompare(b.name));
  const toggle = (id: string) => { setErr(''); setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id])); };
  const start = async (video: boolean) => {
    if (!calls) { setErr(t.noCalls); return; }
    if (sel.length === 0) { setErr(t.confPickFirst); return; }
    if (sel.length + 1 > (video ? MAX_VIDEO : MAX_AUDIO)) { setErr(t.pickMembers); return; }
    const ok = await calls.start(sel, video);
    if (!ok) setErr(t.callFail);
  };
  const steps = [t.confHow1, t.confHow2, t.confHow3];
  return (
    <View style={{ flex: 1, gap: 12 }}>
      <View><H1>{t.groupCall}</H1><Sub>{t.confSub}</Sub></View>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
        <Card style={{ gap: 10, padding: 14 }}>
          {steps.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: theme.accent, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.accent }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: theme.ink }}>{s}</Text>
            </View>
          ))}
          <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.confKnow}</Text>
          <Pressable accessibilityRole="link" onPress={() => go({ name: 'guide' })} hitSlop={8}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.accent }}>{t.confGuide} ›</Text>
          </Pressable>
        </Card>
        {list.length === 0 ? <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>{t.noContactsYet}</Text> : null}
        {list.map(c => {
          const on = link[c.id] === 'open';
          const picked = sel.includes(c.id);
          return (
            <Pressable key={c.id} disabled={!on} accessibilityRole="checkbox" accessibilityState={{ checked: picked, disabled: !on }} onPress={() => toggle(c.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, opacity: on ? 1 : 0.45 }}>
              <Avatar name={c.name} ring={picked ? theme.good : theme.line} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink }}>{c.name}</Text>
                <Text style={{ fontSize: 13, color: theme.muted }}>{on ? t.online : t.needLink}</Text>
              </View>
              <Text style={{ fontSize: 20, color: theme.accent }}>{picked ? '✓' : ''}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={{ fontSize: 13, color: theme.muted }}>{t.confSelected}: {sel.length} · {t.pickMembers}</Text>
      {err ? <Text style={{ color: theme.danger }}>{err}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Btn title={t.call} kind="secondary" onPress={() => start(false)} /></View>
        <View style={{ flex: 1 }}><Btn title={t.videoCall} onPress={() => start(true)} /></View>
      </View>
    </View>
  );
}
