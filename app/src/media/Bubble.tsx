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
import { atEnd, voiceView } from '../core/voice';
import { playbackMode } from './audiomode';

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
  const player = useAudioPlayer(p.uri, { updateInterval: 250 });
  const st = useAudioPlayerStatus(player);
  const stRef = useRef(st); stRef.current = st;
  const [req, setReq] = useState<number | null>(null); // when play was pressed, until something plays
  const [now, setNow] = useState(Date.now());
  const [opening, setOpening] = useState(false);
  const startedFor = useRef<number | null>(null);

  // While a request is open: look at the clock, so a play that never starts is noticed.
  useEffect(() => { if (req === null) return; const iv = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(iv); }, [req]);
  useEffect(() => { if (req !== null && st.playing) setReq(null); }, [req, st.playing]);
  // Start as soon as the audio is ready (for an encrypted file: after it has been decrypted and loaded).
  useEffect(() => {
    if (req === null || startedFor.current === req || !p.uri || !st.isLoaded) return;
    startedFor.current = req;
    playbackMode().then(() => {
      if (atEnd(stRef.current)) player.seekTo(0);
      player.play();
    });
  }, [req, p.uri, st.isLoaded, player]);

  const view = voiceView({ requested: req !== null, loaded: st.isLoaded, playing: st.playing, error: st.error ?? null, waitedMs: req === null ? 0 : now - req });
  const press = () => {
    if (st.playing) { player.pause(); return; }
    setNow(Date.now()); setReq(Date.now());
    if (!p.uri) p.start(); // encrypted: decrypt first, then the effect above plays it
  };
  const stuck = view === 'stuck';
  // The way out when the phone will not play it here: hand the file to another app.
  const openOther = async () => {
    if (opening) return;
    setOpening(true);
    try { const u = await plainCopy(f.uri, f.name); holdLock(); await Sharing.shareAsync(u, { mimeType: f.mime }); } catch {} finally { setOpening(false); }
  };
  return (
    <View style={{ gap: 6 }}>
      <Pressable accessibilityRole="button" onPress={press}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 160 }}>
        <Text style={{ color, fontSize: 22 }}>{p.busy || view === 'loading' ? '…' : p.failed || stuck ? '!' : view === 'playing' ? '❚❚' : '▶'}</Text>
        <View><Text style={{ color, fontWeight: '600' }}>{t.voiceMsg}</Text><Text style={{ color, opacity: 0.7, fontSize: 12 }}>{f.dur ? `${f.dur}s` : fmtSize(f.size)}</Text></View>
      </Pressable>
      {stuck ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color, fontSize: 12 }}>{t.voiceFail}{st.error ? ` (${String(st.error).slice(0, 80)})` : ''}</Text>
          <Btn title={opening ? '…' : t.openFile} kind="secondary" onPress={openOther} />
        </View>
      ) : null}
    </View>
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
  // Restored from a backup: the message is there, the file is not (backups hold no files).
  if (!f.uri) return <View><Text style={{ color, fontWeight: '600' }}>{f.name}</Text><Text style={{ color, opacity: 0.7, fontSize: 12 }}>{t.fileGone}</Text></View>;
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
