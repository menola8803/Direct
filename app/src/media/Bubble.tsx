import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as Sharing from 'expo-sharing';
import { Attach, useApp } from '../store';
import { fmtSize } from '../files';
import { Btn } from '../ui';

function Voice({ f, color }: { f: Attach; color: string }) {
  const { t } = useApp();
  const player = useAudioPlayer(f.uri);
  const st = useAudioPlayerStatus(player);
  return (
    <Pressable accessibilityRole="button" onPress={() => { if (st.playing) player.pause(); else { if (st.didJustFinish || st.currentTime >= (st.duration || 1)) player.seekTo(0); player.play(); } }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 160 }}>
      <Text style={{ color, fontSize: 22 }}>{st.playing ? '❚❚' : '▶'}</Text>
      <View><Text style={{ color, fontWeight: '600' }}>{t.voiceMsg}</Text><Text style={{ color, opacity: 0.7, fontSize: 12 }}>{f.dur ? `${f.dur}s` : fmtSize(f.size)}</Text></View>
    </Pressable>
  );
}

function Video({ f }: { f: Attach }) {
  const player = useVideoPlayer(f.uri, p => { p.loop = false; });
  return <VideoView player={player} style={{ width: 220, height: 280, borderRadius: 12, backgroundColor: '#000' }} nativeControls contentFit="cover" />;
}

export function FileBubble({ f, color, progress }: { f: Attach; color: string; progress?: number }) {
  const { t } = useApp();
  const share = () => Sharing.shareAsync(f.uri, { mimeType: f.mime }).catch(() => {});
  return (
    <View style={{ gap: 8 }}>
      {f.kind === 'voice' ? <Voice f={f} color={color} /> : f.kind === 'video' ? <Video f={f} /> : (
        <View><Text style={{ color, fontWeight: '600' }}>{f.name}</Text><Text style={{ color, opacity: 0.7, fontSize: 12 }}>{fmtSize(f.size)}</Text></View>
      )}
      {progress !== undefined ? <Text style={{ color, opacity: 0.7, fontSize: 12 }}>{t.sendingPct} {Math.round(progress * 100)}%</Text> : null}
      {f.kind === 'voice' ? null : <Btn title={t.openFile} kind="secondary" onPress={share} />}
    </View>
  );
}
