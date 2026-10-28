// Runs src/files.ts against a stand-in for expo-file-system that works on a temporary folder, so the rules for
// Download/Direct, retention and wiping are tested without a phone.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Module from 'node:module';

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'direct-files-'));
const real = (uri: string) => path.join(BASE, uri.replace(/^file:\/\//, ''));
const joinUri = (parts: any[]) => parts.map(p => (typeof p === 'string' ? p : p.uri)).reduce((a, b) => `${a.replace(/\/+$/, '')}/${b.replace(/^\/+/, '')}`);

// Behaves like Android + expo-file-system: the app's own folders are always writable, anything else (shared storage)
// only with "all files access", and the write check is made on the path itself, so it fails for a path that does not exist
// yet (File.canWrite() is false for it). Creating inside an existing folder (createDirectory/createFile) checks the folder.
let granted = false;
const INTERNAL = ['/data/user/0/app/files', '/data/user/0/app/cache'];
const internal = (uri: string) => INTERNAL.some(p => uri.replace(/^file:\/\//, '').startsWith(p));
const canRead = (uri: string) => internal(uri) || granted;
const canWrite = (uri: string) => internal(uri) || (granted && fs.existsSync(real(uri)));
const needWrite = (uri: string) => { if (!canWrite(uri)) throw new Error(`InvalidPermission: write ${uri}`); };
const needRead = (uri: string) => { if (!canRead(uri)) throw new Error(`InvalidPermission: read ${uri}`); };

class P {
  uri: string;
  constructor(...parts: any[]) { this.uri = joinUri(parts); }
  get name() { return this.uri.replace(/\/+$/, '').split('/').pop()!; }
  get exists() { return canRead(this.uri) && fs.existsSync(real(this.uri)); }
  delete() { needWrite(this.uri); if (!fs.existsSync(real(this.uri))) throw new Error('missing'); fs.rmSync(real(this.uri), { recursive: true }); }
}
class Directory extends P {
  create(o: any = {}) {
    needWrite(this.uri);
    if (this.exists) { if (o.idempotent) return; throw new Error('exists'); }
    fs.mkdirSync(real(this.uri), { recursive: !!o.intermediates });
  }
  createDirectory(name: string) { needWrite(this.uri); fs.mkdirSync(path.join(real(this.uri), name), { recursive: false }); }
  createFile(name: string, _mime: string | null) { needWrite(this.uri); const f = path.join(real(this.uri), name); if (!fs.existsSync(f)) fs.writeFileSync(f, ''); }
  list() { needRead(this.uri); return fs.readdirSync(real(this.uri)).map(n => (fs.statSync(path.join(real(this.uri), n)).isDirectory() ? new Directory(this, n) : new File(this, n))); }
  get size() { return this.exists ? this.list().reduce((n: number, x: any) => n + x.size, 0) : null; }
}
class File extends P {
  create(o: any = {}) { needWrite(this.uri); if (this.exists && !o.overwrite) throw new Error('exists'); fs.writeFileSync(real(this.uri), ''); }
  get size() { return this.exists ? fs.statSync(real(this.uri)).size : 0; }
  get modificationTime() { return this.exists ? fs.statSync(real(this.uri)).mtimeMs : null; }
  open() { needWrite(this.uri); let off = 0; const fd = fs.openSync(real(this.uri), 'r+'); return { get offset() { return off; }, set offset(v: number) { off = v; }, writeBytes: async (b: Uint8Array) => { fs.writeSync(fd, b, 0, b.length, off); off += b.length; }, readBytes: (n: number) => { const b = new Uint8Array(n); fs.readSync(fd, b, 0, n, off); return b; }, close: () => fs.closeSync(fd) }; }
  async copy(d: File, o: any = {}) { needRead(this.uri); needWrite(d.uri); if (fs.existsSync(real(d.uri)) && !o.overwrite) throw new Error('destination exists'); fs.copyFileSync(real(this.uri), real(d.uri)); }
}
const mock = { Directory, File, FileMode: { ReadOnly: 0, ReadWrite: 1 }, Paths: { document: new Directory('file:///data/user/0/app/files/'), cache: new Directory('file:///data/user/0/app/cache/') } };
const orig = (Module as any)._load;
(Module as any)._load = function (req: string, ...a: any[]) { return req === 'expo-file-system' ? mock : orig.call(this, req, ...a); };
const files = require('../src/files');

const PUB = 'file:///storage/emulated/0/Download/Direct';
const cid = 'a1b2c3d4e5f60718', other = 'ffeeddcc99887766';
const meta = (id: string, name: string) => ({ id, name, mime: 'image/jpeg', size: 3, kind: 'file', at: Date.now() });
const receive = async (id: string, who: string, whoName: string, name: string) => {
  const sink = await files.makeSink(who, whoName)(meta(id, name));
  await sink.write(new Uint8Array([1, 2, 3])); return sink.finish() as Promise<string>;
};
const exists = (uri: string) => fs.existsSync(real(uri));

(async () => {
  fs.mkdirSync(real('file:///data/user/0/app/cache'), { recursive: true });
  fs.mkdirSync(real('file:///data/user/0/app/files'), { recursive: true });

  // ---- without all-files access Download/Direct cannot be created, nothing breaks, files go to the private folder
  assert.equal(files.probePublic(), false, 'no permission: the folder is not usable');
  assert.equal(fs.existsSync(real(PUB)), false, 'and it is not created');
  assert.equal(files.usingPublic(), false);
  let u = await receive('m1', cid, 'Anna', 'old.txt');
  assert.ok(u.includes('/data/user/0/app/files/direct/'), 'private folder before the public one is usable');
  assert.ok(exists(u));

  // ---- the user turns on "all files access": Download/Direct is created
  granted = true;
  fs.mkdirSync(real('file:///storage/emulated/0/Download'), { recursive: true }); // Android always has this folder
  assert.equal(files.probePublic(), true, 'folder is created through the existing Download folder');
  assert.equal(files.usingPublic(), true);
  assert.ok(exists(`${PUB}/.nomedia`), '.nomedia keeps media out of the Gallery');
  assert.equal(files.hasPublicFiles(), false, 'only .nomedia: no files yet');

  const a1 = await receive('m2', cid, 'Anna', 'photo.jpg');
  const a2 = await receive('m3', cid, 'Anna', 'photo.jpg');
  const b1 = await receive('m4', other, 'Bo', 'song.m4a');
  assert.equal(a1, `${PUB}/Anna-a1b2c3d4/photo.jpg`, 'plain name in a folder named after the contact');
  assert.equal(a2, `${PUB}/Anna-a1b2c3d4/photo (2).jpg`, 'a second file with the same name does not overwrite');
  assert.equal(b1, `${PUB}/Bo-ffeeddcc/song.m4a`);
  assert.equal(files.hasPublicFiles(), true);
  assert.ok(files.usedBytes() >= 12, 'size counts both places');
  assert.equal(files.usedBytes(other), 3, 'size of one contact');

  // ---- a file you send is copied next to the received ones; the temporary original goes away
  const tmp = 'file:///data/user/0/app/cache/rec.m4a';
  fs.writeFileSync(real(tmp), 'voice!');
  const sent = await files.storeOutgoing(cid, 'Anna', tmp, 'rec.m4a');
  assert.equal(sent, `${PUB}/Anna-a1b2c3d4/rec.m4a`);
  assert.equal(fs.readFileSync(real(sent), 'utf8'), 'voice!', 'content is copied');
  assert.equal(exists(tmp), false, 'cache original removed');
  assert.equal(await files.storeOutgoing(cid, 'Anna', 'file:///nope/missing.bin', 'x.bin'), 'file:///nope/missing.bin', 'copy failure keeps the original address');
  assert.equal(exists(`${PUB}/Anna-a1b2c3d4/x.bin`), false, 'a failed copy leaves no empty file behind');

  // ---- retention: only files of removed messages, and old files nobody points to, are deleted
  const outside = 'file:///data/user/0/app/elsewhere.txt'; fs.writeFileSync(real(outside), 'keep me');
  files.deleteStored([a2, outside, 'file:///etc/passwd']);
  assert.equal(exists(a2), false, 'file of a removed message is deleted');
  assert.equal(exists(outside), true, 'a file outside the app places is never deleted');

  const old = (uri: string, days: number) => { const t = new Date(Date.now() - days * 86_400_000); fs.utimesSync(real(uri), t, t); };
  old(a1, 20); old(b1, 20); old(sent, 3);
  files.sweepOldFiles(Date.now() - 14 * 86_400_000, [a1]);
  assert.equal(exists(a1), true, 'old but still used by a message: kept');
  assert.equal(exists(b1), false, 'old and unused: deleted');
  assert.equal(exists(`${PUB}/Bo-ffeeddcc`), false, 'empty contact folder removed');
  assert.equal(exists(sent), true, 'newer than the limit: kept');
  assert.equal(exists(`${PUB}/.nomedia`), true, '.nomedia stays');
  assert.equal(exists(`${PUB}`), true, 'Download/Direct itself stays');

  // ---- deleting files of one contact, then of everyone
  const b2 = await receive('m5', other, 'Bo', 'x.bin');
  files.deleteFiles(other);
  assert.equal(exists(b2), false, 'files of that contact are gone');
  assert.equal(exists(sent), true, 'other contacts are untouched');
  u = await receive('m6', other, 'Bo', 'y.bin');
  files.deleteFiles();
  assert.equal(exists(sent) || exists(u) || exists(a1), false, 'delete all removes every contact folder');
  assert.equal(exists(`${PUB}/.nomedia`), true, 'delete all leaves the folder itself');

  // ---- wipe for uninstall: Download/Direct, private folder and cache are all removed
  await receive('m7', cid, 'Anna', 'last.txt');
  fs.writeFileSync(real('file:///data/user/0/app/cache/junk.tmp'), 'x');
  files.wipeAllFiles();
  assert.equal(exists(PUB), false, 'the whole Download/Direct folder is removed');
  assert.equal(exists('file:///data/user/0/app/files/direct'), false, 'private folder removed');
  assert.equal(exists('file:///data/user/0/app/cache/junk.tmp'), false, 'cache emptied');
  assert.equal(files.usingPublic(), false);
  assert.equal(files.hasPublicFiles(), false);

  // ---- after a wipe the next file goes to the private folder again, until the folder is usable
  u = await receive('m8', cid, 'Anna', 'again.txt');
  assert.ok(u.includes('/files/direct/'));

  fs.rmSync(BASE, { recursive: true, force: true });
  console.log('files.test.ts OK');
})().catch(e => { console.error(e); fs.rmSync(BASE, { recursive: true, force: true }); process.exit(1); });
