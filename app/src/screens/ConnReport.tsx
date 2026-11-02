import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { Text } from '../ui';
import { useApp } from '../store';
import { useNet } from '../net/net';
import { Route } from '../nav';
import { cause, hints, reportText } from '../core/diagnose';
import { Btn, Card, Header, Screen } from '../ui';

// "Why does it not connect?": says in words what is wrong, and shows the facts behind it so they can be copied and sent on.
// The numbers update every second while the screen is open.
export default function ConnReport({ id, onBack, go }: { id: string; onBack: () => void; go: (r: Route) => void }) {
  const { theme, t, contacts } = useApp();
  const net = useNet();
  const c = contacts[id];
  const [, setTick] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => { const i = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(i); }, []);
  if (!c) return null;

  const f = net.report(id);
  const why = cause(f);
  const extra = hints(f);
  const tx = t as unknown as Record<string, string>;
  const text = reportText(f, Constants.expoConfig?.version ?? '');
  const toServer = why === 'no-server' || why === 'server-down' || why === 'server-wait';
  return (
    <Screen>
      <Header title={t.dgTitle} sub={c.name} onBack={onBack} />
      <Card style={{ borderColor: why === 'open' ? theme.good : theme.accent, borderWidth: 1.5 }}>
        <Text style={{ fontSize: 15, lineHeight: 22, color: theme.ink }}>{tx['dg_' + why]}</Text>
        {extra.map(h => <Text key={h} style={{ fontSize: 14, lineHeight: 20, color: theme.muted }}>{tx['dgh_' + h]}</Text>)}
      </Card>
      <View style={{ gap: 10 }}>
        {why !== 'open' ? <Btn title={t.dgRetry} onPress={() => net.connect(c)} /> : null}
        {toServer ? <Btn title={t.connection} kind="secondary" onPress={() => go({ name: 'connection' })} /> : null}
        {why === 'no-path' ? <Btn title={t.turnTitle} kind="secondary" onPress={() => go({ name: 'turn' })} /> : null}
        {extra.includes('stun-silent') ? <Btn title={t.stunTitle} kind="secondary" onPress={() => go({ name: 'stun' })} /> : null}
        {why !== 'open' ? <Btn title={t.manualTitle} kind="secondary" onPress={() => go({ name: 'pair', id })} /> : null}
      </View>
      <Card>
        <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: theme.accent }}>{t.dgDetails}</Text>
        <Text selectable style={{ fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo', fontSize: 12, lineHeight: 18, color: theme.ink }}>{text}</Text>
        <Btn title={done ? t.copied : t.dgCopy} kind="secondary" onPress={async () => { await Clipboard.setStringAsync(text); setDone(true); }} />
      </Card>
    </Screen>
  );
}
