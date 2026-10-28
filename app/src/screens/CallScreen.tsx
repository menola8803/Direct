import React from 'react';
import { View } from 'react-native';
import { Text } from '../ui';
import { useApp } from '../store';
import { useNet } from '../net/net';
import { RTCView } from '../net/rtc';
import { Avatar, Btn, Screen } from '../ui';

const url = (s: any) => { try { return s.toURL(); } catch { return ''; } };

export default function CallScreen() {
  const { theme, t, contacts } = useApp();
  const { call, calls, remote } = useNet();
  if (!calls || call.status === 'idle') return null;
  const nm = (id: string) => contacts[id]?.name ?? '?';
  const label = (s: string) => (s === 'ringing' ? t.calling : s === 'connecting' ? t.connecting : s === 'declined' ? t.decline : t.inCall);

  if (call.status === 'incoming') {
    const from = call.from ?? '';
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Avatar name={nm(from)} size={96} ring={theme.good} />
          <Text style={{ fontSize: 26, fontWeight: '600', color: theme.ink }}>{nm(from)}</Text>
          <Text style={{ color: theme.muted }}>{call.video ? t.incomingVideo : t.incomingCall}</Text>
        </View>
        <View style={{ gap: 10 }}>
          <Btn title={t.accept} onPress={() => { calls.accept(); }} />
          <Btn title={t.decline} kind="danger" onPress={() => calls.decline()} />
        </View>
      </Screen>
    );
  }

  const ids = Object.keys(call.peers);
  const live = ids.filter(i => call.peers[i] === 'in' && remote[i]);
  const cols = ids.length > 1 ? 2 : 1;
  return (
    <Screen>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ids.map(id => (
          <View key={id} style={{ width: cols === 1 ? '100%' : '48.5%', flexGrow: 1, minHeight: 160, borderRadius: 18, overflow: 'hidden', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {call.video && live.includes(id) && RTCView ? <RTCView streamURL={url(remote[id])} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} objectFit="cover" /> : <Avatar name={nm(id)} size={64} />}
            <Text style={{ color: call.video && live.includes(id) ? '#fff' : theme.ink, fontWeight: '600', textShadowColor: '#0008', textShadowRadius: 4 }}>{nm(id)} · {label(call.peers[id])}</Text>
          </View>
        ))}
      </View>
      {call.video && call.local && RTCView ? <RTCView streamURL={url(call.local)} mirror style={{ position: 'absolute', right: 20, bottom: 150, width: 96, height: 128, borderRadius: 12, overflow: 'hidden' }} objectFit="cover" zOrder={1} /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Btn title={call.muted ? t.unmute : t.mute} kind="secondary" onPress={() => calls.toggleMute()} /></View>
        {call.video ? <View style={{ flex: 1 }}><Btn title={call.camOff ? t.camOn : t.camOff} kind="secondary" onPress={() => calls.toggleCam()} /></View> : null}
      </View>
      <Btn title={t.endCall} kind="danger" onPress={() => calls.end()} />
    </Screen>
  );
}
