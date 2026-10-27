// WebRTC finns bara i den installerade appen (APK), inte i Expo Go. Laddas därför försiktigt.
import type { RtcApi } from './peers';

let api: RtcApi | null = null;
let media: any = null;
let view: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const w = require('react-native-webrtc');
  if (w?.RTCPeerConnection) api = { RTCPeerConnection: w.RTCPeerConnection, RTCIceCandidate: w.RTCIceCandidate, RTCSessionDescription: w.RTCSessionDescription };
  media = w?.mediaDevices ?? null;
  view = w?.RTCView ?? null;
} catch { api = null; }

export const rtc = api;
export const mediaDevices: { getUserMedia: (c: any) => Promise<any> } | null = media;
export const RTCView: any = view;
