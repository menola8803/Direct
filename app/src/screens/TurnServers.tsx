import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '../ui';
import { useApp } from '../store';
import { rtc } from '../net/rtc';
import { MAX_TURN, Turn, parseTurn, pingTurn, turnText } from '../net/turn';
import { Btn, Card, Header, Label, Screen } from '../ui';

type Res = number | null | undefined; // ms, null = no relay, undefined = not tested
const DOCS = 'https://github.com/menola8803/Direct/blob/main/docs/NETWORK.md';

export default function TurnServers({ onBack }: { onBack: () => void }) {
  const { theme, t, turnList, setSettings } = useApp();
  const list = parseTurn(turnList);
  const [url, setUrl] = useState(''), [user, setUser] = useState(''), [pass, setPass] = useState('');
  const [bad, setBad] = useState(false), [testing, setTesting] = useState(false);
  const [res, setRes] = useState<Record<string, Res>>({});
  const key = (x: Turn) => `${x.urls} ${x.username ?? ''}`;
  const save = (l: Turn[]) => setSettings({ turnList: turnText(l) });

  const add = () => {
    const line = [url.trim(), user.trim(), user.trim() ? pass : ''].filter(Boolean).join(' ');
    const one = parseTurn(line)[0];
    if (!one || list.length >= MAX_TURN) { setBad(true); return; }
    save(parseTurn(turnText([...list, one])));
    setUrl(''); setUser(''); setPass(''); setBad(false);
  };
  const remove = (x: Turn) => { save(list.filter(y => key(y) !== key(x))); setRes(o => { const n = { ...o }; delete n[key(x)]; return n; }); };
  const testAll = async () => {
    if (!rtc) return;
    setTesting(true); setRes({});
    await Promise.all(list.map(async x => { const ms = await pingTurn(rtc!, x); setRes(o => ({ ...o, [key(x)]: ms })); }));
    setTesting(false);
  };
  const failed = list.filter(x => res[key(x)] === null);
  const input = (v: string, set: (s: string) => void, ph: string, secure?: boolean) => (
    <TextInput value={v} onChangeText={x => { set(x); setBad(false); }} autoCapitalize="none" autoCorrect={false} secureTextEntry={secure} placeholder={ph} placeholderTextColor={theme.muted}
      style={{ height: 48, borderWidth: 1, borderColor: theme.line, borderRadius: 14, paddingHorizontal: 14, color: theme.ink, backgroundColor: theme.bg }} />
  );

  return (
    <Screen>
      <Header title={t.turnTitle} sub={t.turnSub} onBack={onBack} />
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.turnHelp}</Text>
        </Card>
        <Card>
          <Label>{t.turnUrl}</Label>
          {input(url, setUrl, 'turn:turn.example.com:3478')}
          {input(user, setUser, t.turnUser)}
          {input(pass, setPass, t.turnCred, true)}
          {bad ? <Text style={{ color: theme.danger }}>{list.length >= MAX_TURN ? t.turnMax : t.turnBad}</Text> : null}
          <Btn title={t.add} onPress={add} />
        </Card>
        <Card>
          {list.length === 0 ? <Text style={{ color: theme.muted }}>{t.turnEmpty}</Text> : null}
          {list.map(x => {
            const r = res[key(x)];
            return (
              <View key={key(x)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
                <Text style={{ width: 22, fontSize: 16, color: r === undefined ? theme.muted : r === null ? theme.danger : theme.good }}>{r === undefined ? '•' : r === null ? '✗' : '✓'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: theme.ink }}>{x.urls.replace(/^turns?:/, m => (m === 'turns:' ? 'TLS ' : ''))}</Text>
                  <Text style={{ fontSize: 12, color: theme.muted }}>{r === null ? t.turnNoRelay : r !== undefined ? `${r} ms` : x.username ?? ''}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={t.delete} onPress={() => remove(x)} hitSlop={8}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.line }}>
                  <Text style={{ color: theme.danger, fontWeight: '600' }}>{t.delete}</Text>
                </Pressable>
              </View>
            );
          })}
        </Card>
        {!rtc ? <Text style={{ color: theme.danger }}>{t.rtcMissing}</Text> : null}
        {list.length > 0 ? <Btn title={testing ? t.connecting : t.turnTest} kind="secondary" onPress={testAll} /> : null}
        {failed.length > 0 ? <Btn title={`${t.stunRemoveFailed} (${failed.length})`} kind="danger" onPress={() => save(list.filter(x => res[key(x)] !== null))} /> : null}
        <Btn title={t.turnDocs} kind="secondary" onPress={() => Linking.openURL(DOCS).catch(() => {})} />
      </ScrollView>
    </Screen>
  );
}
