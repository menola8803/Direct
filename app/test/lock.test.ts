import assert from 'node:assert/strict';
import { DEFAULT_LOCK_DELAY, LOCK_DELAYS, normLockDelay, shouldLock } from '../src/core/lock';
import { migrateSaved } from '../src/core/migrate';

assert.deepEqual([...LOCK_DELAYS], [0, 60, 300]);
assert.equal(DEFAULT_LOCK_DELAY, 60);
assert.ok((LOCK_DELAYS as readonly number[]).includes(DEFAULT_LOCK_DELAY));
assert.equal(normLockDelay(0), 0, 'immediately is a valid choice');
assert.equal(normLockDelay(300), 300);
assert.equal(normLockDelay(undefined), 60);
assert.equal(normLockDelay('x'), 60);
assert.equal(normLockDelay(45), 60, 'not one of the choices: default');
assert.equal(normLockDelay(-1), 60);

const t0 = 1_000_000;
const base = { on: true, left: t0, delay: 60 };
assert.equal(shouldLock({ ...base, now: t0 + 59_999 }), false, 'back within the delay');
assert.equal(shouldLock({ ...base, now: t0 + 60_000 }), true, 'exactly at the delay');
assert.equal(shouldLock({ ...base, now: t0 + 3_600_000 }), true, 'long away');
assert.equal(shouldLock({ ...base, delay: 0, now: t0 }), true, 'immediately: any absence locks');
assert.equal(shouldLock({ ...base, delay: 300, now: t0 + 299_000 }), false);
assert.equal(shouldLock({ ...base, delay: 300, now: t0 + 300_000 }), true);
assert.equal(shouldLock({ ...base, on: false, now: t0 + 9e9 }), false, 'lock off: never');
assert.equal(shouldLock({ ...base, left: null, now: t0 + 9e9 }), false, 'never left: nothing to lock');
assert.equal(shouldLock({ ...base, held: true, now: t0 + 9e9 }), false, 'left for a file picker: not counted');
assert.equal(shouldLock({ ...base, delay: 'junk', now: t0 + 61_000 }), true, 'a junk delay behaves as 1 minute');
assert.equal(shouldLock({ ...base, delay: 'junk', now: t0 + 59_000 }), false);

// saved settings
assert.equal(migrateSaved({}).lockOn, undefined, 'older state: the app default applies (off)');
assert.equal(migrateSaved({ lockOn: true, lockDelay: 300 }).lockDelay, 300);
assert.equal(migrateSaved({ lockOn: true, lockDelay: 77 }).lockDelay, 60, 'a damaged delay is repaired');
assert.equal(migrateSaved({ lockOn: 'yes' }).lockOn, false, 'only true counts');

console.log('lock.test.ts OK');
