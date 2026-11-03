// The voice message bubble: what it shows from what the audio player says.
import assert from 'node:assert/strict';
import { VoiceFacts, WAIT_MS, atEnd, voiceView } from '../src/core/voice';

const f = (o: Partial<VoiceFacts> = {}): VoiceFacts => ({ requested: false, loaded: true, playing: false, error: null, waitedMs: 0, ...o });
const is = (x: Partial<VoiceFacts>, v: string, what: string) => assert.equal(voiceView(f(x)), v, what);

is({}, 'ready', 'nothing pressed');
is({ requested: true, loaded: false, waitedMs: 300 }, 'loading', 'pressed, still loading');
is({ requested: true, waitedMs: 300 }, 'loading', 'pressed, loaded, starting');
is({ playing: true }, 'playing', 'playing');
is({ playing: true, requested: true, waitedMs: 9000 }, 'playing', 'playing wins over a slow start');
is({ requested: true, waitedMs: WAIT_MS - 1 }, 'loading', 'not yet given up');
is({ requested: true, waitedMs: WAIT_MS + 1 }, 'stuck', 'pressed long ago and nothing started: the module refused without saying');
is({ requested: true, loaded: false, waitedMs: WAIT_MS + 1 }, 'stuck', 'never got loaded');
is({ requested: true, error: 'Source error', waitedMs: 100 }, 'stuck', 'the player reports an error: say so at once');
is({ error: 'old error' }, 'ready', 'an old error does not matter when nobody asks for play');
is({ requested: false, waitedMs: 99999 }, 'ready', 'finished and idle');

assert.equal(atEnd({ didJustFinish: true }), true);
assert.equal(atEnd({ currentTime: 5, duration: 5 }), true);
assert.equal(atEnd({ currentTime: 4.97, duration: 5 }), true, 'a hair from the end counts as the end');
assert.equal(atEnd({ currentTime: 2, duration: 5 }), false);
assert.equal(atEnd({ currentTime: 0, duration: 0 }), false, 'duration not known yet: not at the end');
assert.equal(atEnd({}), false);

console.log('voice.test.ts OK');
