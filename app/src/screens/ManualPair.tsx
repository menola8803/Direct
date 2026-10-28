import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { Text, TextInput } from '../ui';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '../store';
import { useNet } from '../net/net';
import { Btn, Card, Header, Screen } from '../ui';

function CodeBox({ code }: { code: string }) {
  const { theme, t } = useApp();
  const [done, setDone] = useState(false);
  return (
    <Card>
      {code.length < 2200 ? <View style={{ alignSelf: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 12 }}><QRCode value={code} size={210} ecl="L" /></View> : null}
      <Text selectable numberOfLines={3} style={{ fontSize: 11, color: theme.muted }}>{code}</Text>
      <Btn title={done ? t.copied : t.copyCode} kind="secondary" onPress={async () => { await Clipboard.setStringAsync(code); setDone(true); }} />
      <Btn title={t.shareCode} onPress={() => Share.share({ message: code }).catch(() => {})} />
    </Card>
  );
}

function CodeInput({ value, onChange, ph }: { value: string; onChange: (v: string) => void; ph: string }) {
  const { theme, t } = useApp();
  const [perm, ask] = useCameraPermissions();
  const [scan, setScan] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <TextInput value={value} onChangeText={onChange} multiline autoCapitalize="none" autoCorrect={false} placeholder={ph} placeholderTextColor={theme.muted}
        style={{ minHeight: 70, borderWidth: 1, borderColor: theme.line, borderRadius: 14, padding: 12, color: theme.ink, backgroundColor: theme.card }} />
      {scan && perm?.granted ? (
        <View style={{ height: 240, borderRadius: 16, overflow: 'hidden' }}>
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={e => { if (e.data.includes('directm1:')) { onChange(e.data); setScan(false); } }} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Btn title="↧" kind="secondary" onPress={async () => onChange(await Clipboard.getStringAsync())} /></View>
        <View style={{ flex: 1 }}><Btn title={t.scan} kind="secondary" onPress={async () => { if (!perm?.granted) await ask(); setScan(s => !s); }} /></View>
      </View>
    </View>
  );
}

export default function ManualPair({ id, onBack }: { id: string; onBack: () => void }) {
  const { theme, t, contacts } = useApp();
  const net = useNet();
  const c = contacts[id];
  const [step, setStep] = useState<'' | 'start' | 'recv'>('');
  const [mine, setMine] = useState('');
  const [other, setOther] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const open = net.link[id] === 'open';
  const closeTimer = useRef<any>(undefined);
  useEffect(() => { if (open) closeTimer.current = setTimeout(onBack, 1200); return () => clearTimeout(closeTimer.current); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return null;
  const run = async (f: () => Promise<void>) => { setBusy(true); setErr(''); try { await f(); } catch { setErr(t.pairFailed); } setBusy(false); };

  return (
    <Screen>
      <Header title={t.manualTitle} sub={c.name} onBack={onBack} />
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 21 }}>{t.manualHelp}</Text>
        {open ? <Text style={{ color: theme.good, fontWeight: '700', fontSize: 18 }}>{t.pairDone}</Text> : null}
        {!net.available ? <Text style={{ color: theme.danger }}>{t.rtcMissing}</Text> : null}
        {!step && !open ? (<>
          <Btn title={t.makeRequest} onPress={() => { setStep('start'); run(async () => setMine(await net.manualOffer(c))); }} />
          <Btn title={t.haveRequest} kind="secondary" onPress={() => setStep('recv')} />
        </>) : null}
        {step === 'start' && !open ? (<>
          <Text style={{ fontWeight: '600', color: theme.ink }}>1. {t.yourRequest}</Text>
          {mine ? <CodeBox code={mine} /> : <Text style={{ color: theme.muted }}>{t.connecting}</Text>}
          <Text style={{ fontWeight: '600', color: theme.ink }}>2. {t.pasteAnswerHere}</Text>
          <CodeInput value={other} onChange={setOther} ph="directm1:…" />
          <Btn title={busy ? t.pairWaiting : t.finish} onPress={() => run(() => net.manualFinish(c, other))} />
        </>) : null}
        {step === 'recv' && !open ? (<>
          <Text style={{ fontWeight: '600', color: theme.ink }}>1. {t.pasteRequest}</Text>
          <CodeInput value={other} onChange={setOther} ph="directm1:…" />
          <Btn title={t.makeAnswer} onPress={() => run(async () => setMine(await net.manualAnswer(c, other)))} />
          {mine ? (<><Text style={{ fontWeight: '600', color: theme.ink }}>2. {t.yourAnswer}</Text><CodeBox code={mine} /><Text style={{ color: theme.muted }}>{t.pairWaiting}</Text></>) : null}
        </>) : null}
        {err ? <Text style={{ color: theme.danger }}>{err}</Text> : null}
      </ScrollView>
    </Screen>
  );
}
