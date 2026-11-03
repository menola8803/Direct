// What a voice message bubble should show, decided from what the audio player reports. Plain TypeScript, so it can be tested in Node.
//
// Why this exists: on some phones (seen on a OnePlus 13) pressing play did nothing and said nothing. The audio module quietly
// refuses to start when Android does not grant audio focus (or the phone is in silent mode and the app has not said that it
// may play anyway), and it reports no error. So the bubble cannot just trust that play() worked: it waits for the audio to be
// ready, starts it, and if nothing starts within a few seconds it says so and offers to open the file in another app.

export type VoiceView = 'ready' | 'loading' | 'playing' | 'stuck';
export type VoiceFacts = {
  requested: boolean;     // the person pressed play and nothing has started yet
  loaded: boolean;        // the player has the audio ready
  playing: boolean;
  error: string | null;   // the player's own error message, if it has one
  waitedMs: number;       // how long ago play was pressed
};

export const WAIT_MS = 4000; // loading plus starting, from the press, on a local file

export function voiceView(f: VoiceFacts): VoiceView {
  if (f.playing) return 'playing';
  if (!f.requested) return 'ready';
  if (f.error) return 'stuck';
  return f.waitedMs > WAIT_MS ? 'stuck' : 'loading';
}

// Play from the start when the clip has been played to its end.
export const atEnd = (s: { didJustFinish?: boolean; currentTime?: number; duration?: number }) =>
  !!s.didJustFinish || ((s.duration ?? 0) > 0 && (s.currentTime ?? 0) >= (s.duration ?? 0) - 0.05);
