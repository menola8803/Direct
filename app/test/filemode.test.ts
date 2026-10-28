import assert from 'node:assert/strict';
import { DEFAULT_FILE_MODE, FILE_MODES, normFileMode } from '../src/core/filemode';
import { migrateSaved } from '../src/core/migrate';

assert.equal(DEFAULT_FILE_MODE, 'visible', 'default: as before 0.13.0');
assert.deepEqual(FILE_MODES, ['visible', 'private']);
assert.equal(normFileMode('private'), 'private');
assert.equal(normFileMode('visible'), 'visible');
for (const junk of [undefined, null, 'x', 1, true, 'PRIVATE', {}]) assert.equal(normFileMode(junk), 'visible', `junk ${String(junk)} -> default`);
assert.equal(migrateSaved({}).fileMode, undefined, 'older state: the app default applies');
assert.equal(migrateSaved({ fileMode: 'private' }).fileMode, 'private');
assert.equal(migrateSaved({ fileMode: 'weird' }).fileMode, 'visible', 'a damaged value is repaired, never silently "private"');
console.log('filemode.test.ts OK');
