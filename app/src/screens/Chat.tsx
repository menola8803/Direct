import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { Text, TextInput } from '../ui';
import { useApp } from '../store';
import { useNet } from '../net/net';
import * as DocumentPicker from 'expo-document-picker';
import { MAX_SIZE } from '../core/transfer';
import { Avatar, Header, SmallBtn } from '../ui';
import { FileBubble } from '../media/Bubble';
import { Recorded, VideoRecorder, VoiceRecorder } from '../media/Recorder';

export default function Chat({ id, onBack, onVerify, onPair }: { id: string; onBack: () => void; onVerify: () => void; onPair: () => void }) {
  const { theme, t, messages, contacts } = useApp();
  const net = useNet();
  const c = contacts[id];
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'' | 'voice' | 'video'>('');
  const [note, setNote] = useState('');
  const ref = useRef<FlatList>(null);
  useEffect(() => { if (c) net.connect(c); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return null;
  const list = messages[id] ?? [];
  const st = net.link[id];
  const sub = !net.available ? t.rtcMissing : st === 'open' ? t.encryptedDirect : st === 'connecting' ? t.connecting : t.offline;
  const go = () => { const v = text.trim(); if (!v) return; net.sendText(c, v); setText(''); };
  const sendRec = (r: Recorded, kind: 'voice' | 'video') => { setMode(''); net.sendFile(c, { uri: r.uri, name: r.name, mime: r.mime, kind, dur: r.dur }); };
  const pick = async () => {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false }).catch(() => null);
    const a = r && !r.canceled ? r.assets[0] : null;
    if (!a) return;
    if ((a.size ?? 0) > MAX_SIZE) { setNote(t.tooBig); return; }
    setNote(''); net.sendFile(c, { uri: a.uri, name: a.name, mime: a.mimeType ?? 'application/octet-stream', kind: 'file' });
  };
  const startCall = async (video: boolean) => {
    if (!net.calls || st !== 'open') { setNote(!net.calls ? t.noCalls : t.needLink); return; }
    const ok = await net.calls.start([id], video); setNote(ok ? '' : t.callFail);
  };
  const label = (s?: string) => (s === 'delivered' ? t.st_delivered : s === 'sent' ? t.st_sent : s === 'queued' ? t.st_queued : '');
  return (
    <KeyboardAvoidingView style={{ flex: 1, gap: 12 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}><Header title={c.name} sub={sub} onBack={onBack} /></View>
        <SmallBtn title={t.call} onPress={() => startCall(false)} />
        <SmallBtn title={t.video} onPress={() => startCall(true)} />
        <Pressable accessibilityLabel={t.verify} onPress={onVerify}><Avatar name={c.name} size={36} ring={st === 'open' ? theme.good : theme.line} /></Pressable>
      </View>
      <FlatList ref={ref} data={list} keyExtractor={m => m.id} contentContainerStyle={{ gap: 10, paddingVertical: 6 }}
        onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={{ alignItems: item.mine ? 'flex-end' : 'flex-start' }}>
            <View style={{ maxWidth: '82%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderBottomRightRadius: item.mine ? 6 : 18, borderBottomLeftRadius: item.mine ? 18 : 6,
              backgroundColor: item.mine ? theme.bubbleMine : theme.card, borderWidth: item.mine ? 0 : 1, borderColor: theme.line }}>
              {item.file
                ? <FileBubble f={item.file} color={item.mine ? theme.onBubbleMine : theme.ink} progress={net.progress[item.id]} />
                : <Text style={{ fontSize: 15, lineHeight: 21, color: item.mine ? theme.onBubbleMine : theme.ink }}>{item.text}</Text>}
            </View>
            {item.mine ? <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{label(item.status)}</Text> : null}
          </View>
        )} />
      {st !== 'open' ? <Pressable onPress={onPair}><Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>{t.manualTitle} ›</Text></Pressable> : null}
      {note ? <Text style={{ color: theme.danger, fontSize: 13 }}>{note}</Text> : null}
      {mode === 'voice' ? <VoiceRecorder onDone={r => sendRec(r, 'voice')} onCancel={() => setMode('')} /> : null}
      {mode === 'video' ? <VideoRecorder onDone={r => sendRec(r, 'video')} onCancel={() => setMode('')} /> : null}
      {mode === '' ? (
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <SmallBtn title="＋" onPress={pick} />
        <SmallBtn title="🎙" onPress={() => setMode('voice')} />
        <SmallBtn title="🎥" onPress={() => setMode('video')} />
        <TextInput value={text} onChangeText={setText} onSubmitEditing={go} placeholder={t.message} placeholderTextColor={theme.muted}
          style={{ flex: 1, height: 48, borderRadius: 24, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card, paddingHorizontal: 14, fontSize: 15, color: theme.ink }} />
        <Pressable accessibilityLabel={t.send} accessibilityRole="button" onPress={go}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.onPrimary, fontSize: 20, fontWeight: '700' }}>↑</Text>
        </Pressable>
      </View>) : null}
    </KeyboardAvoidingView>
  );
}
