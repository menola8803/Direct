import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useApp } from '../store';
import { useNet } from '../net/net';
import { Avatar, Header } from '../ui';

export default function Chat({ id, onBack, onVerify }: { id: string; onBack: () => void; onVerify: () => void }) {
  const { theme, t, messages, contacts } = useApp();
  const net = useNet();
  const c = contacts[id];
  const [text, setText] = useState('');
  const ref = useRef<FlatList>(null);
  useEffect(() => { if (c) net.connect(c); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return null;
  const list = messages[id] ?? [];
  const st = net.link[id];
  const sub = !net.available ? t.rtcMissing : st === 'open' ? t.encryptedDirect : st === 'connecting' ? t.connecting : t.offline;
  const go = () => { const v = text.trim(); if (!v) return; net.sendText(c, v); setText(''); };
  const label = (s?: string) => (s === 'delivered' ? t.st_delivered : s === 'sent' ? t.st_sent : s === 'queued' ? t.st_queued : '');
  return (
    <KeyboardAvoidingView style={{ flex: 1, gap: 12 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}><Header title={c.name} sub={sub} onBack={onBack} /></View>
        <Pressable accessibilityLabel={t.verify} onPress={onVerify}><Avatar name={c.name} size={36} ring={st === 'open' ? theme.good : theme.line} /></Pressable>
      </View>
      <FlatList ref={ref} data={list} keyExtractor={m => m.id} contentContainerStyle={{ gap: 10, paddingVertical: 6 }}
        onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={{ alignItems: item.mine ? 'flex-end' : 'flex-start' }}>
            <View style={{ maxWidth: '82%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderBottomRightRadius: item.mine ? 6 : 18, borderBottomLeftRadius: item.mine ? 18 : 6,
              backgroundColor: item.mine ? theme.bubbleMine : theme.card, borderWidth: item.mine ? 0 : 1, borderColor: theme.line }}>
              <Text style={{ fontSize: 15, lineHeight: 21, color: item.mine ? theme.onBubbleMine : theme.ink }}>{item.text}</Text>
            </View>
            {item.mine ? <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{label(item.status)}</Text> : null}
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
