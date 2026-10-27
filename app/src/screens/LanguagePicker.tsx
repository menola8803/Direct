import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useApp } from '../store';
import { LangChoice } from '../i18n';
import { Header, Screen } from '../ui';

export default function LanguagePicker({ onBack }: { onBack: () => void }) {
  const { theme, t, langChoice, setLang } = useApp();
  const opts: [LangChoice, string][] = [['system', t.phoneLang], ['sv', t.swedish], ['en', t.english]];
  return (
    <Screen>
      <Header title={t.language} sub={t.languageSub} onBack={onBack} />
      <View style={{ gap: 10 }}>
        {opts.map(([k, label]) => (
          <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: langChoice === k }} onPress={() => setLang(k)}
            style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderRadius: 16, backgroundColor: theme.card, borderWidth: langChoice === k ? 2 : 1, borderColor: langChoice === k ? theme.primary : theme.line }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: theme.ink }}>{label}</Text>
            {langChoice === k ? <Text style={{ color: theme.primary, fontSize: 18, fontWeight: '700' }}>✓</Text> : null}
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
