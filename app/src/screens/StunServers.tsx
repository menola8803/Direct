import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '../ui';
import { useApp } from '../store';
import { rtc } from '../net/rtc';
import { DEFAULT_STUN, parseStun, pingStun } from '../net/stun';
import { Btn, Card, Header, Screen } from '../ui';

type Res = number | null | undefined; // ms, null = no answer, undefined = not tested

export default function StunServers({ onBack }: { onBack: () => void }) {
  const { theme, t, stunList, setSettings } = useApp();
  const saved = parseStun(stunList);
  const list = saved.length ? saved : DEFAULT_STUN;
  const usingDefaults = saved.length === 0;
  const [res, setRes] = useState<Record<string, Res>>({});
  const [text, setText] = useState('');
  const [testing, setTesting] = useState(false);

  const save = (l: string[]) => { setSettings({ stunList: l.join('\n') }); };
  const add = () => {
    const added = parseStun(text);
    if (!added.length) return;
    const base = usingDefaults ? [] : list; // the first own server replaces the defaults
    save([...base, ...added].filter((x, i, arr) => arr.indexOf(x) === i));
    setText('');
  };
  const remove = (u: string) => { save(list.filter(x => x !== u)); setRes(o => { const n = { ...o }; delete n[u]; return n; }); };
  const testAll = async () => {
    if (!rtc) return;
    setTesting(true); setRes({});
    await Promise.all(list.map(async u => { const ms = await pingStun(rtc!, u); setRes(o => ({ ...o, [u]: ms })); }));
    setTesting(false);
  };
  const removeFailed = () => save(list.filter(u => res[u] !== null));
  const failed = list.filter(u => res[u] === null).length;

  return (
    <Screen>
      <Header title={t.stunTitle} sub={t.stunHelp} onBack={onBack} />
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        <Card>
          <TextInput value={text} onChangeText={setText} multiline autoCapitalize="none" autoCorrect={false} placeholder={t.stunAddPh} placeholderTextColor={theme.muted}
            style={{ minHeight: 70, borderWidth: 1, borderColor: theme.line, borderRadius: 14, padding: 12, color: theme.ink, backgroundColor: theme.bg }} />
          <Btn title={t.add} onPress={add} />
        </Card>
        <Card>
          {usingDefaults ? <Text style={{ fontSize: 13, color: theme.muted }}>{t.stunDefaultsNote}</Text> : null}
          {list.map(u => {
            const r = res[u];
            return (
              <View key={u} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
                <Text style={{ width: 22, fontSize: 16, color: r === undefined ? theme.muted : r === null ? theme.danger : theme.good }}>{r === undefined ? '•' : r === null ? '✗' : '✓'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: theme.ink }}>{u.replace(/^stuns?:/, '')}</Text>
                  {r !== undefined ? <Text style={{ fontSize: 12, color: theme.muted }}>{r === null ? t.stunNoAnswer : `${r} ms`}</Text> : null}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={t.delete} onPress={() => remove(u)} hitSlop={8}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.line }}>
                  <Text style={{ color: theme.danger, fontWeight: '600' }}>{t.delete}</Text>
                </Pressable>
              </View>
            );
          })}
          {list.length === 0 ? <Text style={{ color: theme.muted }}>{t.stunEmpty}</Text> : null}
        </Card>
        {!rtc ? <Text style={{ color: theme.danger }}>{t.rtcMissing}</Text> : null}
        <Btn title={testing ? t.connecting : t.testStun} kind="secondary" onPress={testAll} />
        {failed > 0 ? <Btn title={`${t.stunRemoveFailed} (${failed})`} kind="danger" onPress={removeFailed} /> : null}
        <Btn title={t.stunReset} kind="secondary" onPress={() => { save([]); setRes({}); }} />
      </ScrollView>
    </Screen>
  );
}
