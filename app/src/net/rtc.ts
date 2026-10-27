// WebRTC finns bara i den installerade appen (APK), inte i Expo Go. Laddas därför försiktigt.
import type { RtcApi } from './peers';

let api: RtcApi | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const w = require('react-native-webrtc');
  if (w?.RTCPeerConnection) api = { RTCPeerConnection: w.RTCPeerConnection, RTCIceCandidate: w.RTCIceCandidate, RTCSessionDescription: w.RTCSessionDescription };
} catch { api = null; }

export const rtc = api;
