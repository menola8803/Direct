import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../ui';
import { useApp } from '../store';
import { ADD_MODES, AddMode, normAddMode } from '../core/addmode';
import { Card, Header, Screen } from '../ui';

// What the Add button on the contacts screen leads to: a one-time code (default) or a QR code. Both stay reachable from those screens.
export default function AddWay({ onBack }: { onBack: () => void }) {
  const { theme, t, addMode, setSettings } = useApp();
  const cur = normAddMode(addMode);
  const info: Record<AddMode, { title: string; sub: string }> = {
    code: { title: t.addwayCode, sub: t.addwayCodeSub },
    qr: { title: t.addwayQr, sub: t.addwayQrSub },
  };
  return (
    <Screen>
      <Header title={t.addwayTitle} sub={t.addwaySub} onBack={onBack} />
      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
        {ADD_MODES.map(m => (
          <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: cur === m }} onPress={() => setSettings({ addMode: m })}
            style={{ padding: 16, gap: 6, borderRadius: 16, backgroundColor: theme.card, borderWidth: cur === m ? 2 : 1, borderColor: cur === m ? theme.primary : theme.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: theme.ink }}>{info[m].title}</Text>
              {cur === m ? <Text style={{ color: theme.primary, fontSize: 18, fontWeight: '700' }}>✓</Text> : null}
            </View>
            <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{info[m].sub}</Text>
          </Pressable>
        ))}
        <Card><Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.addwayNote}</Text></Card>
      </ScrollView>
    </Screen>
  );
}
