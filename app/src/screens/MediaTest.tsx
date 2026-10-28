import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../ui';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioRecorder } from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useApp } from '../store';
import { mediaDevices, rtc } from '../net/rtc';
import { Btn, Card, Header, Screen } from '../ui';

export default function MediaTest({ onBack }: { onBack: () => void }) {
  const { theme, t } = useApp();
  const rec = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const [uri, setUri] = useState<string | null>(null);
  const player = useAudioPlayer(uri);
  const [level, setLevel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [cam, setCam] = useState(false);
  const [cp, askCam] = useCameraPermissions();
  const [rtcMsg, setRtcMsg] = useState('');
  const iv = useRef<any>(undefined);
  useEffect(() => () => clearInterval(iv.current), []);

  const voice = async () => {
    setMsg(''); setBusy(true); setUri(null);
    try {
      const p = await requestRecordingPermissionsAsync();
      if (!p.granted) { setMsg(t.micDenied); setBusy(false); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await rec.prepareToRecordAsync(); rec.record();
      let peak = -160;
      iv.current = setInterval(() => { const m = rec.getStatus().metering; if (typeof m === 'number') { peak = Math.max(peak, m); setLevel(Math.max(0, Math.min(1, (m + 60) / 60))); } }, 100);
      await new Promise(r => setTimeout(r, 3000));
      clearInterval(iv.current); await rec.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      setUri(rec.uri); setMsg(peak > -45 ? t.testOk : t.testNoMedia);
    } catch { setMsg(t.testNoMedia); }
    setLevel(0); setBusy(false);
  };
  useEffect(() => { if (uri) { try { player.seekTo(0); player.play(); } catch {} } }, [uri]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tests the WebRTC media stack itself (the same one used in calls).
  const webrtc = async () => {
    if (!mediaDevices || !rtc) { setRtcMsg(t.noCalls); return; }
    try {
      const s = await mediaDevices.getUserMedia({ audio: true, video: true });
      setRtcMsg(`${t.testOk}: ${s.getAudioTracks().length} audio, ${s.getVideoTracks().length} video`);
      s.getTracks().forEach((x: any) => x.stop());
    } catch { setRtcMsg(t.testNoMedia); }
  };

  return (
    <Screen>
      <Header title={t.mediaTest} sub={t.mediaTestSub} onBack={onBack} />
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 12 }}>
        <Card>
          <Text style={{ fontWeight: '600', color: theme.ink }}>{t.micLevel}</Text>
          <View style={{ height: 14, borderRadius: 7, backgroundColor: theme.chip, overflow: 'hidden' }}><View style={{ height: 14, width: `${Math.round(level * 100)}%`, backgroundColor: theme.good }} /></View>
          <Text style={{ fontSize: 13, color: theme.muted }}>{t.testHint}</Text>
          <Btn title={busy ? t.recording : t.startTest} onPress={voice} />
          {msg ? <Text style={{ color: msg === t.testOk ? theme.good : theme.danger, fontWeight: '600' }}>{msg}</Text> : null}
        </Card>
        <Card>
          <Btn title={cam ? t.stopTest : t.testCam} kind="secondary" onPress={async () => { if (!cp?.granted) await askCam(); setCam(c => !c); }} />
          {cam && cp?.granted ? <View style={{ height: 260, borderRadius: 16, overflow: 'hidden' }}><CameraView style={{ flex: 1 }} facing="front" /></View> : null}
        </Card>
        <Card>
          <Btn title="WebRTC" kind="secondary" onPress={webrtc} />
          {rtcMsg ? <Text style={{ color: theme.ink }}>{rtcMsg}</Text> : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}
