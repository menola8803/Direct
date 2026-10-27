import React, { useState } from 'react';
import { ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useApp } from '../store';
import { useNet } from '../net/net';
import { Btn, Card, Header, Label, Screen } from '../ui';

export default function Connection({ onBack }: { onBack: () => void }) {
  const a = useApp(); const { theme, t } = a;
  const net = useNet();
  const [u, setU] = useState(a.signalUrl), [tu, setTu] = useState(a.turnUrl), [tn, setTn] = useState(a.turnUser), [tc, setTc] = useState(a.turnCred);
  const [hide, setHide] = useState(a.hideIp), [ok, setOk] = useState(false);
  const field = (label: string, v: string, set: (s: string) => void, ph: string, secure?: boolean) => (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <TextInput value={v} onChangeText={x => { set(x); setOk(false); }} autoCapitalize="none" autoCorrect={false} secureTextEntry={secure} placeholder={ph} placeholderTextColor={theme.muted}
        style={{ height: 48, borderWidth: 1, borderColor: theme.line, borderRadius: 14, paddingHorizontal: 14, color: theme.ink, backgroundColor: theme.bg }} />
    </View>
  );
  const status = !a.signalUrl ? t.noServer : net.signal === 'online' ? t.sigOnline : net.signal === 'connecting' ? t.sigConnecting : t.sigOffline;
  return (
    <Screen>
      <Header title={t.connection} sub={t.connectionSub} onBack={onBack} />
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={{ color: net.signal === 'online' ? theme.good : theme.muted, fontWeight: '600' }}>{status}</Text>
          {field(t.signalUrl, u, setU, 'wss://signal.example.com')}
          <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.signalHelp}</Text>
        </Card>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: theme.ink }}>{t.hideIp}</Text>
            <Switch value={hide} onValueChange={v => { setHide(v); setOk(false); }} />
          </View>
          <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.hideIpHelp}</Text>
          {field(t.turnUrl, tu, setTu, 'turn:turn.example.com:3478')}
          {field(t.turnUser, tn, setTn, '')}
          {field(t.turnCred, tc, setTc, '', true)}
        </Card>
        <Btn title={ok ? t.saved : t.save} onPress={() => { a.setSettings({ signalUrl: u.trim(), turnUrl: tu.trim(), turnUser: tn.trim(), turnCred: tc, hideIp: hide }); setOk(true); }} />
      </ScrollView>
    </Screen>
  );
}
