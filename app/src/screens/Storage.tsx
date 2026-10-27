import React, { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { useApp } from '../store';
import { deleteCache, deleteFiles, fmtSize, usedBytes } from '../files';
import { Card, Header, Label, Row, Screen } from '../ui';

export default function Storage({ onBack }: { onBack: () => void }) {
  const { t, theme, contacts, clearChats, clearChat } = useApp();
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState('');
  const sure = (title: string, run: () => void) => Alert.alert(title, t.clearConfirm, [{ text: t.cancel, style: 'cancel' }, { text: t.delete, style: 'destructive', onPress: () => { run(); setTick(x => x + 1); } }]);
  return (
    <Screen>
      <Header title={t.storage} sub={t.storageSub} onBack={onBack} />
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 12 }} key={tick}>
        <Card>
          <Row title={t.clearAllFiles} sub={`${t.used}: ${fmtSize(usedBytes())}`} danger onPress={() => sure(t.clearAllFiles, () => deleteFiles())} />
          <Row title={t.clear} sub={t.clearSub} danger onPress={() => sure(t.clear, () => { clearChats(); deleteFiles(); })} />
          <Row title={t.clearCache} sub={note} onPress={() => { deleteCache(); setNote(t.cacheCleared); }} />
        </Card>
        <Label>{t.pickContact}</Label>
        {Object.values(contacts).map(c => (
          <Card key={c.id}>
            <Text style={{ fontWeight: '700', color: theme.ink }}>{c.name} · {fmtSize(usedBytes(c.id))}</Text>
            <Row title={t.clearContactFiles} danger onPress={() => sure(c.name, () => deleteFiles(c.id))} />
            <Row title={t.clearChatFor} danger onPress={() => sure(c.name, () => { clearChat(c.id); deleteFiles(c.id); })} />
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
