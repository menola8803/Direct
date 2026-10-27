import assert from 'node:assert/strict';
import { CallController, CallView } from '../src/net/calls';
import { Plain } from '../src/core/protocol';

// Several phones in a "network" with fake links: everything is sent directly between the controllers.
const names = ['a', 'b', 'c', 'd', 'e'];
const sign = (n: string) => 'S' + n;
const ctl: Record<string, CallController> = {};
const views: Record<string, CallView> = {};
const locals: Record<string, Record<string, any>> = {};
const stopped: string[] = []; let n = 0;
for (const me of names) {
  locals[me] = {};
  ctl[me] = new CallController({
    mySign: sign(me),
    contactBySign: s => ({ id: s.slice(1), signPub: s }),
    contactById: id => ({ id, signPub: sign(id) }),
    send: (id, p: Plain) => { setTimeout(() => ctl[id].handle(me, p), 0); return true; },
    connect: () => {}, isOpen: () => true,
    getMedia: async v => ({ me, v, getAudioTracks: () => [{ enabled: true }], getVideoTracks: () => [{ enabled: true }] }),
    stopMedia: () => { stopped.push(me); },
    setLocal: (id, s) => { locals[me][id] = s; },
    onChange: v => { views[me] = v; }, newId: () => 'call' + (n++), ringMs: 300,
  });
}
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));

(async () => {
  // 1:1
  assert.equal(await ctl.a.start(['b'], true), true);
  await tick();
  assert.equal(views.b.status, 'incoming');
  assert.equal(await ctl.b.accept(), true);
  await tick();
  assert.equal(views.a.status, 'active'); assert.equal(views.a.peers.b, 'in');
  assert.ok(locals.a.b && locals.b.a, 'both send their stream to each other');
  ctl.a.end(); await tick();
  assert.equal(views.a.status, 'idle'); assert.equal(views.b.status, 'idle');
  assert.equal(locals.b.a, null, 'the stream is released');

  // Conference a, b, c, d (4 with video is the max); e cannot be added (5)
  assert.equal(await ctl.a.start(['b', 'c', 'd', 'e'], true), false, 'max 4 med video');
  assert.equal(await ctl.a.start(['b', 'c', 'd'], true), true);
  await tick();
  for (const n of ['b', 'c', 'd']) assert.equal(views[n].status, 'incoming');
  await ctl.b.accept(); await ctl.c.accept(); ctl.d.decline(); await tick(60);
  assert.equal(views.a.peers.d, 'declined');
  assert.equal(views.a.peers.b, 'in'); assert.equal(views.a.peers.c, 'in');
  // b and c see each other too (mesh)
  assert.equal(views.b.peers.c, 'in'); assert.equal(views.c.peers.b, 'in');
  assert.ok(locals.b.c && locals.c.b);
  // a leaves: b and c continue
  ctl.a.end(); await tick();
  assert.equal(views.b.status, 'active'); assert.equal(views.c.status, 'active');
  await tick(400); // d never answered c: pending connection is dropped
  ctl.b.end(); await tick();
  assert.equal(views.c.status, 'idle', 'sista personen kvar avslutar');

  // upptagen: andra invite avvisas
  await ctl.a.start(['b'], false); await tick();
  await ctl.c.start(['b'], false); await tick();
  assert.equal(views.c.status, 'idle', 'upptagen: samtalet avslutas direkt');
  ctl.a.end(); await tick();

  // nobody answers: the ringing times out
  await ctl.a.start(['e'], false); await tick(400);
  assert.equal(views.a.status, 'idle'); assert.equal(views.e.status, 'idle');
  // mute
  await ctl.a.start(['b'], false); await tick(); await ctl.b.accept(); await tick();
  ctl.a.toggleMute(); assert.equal(views.a.muted, true);
  ctl.b.end(); await tick();
  console.log('calls: all tests OK');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
