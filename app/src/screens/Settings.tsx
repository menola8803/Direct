import React from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useApp } from '../store';
import { Card, H1, Label, Row, Sub } from '../ui';
import { Route } from '../nav';

export default function Settings({ go }: { go: (r: Route) => void }) {
  const { t, theme, langChoice, blocked, clearChats } = useApp();
  const langLabel = langChoice === 'system' ? t.phoneLang : langChoice === 'sv' ? t.swedish : t.english;
  const confirmClear = () => Alert.alert(t.clear, t.clearConfirm, [{ text: t.cancel, style: 'cancel' }, { text: t.delete, style: 'destructive', onPress: clearChats }]);
  return (
    <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
      <View><H1>{t.settings}</H1><Sub>{t.settingsSub}</Sub></View>
      <Card>
        <Row title={t.theme} sub={t.themeSub} right={theme.label} onPress={() => go({ name: 'theme' })} />
        <Row title={t.language} sub={t.languageSub} right={langLabel} onPress={() => go({ name: 'language' })} />
        <Row title={t.connection} sub={t.connectionSub} onPress={() => go({ name: 'connection' })} />
        <Row title={t.update} sub={t.updateSub} onPress={() => go({ name: 'update' })} />
        <Row title={t.blocked} sub={t.blockedSub} right={String(Object.keys(blocked).length)} onPress={() => go({ name: 'blocked' })} />
        <Row title={t.about} sub={t.aboutSub} onPress={() => go({ name: 'about' })} />
      </Card>
      <Card>
        <Label>{t.clear}</Label>
        <Row title={t.clear} sub={t.clearSub} danger onPress={confirmClear} />
      </Card>
    </ScrollView>
  );
}
