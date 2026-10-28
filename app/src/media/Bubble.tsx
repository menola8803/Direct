import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../ui';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as Sharing from 'expo-sharing';
import { Attach, useApp } from '../store';
import { discardPlain, fmtSize, isEncrypted, plainCopy } from '../files';
import { Btn } from '../ui';
import { holdLock } from '../lockhold';

// A file that is stored encrypted is decrypted into a short-lived copy only when the person asks to play or open it.
// An ordinary file is used as it is (start() does nothing).
function usePlain(f: Attach) {
  const enc = isEncrypted(f.uri);
  const [uri, setUri] = useState<string | null>(enc ? null : f.uri);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const made = useRef<string | null>(null);
  useEffect(() => {
    setUri(enc ? null : f.uri); setFailed(false);
    return () => { if (made.current) { discardPlain(made.current); made.current = null; } };
  }, [f.uri, enc]);
  const start = useCallback(() => {
    if (!enc || made.current || busy) return;
    setBusy(true); setFailed(false);
    plainCopy(f.uri, f.name).then(u => { made.current = u; setUri(u); }).catch(() => setFailed(true)).finally(() => setBusy(false));
  }, [enc, f.uri, f.name, busy]);
  return { uri, busy, failed, start };
}

function Voice({ f, color }: { f: Attach; color: string }) {
  const { t } = useApp();
  const p = usePlain(f);
  const player = useAudioPlayer(p.uri);
  const st = useAudioPlayerStatus(player);
  const want = useRef(false); // play as soon as the decrypted copy is ready
  useEffect(() => { if (p.uri && want.current) { want.current = false; player.play(); } }, [p.uri, player]);
  const press = () => {
    if (!p.uri) { want.current = true; p.start(); return; }
    if (st.playing) player.pause(); else { if (st.didJustFinish || st.currentTime >= (st.duration || 1)) player.seekTo(0); player.play(); }
  };
  return (
    <Pressable accessibilityRole="button" onPress={press}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 160 }}>
      <Text style={{ color, fontSize: 22 }}>{p.busy ? '…' : p.failed ? '!' : st.playing ? '❚❚' : '▶'}</Text>
      <View><Text style={{ color, fontWeight: '600' }}>{t.voiceMsg}</Text><Text style={{ color, opacity: 0.7, fontSize: 12 }}>{f.dur ? `${f.dur}s` : fmtSize(f.size)}</Text></View>
    </Pressable>
  );
}

function Video({ f }: { f: Attach }) {
  const p = usePlain(f);
  const player = useVideoPlayer(p.uri, pl => { pl.loop = false; });
  if (!p.uri) {
    return (
      <Pressable accessibilityRole="button" onPress={p.start} style={{ width: 220, height: 280, borderRadius: 12, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 34 }}>{p.busy ? '…' : p.failed ? '!' : '▶'}</Text>
      </Pressable>
    );
  }
  return <VideoView player={player} style={{ width: 220, height: 280, borderRadius: 12, backgroundColor: '#000' }} nativeControls contentFit="cover" />;
}

export function FileBubble({ f, color, progress }: { f: Attach; color: string; progress?: number }) {
  const { t } = useApp();
  const [opening, setOpening] = useState(false);
  // An encrypted file is decrypted into the cache first. That copy is removed after a while (see files.ts: clearPlain).
  const share = async () => {
    if (opening) return;
    setOpening(true);
    try { const u = await plainCopy(f.uri, f.name); holdLock(); await Sharing.shareAsync(u, { mimeType: f.mime }); } catch {} finally { setOpening(false); }
  };
  return (
    <View style={{ gap: 8 }}>
      {f.kind === 'voice' ? <Voice f={f} color={color} /> : f.kind === 'video' ? <Video f={f} /> : (
        <View><Text style={{ color, fontWeight: '600' }}>{f.name}</Text><Text style={{ color, opacity: 0.7, fontSize: 12 }}>{fmtSize(f.size)}</Text></View>
      )}
      {progress !== undefined ? <Text style={{ color, opacity: 0.7, fontSize: 12 }}>{t.sendingPct} {Math.round(progress * 100)}%</Text> : null}
      {f.kind === 'voice' ? null : <Btn title={opening ? '…' : t.openFile} kind="secondary" onPress={share} />}
    </View>
  );
}
