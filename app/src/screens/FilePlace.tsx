import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../ui';
import { useApp } from '../store';
import { FILE_MODES, FileModeChoice, normFileMode } from '../core/filemode';
import { Strings } from '../i18n';
import { Card, Header, Screen } from '../ui';

export const fileModeLabel = (t: Strings, m: FileModeChoice) => (m === 'private' ? t.fmRightPrivate : t.fmRightVisible);

// Where new files, voice and video are kept: a visible folder (Download/Direct) or private and encrypted. Local to this phone.
export default function FilePlace({ onBack }: { onBack: () => void }) {
  const { theme, t, fileMode, setSettings } = useApp();
  const cur = normFileMode(fileMode);
  const info: Record<FileModeChoice, { title: string; sub: string }> = {
    visible: { title: t.fmVisible, sub: t.fmVisibleSub },
    private: { title: t.fmPrivate, sub: t.fmPrivateSub },
  };
  return (
    <Screen>
      <Header title={t.fmTitle} sub={t.fmSub} onBack={onBack} />
      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
        {FILE_MODES.map(m => (
          <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: cur === m }} onPress={() => setSettings({ fileMode: m })}
            style={{ padding: 16, gap: 6, borderRadius: 16, backgroundColor: theme.card, borderWidth: cur === m ? 2 : 1, borderColor: cur === m ? theme.primary : theme.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: theme.ink }}>{info[m].title}</Text>
              {cur === m ? <Text style={{ color: theme.primary, fontSize: 18, fontWeight: '700' }}>✓</Text> : null}
            </View>
            <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{info[m].sub}</Text>
          </Pressable>
        ))}
        <Card>
          <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.fmNote}</Text>
          <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.fmSlow}</Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}
