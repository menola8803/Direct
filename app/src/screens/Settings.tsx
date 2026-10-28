import React from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../ui';
import { useApp } from '../store';
import { Card, H1, Label, Row, Sub } from '../ui';
import { Route } from '../nav';

export default function Settings({ go }: { go: (r: Route) => void }) {
  const { t, theme, langChoice, blocked } = useApp();
  const langLabel = langChoice === 'system' ? t.phoneLang : langChoice === 'sv' ? t.swedish : t.english;
  return (
    <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
      <View><H1>{t.settings}</H1><Sub>{t.settingsSub}</Sub></View>
      <Card>
        <Row title={t.theme} sub={t.themeSub} right={theme.label} onPress={() => go({ name: 'theme' })} />
        <Row title={t.language} sub={t.languageSub} right={langLabel} onPress={() => go({ name: 'language' })} />
        <Row title={t.guideRowTitle} sub={t.guideRowSub} onPress={() => go({ name: 'guide' })} />
        <Row title={t.connection} sub={t.connectionSub} onPress={() => go({ name: 'connection' })} />
        <Row title={t.stunTitle} sub={t.stunSub} onPress={() => go({ name: 'stun' })} />
        <Row title={t.turnTitle} sub={t.turnSub} onPress={() => go({ name: 'turn' })} />
        <Row title={t.privacyTitle} sub={t.privacySub} onPress={() => go({ name: 'privacy' })} />
        <Row title={t.mediaTest} sub={t.mediaTestSub} onPress={() => go({ name: 'mediatest' })} />
        <Row title={t.storage} sub={t.storageSub} onPress={() => go({ name: 'storage' })} />
        <Row title={t.update} sub={t.updateSub} onPress={() => go({ name: 'update' })} />
        <Row title={t.blocked} sub={t.blockedSub} right={String(Object.keys(blocked).length)} onPress={() => go({ name: 'blocked' })} />
        <Row title={t.about} sub={t.aboutSub} onPress={() => go({ name: 'about' })} />
      </Card>
      <Card>
        <Label>{t.fsTitle}</Label>
        <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.fsBody}</Text>
      </Card>
    </ScrollView>
  );
}
