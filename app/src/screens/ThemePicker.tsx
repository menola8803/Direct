import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useApp } from '../store';
import { themes, ThemeName } from '../theme';
import { Btn, Header, Screen, ThemePreview } from '../ui';

export default function ThemePicker({ onBack }: { onBack: () => void }) {
  const { theme, t, setTheme } = useApp();
  const [sel, setSel] = useState<ThemeName>(theme.name);
  return (
    <Screen>
      <Header title={t.theme} sub={t.themeSub} onBack={onBack} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {(Object.keys(themes) as ThemeName[]).map(n => (
          <Pressable key={n} accessibilityRole="radio" accessibilityState={{ selected: sel === n }} onPress={() => setSel(n)}
            style={{ flex: 1, alignItems: 'center', gap: 10, padding: 12, borderRadius: 22, backgroundColor: theme.card, borderWidth: sel === n ? 2 : 1, borderColor: sel === n ? theme.primary : theme.line }}>
            <ThemePreview th={themes[n]} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.ink }}>{themes[n].label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <Btn title={t.useTheme} onPress={() => { setTheme(sel); onBack(); }} />
    </Screen>
  );
}
