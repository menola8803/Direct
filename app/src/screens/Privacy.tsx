import React from 'react';
import { Linking, ScrollView, Switch, View } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { Text } from '../ui';
import { useApp } from '../store';
import { planIce } from '../net/ice';
import { Btn, Card, Header, Screen } from '../ui';
import { Route } from '../nav';

const ORBOT = 'https://guardianproject.info/apps/org.torproject.android/';

export default function Privacy({ onBack, go }: { onBack: () => void; go: (r: Route) => void }) {
  const { theme, t, hideIp, tcpOnly, stunList, turnList, setSettings } = useApp();
  const plan = planIce({ stunList, turnList, hideIp, tcpOnly });
  const toggle = (title: string, help: string, value: boolean, set: (v: boolean) => void) => (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: theme.ink }}>{title}</Text>
        <Switch value={value} onValueChange={set} />
      </View>
      <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{help}</Text>
    </Card>
  );
  const openVpn = () => IntentLauncher.startActivityAsync('android.settings.VPN_SETTINGS').catch(() => Linking.openSettings().catch(() => {}));
  return (
    <Screen>
      <Header title={t.privacyTitle} sub={t.privacySub} onBack={onBack} />
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 12 }}>
        {toggle(t.hideIp, t.hideIpHelp, hideIp, v => setSettings({ hideIp: v }))}
        {toggle(t.tcpOnly, t.tcpOnlyHelp, tcpOnly, v => setSettings({ tcpOnly: v }))}
        {plan.needsTurn ? (
          <Card>
            <Text style={{ color: theme.danger, lineHeight: 20 }}>{t.privacyNeedsTurn}</Text>
            <Btn title={t.turnTitle} onPress={() => go({ name: 'turn' })} />
          </Card>
        ) : null}
        <Card>
          <Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink }}>{t.torTitle}</Text>
          <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.torBody}</Text>
          <Btn title={t.openVpn} kind="secondary" onPress={openVpn} />
          <Btn title={t.getOrbot} kind="secondary" onPress={() => Linking.openURL(ORBOT).catch(() => {})} />
        </Card>
      </ScrollView>
    </Screen>
  );
}
