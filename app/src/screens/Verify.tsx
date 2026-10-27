import React from 'react';
import { Alert, Text } from 'react-native';
import { useApp } from '../store';
import { safetyCode } from '../core/crypto';
import { Btn, Card, Header, Screen } from '../ui';

export default function Verify({ id, onBack, onRemoved }: { id: string; onBack: () => void; onRemoved: () => void }) {
  const { theme, t, contacts, identity, setVerified, removeContact } = useApp();
  const c = contacts[id];
  if (!c || !identity) return null;
  const code = safetyCode(identity.signPublic, identity.boxPublic, c.signPub, c.boxPub);
  return (
    <Screen>
      <Header title={c.name} sub={c.verified ? t.verified : t.notVerified} onBack={onBack} />
      <Card>
        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.muted }}>{t.safetyCode}</Text>
        <Text selectable style={{ fontSize: 22, lineHeight: 34, letterSpacing: 1, color: theme.ink, fontVariant: ['tabular-nums'] }}>{code}</Text>
        <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.safetyHelp}</Text>
      </Card>
      <Btn title={c.verified ? t.notVerified : t.markVerified} onPress={() => setVerified(id, !c.verified)} />
      <Btn title={t.removeContact} kind="danger" onPress={() => Alert.alert(t.removeContact, c.name, [{ text: t.cancel, style: 'cancel' }, { text: t.delete, style: 'destructive', onPress: () => { removeContact(id); onRemoved(); } }])} />
    </Screen>
  );
}
