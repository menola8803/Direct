import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useApp } from '../store';
import { Card, Header, Screen } from '../ui';
import { headingFont } from '../theme';
import pkg from '../../package.json';

export default function About({ onBack }: { onBack: () => void }) {
  const { theme, t } = useApp();
  const items: [string, string][] = [[t.p1t, t.p1b], [t.p2t, t.p2b], [t.p3t, t.p3b]];
  return (
    <Screen>
      <Header title={t.about} onBack={onBack} />
      <ScrollView contentContainerStyle={{ gap: 14 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: headingFont, fontWeight: '600', fontSize: 30, lineHeight: 34, color: theme.ink, letterSpacing: -0.6, paddingHorizontal: 4 }}>
          {t.aboutHeadline1} <Text style={{ color: theme.accent }}>{t.aboutHeadline2}</Text>
        </Text>
        <Card>
          {items.map(([h, b]) => (
            <View key={h} style={{ gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: theme.ink }}>{h}</Text>
              <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{b}</Text>
            </View>
          ))}
        </Card>
        <Text style={{ textAlign: 'center', fontSize: 13, color: theme.muted }}>{t.version} {pkg.version}</Text>
        <Text style={{ textAlign: 'center', fontSize: 13, color: theme.muted }}>{t.developer}</Text>
      </ScrollView>
    </Screen>
  );
}
