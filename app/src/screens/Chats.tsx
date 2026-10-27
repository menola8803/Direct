import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Person, useApp } from '../store';
import { Avatar, H1 } from '../ui';
import { DEMO } from './Contacts';

export default function Chats({ onOpen }: { onOpen: (p: Person) => void }) {
  const { theme, t, messages, blocked } = useApp();
  const data = Object.keys(messages).filter(id => !blocked[id] && messages[id].length).map(id => ({ id, last: messages[id][messages[id].length - 1] }));
  return (
    <View style={{ flex: 1, gap: 12 }}>
      <H1>{t.chats}</H1>
      {data.length === 0 ? <Text style={{ color: theme.muted, fontSize: 15, lineHeight: 22 }}>{t.noChats}</Text> : null}
      <FlatList data={data} keyExtractor={d => d.id} renderItem={({ item }) => {
        const p = item.id === DEMO.id ? DEMO : { id: item.id, name: item.id };
        return (
          <Pressable onPress={() => onOpen(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 }}>
            <Avatar name={p.name} ring={theme.good} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink }}>{p.name}</Text>
              <Text numberOfLines={1} style={{ fontSize: 13, color: theme.muted }}>{item.last.text}</Text>
            </View>
          </Pressable>
        );
      }} />
    </View>
  );
}
