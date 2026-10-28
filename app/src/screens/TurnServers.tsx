import React, { useState } from 'react';
import { Linking, ScrollView } from 'react-native';
import { Text, TextInput } from '../ui';
import { useApp } from '../store';
import { rtc } from '../net/rtc';
import { MAX_TURN, Turn, parseTurn, pingTurn, turnText } from '../net/turn';
import { Btn, Card, Header, Label, Screen } from '../ui';
import { Res, TestBtn, TestRow, useTestBox } from '../testkit';

const DOCS = 'https://github.com/menola8803/Direct/blob/main/docs/NETWORK.md';

export default function TurnServers({ onBack }: { onBack: () => void }) {
  const { theme, t, turnList, setSettings } = useApp();
  const list = parseTurn(turnList);
  const [url, setUrl] = useState(''), [user, setUser] = useState(''), [pass, setPass] = useState('');
  const [bad, setBad] = useState(false);
  const [res, setRes] = useState<Record<string, Res>>({});
  const key = (x: Turn) => `${x.urls} ${x.username ?? ''}`;
  const box = useTestBox();
  const save = (l: Turn[]) => setSettings({ turnList: turnText(l) });

  const add = () => {
    const line = [url.trim(), user.trim(), user.trim() ? pass : ''].filter(Boolean).join(' ');
    const one = parseTurn(line)[0];
    if (!one || list.length >= MAX_TURN) { setBad(true); return; }
    save(parseTurn(turnText([...list, one])));
    setUrl(''); setUser(''); setPass(''); setBad(false);
  };
  const remove = (x: Turn) => { save(list.filter(y => key(y) !== key(x))); setRes(o => { const n = { ...o }; delete n[key(x)]; return n; }); };
  const where = (x: Turn) => x.urls.replace(/^turns?:/, '').replace(/\?.*$/, '');
  // Hold an address: test just that server. Hold the button: test them all.
  const testOne = (x: Turn) => box.run(where(x), async () => {
    if (!rtc) return { ok: false, detail: t.rtcMissing };
    const ms = await pingTurn(rtc, x);
    setRes(o => ({ ...o, [key(x)]: ms }));
    return ms === null ? { ok: false, detail: t.turnNoRelay } : { ok: true, detail: `${ms} ms · ${where(x)}` };
  });
  const testAll = () => box.run(t.turnTest, async () => {
    if (!rtc) return { ok: false, detail: t.rtcMissing };
    setRes({});
    const all = await Promise.all(list.map(async x => { const ms = await pingTurn(rtc!, x); setRes(o => ({ ...o, [key(x)]: ms })); return ms; }));
    const n = all.filter(m => m !== null).length;
    return { ok: n === all.length, detail: `${n} / ${all.length}` };
  });
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
          {list.length === 0 ? <Text style={{ color: theme.muted }}>{t.turnEmpty}</Text> : <Text style={{ fontSize: 12, color: theme.muted }}>{t.holdHintRow}</Text>}
          {list.map(x => (
            <TestRow key={key(x)} label={x.urls.replace(/^turns?:/, m => (m === 'turns:' ? 'TLS ' : ''))} sub={x.username ?? ''} res={res[key(x)] as Res}
              noAnswer={t.turnNoRelay} helpText={t.turnHowTo} testLabel={t.turnTest}
              onHelp={() => box.help(t.turnHowToTitle, t.turnHowTo)} onTest={() => testOne(x)} onDelete={() => remove(x)} />
          ))}
        </Card>
        {!rtc ? <Text style={{ color: theme.danger }}>{t.rtcMissing}</Text> : null}
        {list.length > 0 ? <TestBtn title={t.turnTest} onHelp={() => box.help(t.turnAllTitle, t.turnAllHowTo)} onTest={testAll} /> : null}
        {failed.length > 0 ? <Btn title={`${t.stunRemoveFailed} (${failed.length})`} kind="danger" onPress={() => save(list.filter(x => res[key(x)] !== null))} /> : null}
        <Btn title={t.turnDocs} kind="secondary" onPress={() => Linking.openURL(DOCS).catch(() => {})} />
      </ScrollView>
      {box.node}
    </Screen>
  );
}
