import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Text, TextInput } from '../ui';
import { useApp } from '../store';
import { Btn, Card, H1, Screen } from '../ui';

export default function Welcome() {
  const { theme, t, createIdentity } = useApp();
  const [name, setName] = useState('');
  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1, gap: 14 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
          <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: theme.onPrimary, fontFamily: theme.fonts.heading, fontWeight: '600', fontSize: 20 }}>D</Text>
          </View>
          <H1 size={24}>{t.appName}</H1>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', gap: 12, paddingHorizontal: 4 }}>
          <Text style={{ fontFamily: theme.fonts.heading, fontWeight: '600', fontSize: 36, lineHeight: 40, color: theme.ink, letterSpacing: -0.8 }}>
            {t.tagline1}{'\n'}<Text style={{ color: theme.accent }}>{t.tagline2}</Text>
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 23, color: theme.muted }}>{t.welcomeBody}</Text>
        </View>
        <Card>
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.ink }}>{t.yourName}</Text>
          <TextInput value={name} onChangeText={setName} placeholder={t.namePh} placeholderTextColor={theme.muted}
            style={{ height: 52, borderWidth: 1, borderColor: theme.line, borderRadius: 14, paddingHorizontal: 16, fontSize: 17, color: theme.ink, backgroundColor: theme.bg }} />
          <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.nameHint}</Text>
        </Card>
        <Btn title={t.create} onPress={() => name.trim() && createIdentity(name)} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
