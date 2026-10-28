import React, { useState } from 'react';
import { Share, View } from 'react-native';
import { Text } from '../ui';
import { useApp } from '../store';
import { cardToContact, decodeCard, encodeCard, safetyCode } from '../core/crypto';
import { inviteMessage } from '../core/invite';
import { Avatar, Btn, Card, Header, Screen } from '../ui';

// Shown when someone opens a Direct invite link (or code) on a phone that has the app.
export default function Invite({ card, onBack, onOpenChat }: { card: string; onBack: () => void; onOpenChat: (id: string) => void }) {
  const { theme, t, identity, name, contacts, addContact, unblock } = useApp();
  const [added, setAdded] = useState(false);
  const c = decodeCard(card);
  if (!c || !identity) return <Screen><Header title={t.inviteTitle} onBack={onBack} /><Text style={{ color: theme.danger }}>{t.badCode}</Text></Screen>;
  const contact = cardToContact(c);
  const isSelf = contact.signPub === identity.signPublic;
  const known = !!contacts[contact.id];
  const shareBack = () => Share.share({ message: inviteMessage(encodeCard(identity, name), t, name) }).catch(() => {});
  return (
    <Screen>
      <Header title={t.inviteTitle} onBack={onBack} />
      <Card style={{ alignItems: 'center' }}>
        <Avatar name={c.n} size={72} ring={theme.accent} />
        <Text style={{ fontSize: 22, fontWeight: '700', color: theme.ink }}>{c.n}</Text>
        <Text style={{ fontSize: 13, color: theme.muted, textAlign: 'center' }}>{t.inviteBody} {c.n}.</Text>
        <Text style={{ fontSize: 12, color: theme.muted, textAlign: 'center' }}>{t.safetyCode}: {safetyCode(identity.signPublic, identity.boxPublic, contact.signPub, contact.boxPub)}</Text>
      </Card>
      {isSelf ? <Text style={{ color: theme.danger }}>{t.selfCode}</Text> : null}
      {known && !added ? <Text style={{ color: theme.muted }}>{t.alreadyAdded}</Text> : null}
      {added ? <Text style={{ color: theme.good, fontWeight: '600' }}>{t.inviteAdded}</Text> : null}
      <View style={{ gap: 10 }}>
        {!added && !known && !isSelf ? <Btn title={t.add} onPress={() => { unblock(contact.id); addContact(contact); setAdded(true); }} /> : null}
        {(added || known) && !isSelf ? <Btn title={t.shareBack} onPress={shareBack} /> : null}
        {(added || known) && !isSelf ? <Btn title={t.openChat} kind="secondary" onPress={() => onOpenChat(contact.id)} /> : null}
        <Btn title={t.cancel} kind="secondary" onPress={onBack} />
      </View>
    </Screen>
  );
}
