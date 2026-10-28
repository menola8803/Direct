import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text, TextInput } from '../ui';
import { useApp } from '../store';
import { useNet } from '../net/net';
import { Btn, Card, Header, Label, Screen } from '../ui';

export default function Connection({ onBack }: { onBack: () => void }) {
  const a = useApp(); const { theme, t } = a;
  const net = useNet();
  const [u, setU] = useState(a.signalUrl), [ok, setOk] = useState(false);
  const status = !a.signalUrl ? t.noServer : net.signal === 'online' ? t.sigOnline : net.signal === 'connecting' ? t.sigConnecting : t.sigOffline;
  return (
    <Screen>
      <Header title={t.connection} sub={t.connectionSub} onBack={onBack} />
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={{ color: net.signal === 'online' ? theme.good : theme.muted, fontWeight: '600' }}>{status}</Text>
          <View style={{ gap: 6 }}>
            <Label>{t.signalUrl}</Label>
            <TextInput value={u} onChangeText={x => { setU(x); setOk(false); }} autoCapitalize="none" autoCorrect={false} placeholder="wss://signal.example.com" placeholderTextColor={theme.muted}
              style={{ height: 48, borderWidth: 1, borderColor: theme.line, borderRadius: 14, paddingHorizontal: 14, color: theme.ink, backgroundColor: theme.bg }} />
          </View>
          <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.signalHelp}</Text>
        </Card>
        <Btn title={ok ? t.saved : t.save} onPress={() => { a.setSettings({ signalUrl: u.trim() }); setOk(true); }} />
      </ScrollView>
    </Screen>
  );
}
