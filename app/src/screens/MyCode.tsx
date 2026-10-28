import React, { useState } from 'react';
import { Share, View } from 'react-native';
import { Text } from '../ui';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '../store';
import { encodeCard } from '../core/crypto';
import { inviteMessage } from '../core/invite';
import { Btn, Card, Header, Screen } from '../ui';

export default function MyCode({ onBack }: { onBack: () => void }) {
  const { identity, name, t } = useApp();
  const [done, setDone] = useState(false);
  if (!identity) return null;
  const card = encodeCard(identity, name);
  return (
    <Screen>
      <Header title={t.myCode} sub={t.myCodeSub} onBack={onBack} />
      <Card style={{ alignItems: 'center', gap: 14 }}>
        <View style={{ backgroundColor: '#fff', padding: 14, borderRadius: 16 }}><QRCode value={card} size={230} /></View>
        <Text style={{ fontSize: 17, fontWeight: '600' }}>{name}</Text>
      </Card>
      <Btn title={t.shareInvite} onPress={() => Share.share({ message: inviteMessage(card, t, name) }).catch(() => {})} />
      <Btn kind="secondary" title={done ? t.copied : t.copyCode} onPress={async () => { await Clipboard.setStringAsync(card); setDone(true); }} />
    </Screen>
  );
}
