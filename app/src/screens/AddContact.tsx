import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text, TextInput } from '../ui';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '../store';
import { cardToContact, decodeCard } from '../core/crypto';
import { Btn, Header, Screen } from '../ui';

export default function AddContact({ onBack, onAdded }: { onBack: () => void; onAdded: (id: string) => void }) {
  const { theme, t, identity, addContact, unblock } = useApp();
  const [perm, ask] = useCameraPermissions();
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const busy = useRef(false);
  useEffect(() => { if (perm && !perm.granted && perm.canAskAgain) ask(); }, [perm]); // eslint-disable-line react-hooks/exhaustive-deps

  const take = (raw: string) => {
    if (busy.current) return;
    const idx = raw.indexOf('direct1:');
    const card = idx >= 0 ? decodeCard(raw.slice(idx).split(/\s/)[0]) : null;
    if (!card) { setErr(t.badCode); return; }
    const c = cardToContact(card);
    if (identity && c.signPub === identity.signPublic) { setErr(t.selfCode); return; }
    busy.current = true;
    unblock(c.id); addContact(c); onAdded(c.id);
  };
  return (
    <Screen>
      <Header title={t.addContact} onBack={onBack} />
      {perm?.granted ? (
        <View style={{ height: 280, borderRadius: 18, overflow: 'hidden' }}>
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={e => take(e.data)} />
        </View>
      ) : <Text style={{ color: theme.muted }}>{t.camDenied}</Text>}
      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.ink }}>{t.pasteCode}</Text>
      <TextInput value={text} onChangeText={v => { setText(v); setErr(''); }} autoCapitalize="none" autoCorrect={false} multiline placeholder="direct1:…" placeholderTextColor={theme.muted}
        style={{ minHeight: 70, borderWidth: 1, borderColor: theme.line, borderRadius: 14, padding: 12, color: theme.ink, backgroundColor: theme.card }} />
      {err ? <Text style={{ color: theme.danger }}>{err}</Text> : null}
      <View style={{ gap: 10 }}>
        <Btn title={t.add} onPress={() => take(text)} />
        <Btn title="↧" kind="secondary" onPress={async () => setText(await Clipboard.getStringAsync())} />
      </View>
    </Screen>
  );
}
