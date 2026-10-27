import assert from 'node:assert/strict';
import { Session } from '../src/core/session';

const ea = Session.newEphemeral(), eb = Session.newEphemeral();
const a = new Session(ea.secret, eb.pub, true), b = new Session(eb.secret, ea.pub, false);
const f1 = a.encrypt({ t: 'x', n: 1 }), f2 = a.encrypt({ t: 'x', n: 2 });
assert.deepEqual(b.decrypt(f1), { t: 'x', n: 1 });
assert.deepEqual(b.decrypt(f2), { t: 'x', n: 2 });
assert.equal(b.decrypt(f1), null, 'replay avvisas');
assert.deepEqual(a.decrypt(b.encrypt({ back: true })), { back: true });
// förfalskad ram förstör inte läget
const f3 = a.encrypt({ n: 3 });
assert.equal(b.decrypt({ ...f3, c: f3.c.slice(0, -4) + 'AAAA' }), null);
assert.deepEqual(b.decrypt(f3), { n: 3 });
// hopp framåt (förlorade ramar) fungerar
a.encrypt({ lost: 1 }); const f5 = a.encrypt({ n: 5 });
assert.deepEqual(b.decrypt(f5), { n: 5 });
// ny session = nya nycklar; gammal ram går inte att läsa
const ec = Session.newEphemeral();
const b2 = new Session(ec.secret, ea.pub, false);
assert.equal(b2.decrypt(f1), null);
// efter close() går inget att läsa/skriva
b.close(); assert.equal(b.decrypt(a.encrypt({ n: 6 })), null);
console.log('session: alla tester OK');
