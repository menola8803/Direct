import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { Text, TextInput } from '../ui';
import { useApp } from '../store';
import { rtc } from '../net/rtc';
import { DEFAULT_STUN, parseStun, pingStun } from '../net/stun';
import { Btn, Card, Header, Screen } from '../ui';
import { Res, TestBtn, TestRow, useTestBox } from '../testkit';

export default function StunServers({ onBack }: { onBack: () => void }) {
  const { theme, t, stunList, setSettings } = useApp();
  const saved = parseStun(stunList);
  const list = saved.length ? saved : DEFAULT_STUN;
  const usingDefaults = saved.length === 0;
  const [res, setRes] = useState<Record<string, Res>>({});
  const [text, setText] = useState('');
  const box = useTestBox();

  const save = (l: string[]) => { setSettings({ stunList: l.join('\n') }); };
  const add = () => {
    const added = parseStun(text);
    if (!added.length) return;
    const base = usingDefaults ? [] : list; // the first own server replaces the defaults
    save([...base, ...added].filter((x, i, arr) => arr.indexOf(x) === i));
    setText('');
  };
  const remove = (u: string) => { save(list.filter(x => x !== u)); setRes(o => { const n = { ...o }; delete n[u]; return n; }); };
  const host = (u: string) => u.replace(/^stuns?:/, '');
  // Hold an address: test just that server. Hold the button: test them all.
  const testOne = (u: string) => box.run(host(u), async () => {
    if (!rtc) return { ok: false, detail: t.rtcMissing };
    const ms = await pingStun(rtc, u);
    setRes(o => ({ ...o, [u]: ms }));
    return ms === null ? { ok: false, detail: t.stunNoAnswer } : { ok: true, detail: `${ms} ms · ${host(u)}` };
  });
  const testAll = () => box.run(t.testStun, async () => {
    if (!rtc) return { ok: false, detail: t.rtcMissing };
    setRes({});
    const all = await Promise.all(list.map(async u => { const ms = await pingStun(rtc!, u); setRes(o => ({ ...o, [u]: ms })); return ms; }));
    const n = all.filter(m => m !== null).length;
    return { ok: n === all.length, detail: `${n} / ${all.length}` };
  });
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
          {list.length > 0 ? <Text style={{ fontSize: 12, color: theme.muted }}>{t.holdHintRow}</Text> : null}
          {list.map(u => (
            <TestRow key={u} label={host(u)} res={res[u] as Res} noAnswer={t.stunNoAnswer} helpText={t.stunHowTo} testLabel={t.testStun}
              onHelp={() => box.help(t.stunHowToTitle, t.stunHowTo)} onTest={() => testOne(u)} onDelete={() => remove(u)} />
          ))}
          {list.length === 0 ? <Text style={{ color: theme.muted }}>{t.stunEmpty}</Text> : null}
        </Card>
        {!rtc ? <Text style={{ color: theme.danger }}>{t.rtcMissing}</Text> : null}
        <TestBtn title={t.testStun} onHelp={() => box.help(t.stunAllTitle, t.stunAllHowTo)} onTest={testAll} />
        {failed > 0 ? <Btn title={`${t.stunRemoveFailed} (${failed})`} kind="danger" onPress={removeFailed} /> : null}
        <Btn title={t.stunReset} kind="secondary" onPress={() => { save([]); setRes({}); }} />
      </ScrollView>
      {box.node}
    </Screen>
  );
}
