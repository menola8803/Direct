import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../ui';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioRecorder } from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useApp } from '../store';
import { mediaDevices, rtc } from '../net/rtc';
import { Card, Header, Screen } from '../ui';
import { TestBtn, useTestBox } from '../testkit';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

// Three tests of the media stack. Tap a button for help, hold it to run the test (see testkit).
export default function MediaTest({ onBack }: { onBack: () => void }) {
  const { theme, t } = useApp();
  const box = useTestBox();
  const rec = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const [uri, setUri] = useState<string | null>(null);
  const player = useAudioPlayer(uri);
  const [level, setLevel] = useState(0);
  const [cam, setCam] = useState(false);
  const [cp, askCam] = useCameraPermissions();
  const camReady = useRef<(() => void) | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const iv = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  useEffect(() => () => { clearInterval(iv.current); timers.current.forEach(clearTimeout); }, []);
  useEffect(() => { if (uri) { try { player.seekTo(0); player.play(); } catch {} } }, [uri]); // eslint-disable-line react-hooks/exhaustive-deps

  // Records 3 seconds and plays them back. OK if the microphone picked up sound.
  const mic = () => box.run(t.micLevel, async () => {
    setUri(null);
    try {
      const p = await requestRecordingPermissionsAsync();
      if (!p.granted) return { ok: false, detail: t.micDenied };
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await rec.prepareToRecordAsync(); rec.record();
      let peak = -160;
      iv.current = setInterval(() => { const m = rec.getStatus().metering; if (typeof m === 'number') { peak = Math.max(peak, m); setLevel(Math.max(0, Math.min(1, (m + 60) / 60))); } }, 100);
      await wait(3000);
      clearInterval(iv.current); await rec.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      setUri(rec.uri);
      return peak > -45 ? { ok: true, detail: t.testOk } : { ok: false, detail: t.testNoMedia };
    } catch { return { ok: false, detail: t.testNoMedia }; }
    finally { clearInterval(iv.current); setLevel(0); }
  });

  // Shows the camera for a few seconds. OK as soon as it reports ready.
  const camera = () => box.run(t.testCam, async () => {
    const g = cp?.granted ? cp : await askCam();
    if (!g?.granted) return { ok: false, detail: t.camDenied };
    if (cam) { setCam(false); await wait(300); }
    const ready = new Promise<boolean>(res => {
      const to = setTimeout(() => res(false), 4000); timers.current.push(to);
      camReady.current = () => { clearTimeout(to); res(true); };
    });
    setCam(true);
    const ok = await ready;
    timers.current.push(setTimeout(() => setCam(false), ok ? 5000 : 0));
    return ok ? { ok: true, detail: t.testOk } : { ok: false, detail: t.testNoMedia };
  });

  // Tests the WebRTC media stack itself (the same one used in calls).
  const webrtc = () => box.run('WebRTC', async () => {
    if (!mediaDevices || !rtc) return { ok: false, detail: t.noCalls };
    try {
      const s = await mediaDevices.getUserMedia({ audio: true, video: true });
      const a = s.getAudioTracks().length, v = s.getVideoTracks().length;
      s.getTracks().forEach((x: any) => x.stop());
      return { ok: a > 0 && v > 0, detail: `🎙 ${a} · 🎥 ${v}` };
    } catch { return { ok: false, detail: t.testNoMedia }; }
  });

  return (
    <Screen>
      <Header title={t.mediaTest} sub={t.mediaTestSub} onBack={onBack} />
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 12 }}>
        <Text style={{ fontSize: 12, color: theme.muted }}>{t.holdHintBtn}</Text>
        <Card>
          <Text style={{ fontWeight: '600', color: theme.ink }}>{t.micLevel}</Text>
          <View style={{ height: 14, borderRadius: 7, backgroundColor: theme.chip, overflow: 'hidden' }}><View style={{ height: 14, width: `${Math.round(level * 100)}%`, backgroundColor: theme.good }} /></View>
          <Text style={{ fontSize: 13, color: theme.muted }}>{t.testHint}</Text>
          <TestBtn kind="primary" title={t.micHelpTitle} onHelp={() => box.help(t.micHelpTitle, t.micHelp)} onTest={mic} />
        </Card>
        <Card>
          <TestBtn title={t.testCam} onHelp={() => box.help(t.camHelpTitle, t.camHelp)} onTest={camera} />
          {cam && cp?.granted ? <View style={{ height: 260, borderRadius: 16, overflow: 'hidden' }}><CameraView style={{ flex: 1 }} facing="front" onCameraReady={() => camReady.current?.()} /></View> : null}
        </Card>
        <Card>
          <TestBtn title={t.testWebrtc} onHelp={() => box.help(t.rtcHelpTitle, t.rtcHelp)} onTest={webrtc} />
        </Card>
      </ScrollView>
      {box.node}
    </Screen>
  );
}
