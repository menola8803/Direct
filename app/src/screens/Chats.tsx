import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useApp } from '../store';
import { useNet } from '../net/net';
import { Avatar, H1 } from '../ui';

export default function Chats({ onOpen }: { onOpen: (id: string) => void }) {
  const { theme, t, messages, blocked, contacts } = useApp();
  const { link } = useNet();
  const data = Object.keys(messages).filter(id => contacts[id] && !blocked[id] && messages[id].length)
    .map(id => ({ id, last: messages[id][messages[id].length - 1] })).sort((a, b) => b.last.at - a.last.at);
  return (
    <View style={{ flex: 1, gap: 12 }}>
      <H1>{t.chats}</H1>
      {data.length === 0 ? <Text style={{ color: theme.muted, fontSize: 15, lineHeight: 22 }}>{t.noChats}</Text> : null}
      <FlatList data={data} keyExtractor={d => d.id} renderItem={({ item }) => (
        <Pressable onPress={() => onOpen(item.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 }}>
          <Avatar name={contacts[item.id].name} ring={link[item.id] === 'open' ? theme.good : theme.line} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink }}>{contacts[item.id].name}</Text>
            <Text numberOfLines={1} style={{ fontSize: 13, color: theme.muted }}>{item.last.text}</Text>
          </View>
        </Pressable>
      )} />
    </View>
  );
}
