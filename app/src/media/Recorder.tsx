import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useApp } from '../store';
import { Btn } from '../ui';

export type Recorded = { uri: string; name: string; mime: string; dur: number };

// Voice message: record, stop and send.
export function VoiceRecorder({ onDone, onCancel }: { onDone: (r: Recorded) => void; onCancel: () => void }) {
  const { theme, t } = useApp();
  const rec = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState('');
  const started = useRef(0);
  useEffect(() => {
    let alive = true, iv: any;
    (async () => {
      const p = await requestRecordingPermissionsAsync();
      if (!p.granted) { setErr(t.micDenied); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await rec.prepareToRecordAsync();
      if (!alive) return;
      rec.record(); started.current = Date.now();
      iv = setInterval(() => setSecs(Math.floor((Date.now() - started.current) / 1000)), 250);
    })().catch(() => setErr(t.micDenied));
    return () => { alive = false; clearInterval(iv); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const stop = async () => {
    const dur = Math.max(1, Math.round((Date.now() - started.current) / 1000));
    try { await rec.stop(); } catch {}
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    if (rec.uri) onDone({ uri: rec.uri, name: `voice-${Date.now()}.m4a`, mime: 'audio/mp4', dur });
    else onCancel();
  };
  return (
    <View style={{ gap: 10, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card }}>
      <Text style={{ color: err ? theme.danger : theme.ink, fontWeight: '600' }}>{err || `${t.recording} ${secs}s`}</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Btn title={t.cancelRec} kind="secondary" onPress={async () => { try { await rec.stop(); } catch {} onCancel(); }} /></View>
        {err ? null : <View style={{ flex: 1 }}><Btn title={t.stopSend} onPress={stop} /></View>}
      </View>
    </View>
  );
}

// Video message: full-screen camera, max 60 seconds.
export function VideoRecorder({ onDone, onCancel }: { onDone: (r: Recorded) => void; onCancel: () => void }) {
  const { theme, t } = useApp();
  const cam = useRef<CameraView>(null);
  const [cp, askCam] = useCameraPermissions();
  const [mp, askMic] = useMicrophonePermissions();
  const [on, setOn] = useState(false);
  const [secs, setSecs] = useState(0);
  const t0 = useRef(0);
  useEffect(() => { if (cp && !cp.granted) askCam(); if (mp && !mp.granted) askMic(); }, [cp, mp]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!on) return; const iv = setInterval(() => setSecs(Math.floor((Date.now() - t0.current) / 1000)), 250); return () => clearInterval(iv); }, [on]);
  const start = async () => {
    if (!cam.current) return;
    setOn(true); t0.current = Date.now();
    try {
      const r = await cam.current.recordAsync({ maxDuration: 60 });
      const dur = Math.max(1, Math.round((Date.now() - t0.current) / 1000));
      setOn(false);
      if (r?.uri) onDone({ uri: r.uri, name: `video-${Date.now()}.mp4`, mime: 'video/mp4', dur }); else onCancel();
    } catch { setOn(false); onCancel(); }
  };
  if (!cp?.granted || !mp?.granted) return <View style={{ padding: 16 }}><Text style={{ color: theme.danger }}>{t.camDenied}</Text><Btn title={t.cancelRec} kind="secondary" onPress={onCancel} /></View>;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ height: 320, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' }}>
        <CameraView ref={cam} style={{ flex: 1 }} mode="video" facing="front" />
      </View>
      <Text style={{ color: theme.ink, fontWeight: '600' }}>{on ? `${t.recording} ${secs}s` : t.recVideo}</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Btn title={t.cancelRec} kind="secondary" onPress={() => { if (on) cam.current?.stopRecording(); onCancel(); }} /></View>
        <View style={{ flex: 1 }}>{on ? <Btn title={t.stopSend} onPress={() => cam.current?.stopRecording()} /> : <Btn title={t.recVideo} onPress={start} />}</View>
      </View>
    </View>
  );
}
