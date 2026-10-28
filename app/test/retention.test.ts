import assert from 'node:assert/strict';
import { DEFAULT_RETENTION, MAX_RETENTION, RETENTION_DAYS, cutoffFor, folderName, folderTag, normRetention, pruneMessages, sameUri, uniqueName } from '../src/core/retention';
import { migrateSaved } from '../src/core/migrate';

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 28, 12);

// ---- normRetention: default two weeks, never more than three months
assert.equal(DEFAULT_RETENTION, 14);
assert.equal(MAX_RETENTION, 90);
assert.equal(normRetention(undefined), 14, 'missing -> default');
assert.equal(normRetention('abc'), 14, 'junk -> default');
assert.equal(normRetention(0), 14);
assert.equal(normRetention(-5), 14);
assert.equal(normRetention(7), 7);
assert.equal(normRetention(90), 90);
assert.equal(normRetention(400), 90, 'capped at 3 months');
assert.equal(normRetention(Infinity), 14);
assert.ok(RETENTION_DAYS.every(d => d >= 1 && d <= MAX_RETENTION), 'every choice is allowed');
assert.ok(RETENTION_DAYS.includes(DEFAULT_RETENTION as any), 'the default is one of the choices');
assert.equal(cutoffFor(14, now), now - 14 * DAY);

// ---- pruneMessages
const msgs = {
  a: [
    { id: '1', at: now - 20 * DAY, text: 'old' },
    { id: '2', at: now - 13 * DAY, text: 'young' },
    { id: '3', at: now - 15 * DAY, text: 'old file', file: { uri: 'file:///x/old.jpg' } },
    { id: '4', at: now - 1 * DAY, text: 'new file', file: { uri: 'file:///x/new.jpg' } },
  ],
  b: [{ id: '5', at: now - 40 * DAY, text: 'all old', file: { uri: 'file:///y/b.m4a' } }],
  c: [{ id: '6', at: now - 2 * DAY, text: 'fresh' }],
};
let r = pruneMessages(msgs, 14, now);
assert.equal(r.changed, true);
assert.deepEqual(r.messages.a.map(m => m.id), ['2', '4'], 'older than 14 days dropped, newer kept');
assert.equal(r.messages.b, undefined, 'a conversation with nothing left disappears from the list');
assert.deepEqual(r.messages.c.map(m => m.id), ['6']);
assert.deepEqual(r.removedUris.sort(), ['file:///x/old.jpg', 'file:///y/b.m4a'], 'attachments of removed messages are reported, others are not');
assert.equal(msgs.a.length, 4, 'input is not modified');

r = pruneMessages(msgs, 90, now);
assert.equal(r.changed, false, 'nothing is older than 90 days');
assert.equal(r.messages, msgs, 'same object when nothing changed');
assert.deepEqual(r.removedUris, []);

r = pruneMessages(msgs, 7, now);
assert.deepEqual(r.messages.a.map(m => m.id), ['4']);
r = pruneMessages(msgs, 1000, now);
assert.equal(r.changed, false, 'a too large value is capped at 90 days, not unlimited');
r = pruneMessages(msgs, 'junk', now);
assert.deepEqual(r.messages.a.map(m => m.id), ['2', '4'], 'junk setting behaves as the default');

const edge = { x: [{ id: 'e', at: now - 14 * DAY, text: 'exactly 14 days' }] };
assert.equal(pruneMessages(edge, 14, now).changed, false, 'exactly on the limit is kept');
assert.equal(pruneMessages({}, 14, now).changed, false, 'empty input');
assert.deepEqual(pruneMessages({ z: [] as any[] }, 14, now).messages, { z: [] }, 'an empty list is left alone');

// ---- folder names
assert.equal(folderName('Anna', 'a1b2c3d4e5f60718'), 'Anna-a1b2c3d4');
assert.equal(folderName('', 'a1b2c3d4e5f60718'), 'kontakt-a1b2c3d4', 'no name');
assert.equal(folderName('../../etc/passwd', 'a1b2c3d4e5f60718'), '_.._etc_passwd-a1b2c3d4', 'path characters cannot escape');
assert.ok(!folderName('../../etc/passwd', 'a1b2c3d4e5f60718').includes('/'), 'no slash in a folder name');
assert.ok(!folderName('..', 'abc').startsWith('.'), 'no leading dot');
assert.ok(folderName('A'.repeat(200), 'a1b2c3d4e5f60718').length <= 49, 'long names are cut');
assert.equal(folderName('Anna', 'a1b2c3d4e5f60718').endsWith(folderTag('a1b2c3d4e5f60718')), true, 'the folder is found by the id suffix');
assert.notEqual(folderName('Anna', 'aaaaaaaa11111111'), folderName('Anna', 'bbbbbbbb22222222'), 'same name, different contacts, different folders');

// ---- uniqueName / sameUri
const used = new Set(['photo.jpg', 'photo (2).jpg', 'notes', 'notes (2)']);
assert.equal(uniqueName(n => used.has(n), 'new.png'), 'new.png', 'free name is kept');
assert.equal(uniqueName(n => used.has(n), 'photo.jpg'), 'photo (3).jpg', 'counts up until a name is free');
assert.equal(uniqueName(n => used.has(n), 'notes'), 'notes (3)', 'no extension');
assert.equal(uniqueName(n => n === '.hidden', '.hidden'), '.hidden (2)', 'a leading dot is not an extension');
assert.ok(uniqueName(() => true, 'a.txt').endsWith('-a.txt'), 'gives up on endless clashes instead of looping');
assert.equal(sameUri('file:///a/b%20c.jpg', 'file:///a/b c.jpg'), true);
assert.equal(sameUri('file:///a/b.jpg', 'file:///a/c.jpg'), false);
assert.equal(sameUri('file:///a/%E0%A4%A', 'file:///a/%E0%A4%A'), true, 'broken escape does not throw');

// ---- saved settings from older versions
assert.equal(migrateSaved({ themeName: 'dark' }).retentionDays, undefined, 'older state: the app default applies (14 days)');
assert.equal(migrateSaved({ retentionDays: 500 }).retentionDays, 90, 'saved value is capped');
assert.equal(migrateSaved({ retentionDays: 'x' }).retentionDays, 14);
assert.equal(migrateSaved({ retentionDays: 30 }).retentionDays, 30);

console.log('retention.test.ts OK');
