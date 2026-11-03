import { setAudioModeAsync } from 'expo-audio';

// How the app plays voice messages, set before every playback and after every recording.
//
// `interruptionMode: 'mixWithOthers'` matters on Android: it means the app does not ask for audio focus. Without it the
// module asks for transient focus, and when the phone refuses (another app or an earlier call still holds it) play() does
// nothing at all and gives no error. That is what made recorded voice messages silent on a OnePlus 13 while they played on
// an older phone. The price is that a voice message plays on top of other music instead of pausing it.
// `playsInSilentMode: true` keeps it playing when the phone's ringer is on silent or vibrate (the OnePlus has a slider for it).
export const playbackMode = () =>
  setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
