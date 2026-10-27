import React from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../store';
import { Avatar, Card, Header, Screen, SmallBtn } from '../ui';

export default function Blocked({ onBack }: { onBack: () => void }) {
  const { theme, t, blocked, unblock } = useApp();
  const ids = Object.keys(blocked);
  return (
    <Screen>
      <Header title={t.blocked} sub={`${ids.length}`} onBack={onBack} />
      {ids.length === 0 ? <Text style={{ color: theme.muted, fontSize: 15 }}>{t.noBlocked}</Text> : (
        <Card>
          {ids.map(id => (
            <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={blocked[id]} />
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: theme.ink }}>{blocked[id]}</Text>
              <SmallBtn title={t.unblock} tone="accent" onPress={() => unblock(id)} />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
