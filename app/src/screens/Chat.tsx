import React, { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Person, useApp } from '../store';
import { Avatar, Header } from '../ui';

export default function Chat({ person, onBack }: { person: Person; onBack: () => void }) {
  const { theme, t, messages, send } = useApp();
  const [text, setText] = useState('');
  const ref = useRef<FlatList>(null);
  const list = messages[person.id] ?? [];
  const go = () => { const v = text.trim(); if (!v) return; send(person, v); setText(''); };
  return (
    <KeyboardAvoidingView style={{ flex: 1, gap: 12 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}><Header title={person.name} sub={t.encrypted} onBack={onBack} /></View>
        <Avatar name={person.name} size={36} ring={theme.good} />
      </View>
      <FlatList ref={ref} data={list} keyExtractor={m => m.id} contentContainerStyle={{ gap: 10, paddingVertical: 6 }}
        onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={{ alignItems: item.mine ? 'flex-end' : 'flex-start' }}>
            <View style={{ maxWidth: '82%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderBottomRightRadius: item.mine ? 6 : 18, borderBottomLeftRadius: item.mine ? 18 : 6,
              backgroundColor: item.mine ? theme.bubbleMine : theme.card, borderWidth: item.mine ? 0 : 1, borderColor: theme.line }}>
              <Text style={{ fontSize: 15, lineHeight: 21, color: item.mine ? theme.onBubbleMine : theme.ink }}>{item.text}</Text>
            </View>
          </View>
        )} />
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <TextInput value={text} onChangeText={setText} onSubmitEditing={go} placeholder={t.message} placeholderTextColor={theme.muted}
          style={{ flex: 1, height: 48, borderRadius: 24, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card, paddingHorizontal: 18, fontSize: 15, color: theme.ink }} />
        <Pressable accessibilityLabel={t.send} accessibilityRole="button" onPress={go}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.onPrimary, fontSize: 20, fontWeight: '700' }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
