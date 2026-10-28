import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../ui';
import { useApp } from '../store';
import { DEFAULT_RETENTION, MAX_RETENTION, RETENTION_DAYS, normRetention } from '../core/retention';
import { Strings } from '../i18n';
import { Card, Header, Screen } from '../ui';

const names = (t: Strings): Record<number, string> => ({ 1: t.kd1, 7: t.kd7, 14: t.kd14, 30: t.kd30, 60: t.kd60, 90: t.kd90 });
// "2 weeks", "3 months" ... for the Settings list.
export const keepLabel = (t: Strings, days: number) => names(t)[normRetention(days)] ?? `${normRetention(days)}`;

// How long conversations (messages, files, voice and video) are kept on this phone. Local: each person sets their own.
export default function Retention({ onBack }: { onBack: () => void }) {
  const { theme, t, retentionDays, setSettings } = useApp();
  const cur = normRetention(retentionDays);
  const n = names(t);
  return (
    <Screen>
      <Header title={t.keepTitle} sub={t.keepSub} onBack={onBack} />
      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
        {RETENTION_DAYS.map(d => (
          <Pressable key={d} accessibilityRole="radio" accessibilityState={{ selected: cur === d }} onPress={() => setSettings({ retentionDays: d })}
            style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderRadius: 16, backgroundColor: theme.card, borderWidth: cur === d ? 2 : 1, borderColor: cur === d ? theme.primary : theme.line }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink }}>{n[d]}</Text>
              {d === DEFAULT_RETENTION || d === MAX_RETENTION ? <Text style={{ fontSize: 12, color: theme.muted }}>{d === DEFAULT_RETENTION ? t.keepDefault : t.keepMax}</Text> : null}
            </View>
            {cur === d ? <Text style={{ color: theme.primary, fontSize: 18, fontWeight: '700' }}>✓</Text> : null}
          </Pressable>
        ))}
        <Card><Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.keepHelp}</Text></Card>
      </ScrollView>
    </Screen>
  );
}
