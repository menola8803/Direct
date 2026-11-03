import React, { useEffect, useState } from 'react';
import { AppState, ScrollView, Share, View } from 'react-native';
import { Text, TextInput } from '../ui';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '../store';
import { useNet } from '../net/net';
import { codeState, formatCode, formatPartial } from '../core/pair';
import { MAX_ACTIVE, PairRec, PairWhy } from '../core/pairflow';
import { pairMessage } from '../core/invite';
import { Route } from '../nav';
import { Btn, Card, Header, Label, Screen, SmallBtn } from '../ui';
import { holdLock } from '../lockhold';

const active = (r: PairRec) => r.step !== 'done' && r.step !== 'failed';

// Adding a contact with a one-time code: make one and send it, or type one you got. What is going on is kept
// in the saved state (core/pairflow.ts), so it carries on while the screen is closed.
export default function PairCode({ onBack, go, onOpenChat }: { onBack: () => void; go: (r: Route) => void; onOpenChat: (id: string) => void }) {
  const { theme, t, name, pairs, contacts, signalUrl } = useApp();
  const { pair, signal } = useNet();
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState('');

  // Ask the server what is new now, when the app comes back, and every 15 seconds while this screen is open.
  useEffect(() => {
    pair.sync();
    const iv = setInterval(() => { setNow(Date.now()); pair.sync(); }, 15000);
    const sub = AppState.addEventListener('change', s => { if (s === 'active') pair.sync(); });
    return () => { clearInterval(iv); sub.remove(); };
  }, [pair]);

  const why: Record<PairWhy, string> = {
    none: t.pcWhyNone, used: t.pcWhyUsed, expired: t.pcWhyExpired, wrong: t.pcWhyWrong, bad: t.pcWhyBad, lost: t.pcWhyLost, limit: t.pcWhyLimit, gone: t.pcWhyGone,
  };
  const ended = pairs.filter(r => !active(r));
  const mine = pairs.filter(r => active(r) && r.role === 'A');
  const entered = pairs.filter(r => active(r) && r.role === 'B');
  const state = codeState(text);
  const make = () => { if (!pair.create()) setErr(t.pcMax); else setErr(''); };
  const enter = () => {
    const r = pair.enter(text);
    if (r.ok) { setText(''); setErr(''); return; }
    setErr(r.why === 'own' ? t.pcOwn : r.why === 'many' ? t.pcMany : t.pcBad);
  };
  const share = (digits: string) => { holdLock(); Share.share({ message: pairMessage(formatCode(digits), t, name) }).catch(() => {}); };
  const copy = async (r: PairRec) => { await Clipboard.setStringAsync(formatCode(r.digits!)); setCopied(r.key); };
  // A server older than 0.14.0 ignores the code messages. Connected, but nothing back for 30 seconds: say what is likely.
  const silent = (r: PairRec) => signal === 'online' && now - r.created > 30_000;
  const hoursLeft = (r: PairRec) => Math.max(1, Math.round((r.exp - now) / 3600_000));

  return (
    <Screen>
      <Header title={t.pcTitle} sub={t.pcSub} onBack={onBack} />
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
        {!signalUrl ? (
          <Card>
            <Text style={{ fontSize: 14, lineHeight: 20, color: theme.ink }}>{t.pcNoServer}</Text>
            <Btn title={t.pcNoServerGo} kind="secondary" onPress={() => go({ name: 'connection' })} />
          </Card>
        ) : signal !== 'online' ? <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.pcOffline}</Text> : null}

        {ended.map(r => (
          <Card key={r.key}>
            {r.step === 'done' ? (
              <>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.good }}>{t.pcDone.replace('{name}', () => r.name ?? '')}</Text>
                {r.contactId && contacts[r.contactId] ? <Btn title={t.openChat} onPress={() => { pair.dismiss(r.key); onOpenChat(r.contactId!); }} /> : null}
              </>
            ) : <Text style={{ fontSize: 14, lineHeight: 20, color: theme.danger }}>{why[r.why ?? 'bad']}</Text>}
            <Btn title={t.pcOk} kind="secondary" onPress={() => pair.dismiss(r.key)} />
          </Card>
        ))}

        <Card>
          <Label>{t.pcMakeTitle}</Label>
          <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.pcMakeBody}</Text>
          {mine.map(r => (
            <View key={r.key} style={{ gap: 8, paddingTop: 6 }}>
              {r.step === 'open' && r.digits ? (
                <>
                  <Text selectable style={{ fontSize: 30, fontWeight: '700', letterSpacing: 2, color: theme.ink }}>{formatCode(r.digits)}</Text>
                  <Text style={{ fontSize: 13, color: theme.muted }}>{t.pcWaiting} {t.pcValid.replace('{n}', String(hoursLeft(r)))}</Text>
                  <Btn title={t.pcShare} onPress={() => share(r.digits!)} />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}><Btn kind="secondary" title={copied === r.key ? t.copied : t.copyCode} onPress={() => copy(r)} /></View>
                    <View style={{ flex: 1 }}><Btn kind="secondary" title={t.pcCancelCode} onPress={() => pair.cancel(r.key)} /></View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 14, color: theme.muted }}>{r.step === 'opening' ? (signal === 'online' ? t.pcPreparing : t.pcWaitServer) : t.pcSending}</Text>
                  {silent(r) ? <Text style={{ fontSize: 13, lineHeight: 19, color: theme.danger }}>{t.pcOldServer}</Text> : null}
                  <SmallBtn title={t.pcCancelCode} onPress={() => pair.cancel(r.key)} />
                </>
              )}
            </View>
          ))}
          {mine.length < MAX_ACTIVE ? <Btn title={t.pcMake} kind={mine.length ? 'secondary' : 'primary'} onPress={make} /> : <Text style={{ fontSize: 13, color: theme.muted }}>{t.pcMax}</Text>}
        </Card>

        <Card>
          <Label>{t.pcEnterTitle}</Label>
          <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.pcEnterBody}</Text>
          <TextInput value={text} onChangeText={v => { setText(formatPartial(v)); setErr(''); }} keyboardType="number-pad" autoCorrect={false} maxLength={12}
            placeholder="0000-00000-0" placeholderTextColor={theme.muted}
            style={{ height: 56, borderWidth: 1, borderColor: state === 'bad' ? theme.danger : theme.line, borderRadius: 14, paddingHorizontal: 14, fontSize: 24, fontWeight: '600', letterSpacing: 2, color: theme.ink, backgroundColor: theme.card }} />
          {state === 'bad' ? <Text style={{ color: theme.danger, fontSize: 13 }}>{t.pcBad}</Text> : null}
          {err && state !== 'bad' ? <Text style={{ color: theme.danger, fontSize: 13 }}>{err}</Text> : null}
          {state === 'ok' ? <Btn title={t.add} onPress={enter} /> : null}
          {entered.map(r => (
            <View key={r.key} style={{ gap: 6, paddingTop: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: theme.ink }}>{t.pcCode} {r.box}…</Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: theme.muted }}>{r.step === 'sent' ? t.pcSent : t.pcSending}</Text>
              {r.step === 'claiming' && silent(r) ? <Text style={{ fontSize: 13, lineHeight: 19, color: theme.danger }}>{t.pcOldServer}</Text> : null}
              <SmallBtn title={t.cancel} onPress={() => pair.cancel(r.key)} />
            </View>
          ))}
        </Card>

        <Text style={{ fontSize: 12, lineHeight: 18, color: theme.muted }}>{t.pcSafe}</Text>

        <Card>
          <Label>{t.pcQrTitle}</Label>
          <Btn kind="secondary" title={t.pcMyQr} onPress={() => go({ name: 'mycode' })} />
          <Btn kind="secondary" title={t.pcScanQr} onPress={() => go({ name: 'add' })} />
        </Card>
      </ScrollView>
    </Screen>
  );
}
