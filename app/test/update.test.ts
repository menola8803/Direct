// The check for a newer version: the GitHub API first, the release web page when the API will not answer, and a reason when neither does.
import assert from 'node:assert/strict';
import { isNewer, latestRelease } from '../src/update';

type R = { ok: boolean; status: number; url?: string; json: () => Promise<any> };
const res = (status: number, o: Partial<R> & { body?: any } = {}): R => ({ ok: status >= 200 && status < 300, status, url: o.url, json: async () => o.body });
const calls: string[] = [];
const fake = (api: R | Error, page: R | Error) => async (url: string) => {
  calls.push(url);
  const x = url.startsWith('https://api.github.com/') ? api : page;
  if (x instanceof Error) throw x;
  return x;
};
const REPO = 'me/Direct';
const apiBody = { tag_name: 'v0.14.0', html_url: 'https://github.com/me/Direct/releases/tag/v0.14.0', body: 'notes', assets: [{ name: 'direct-v0.14.0.zip', browser_download_url: 'z' }, { name: 'Direct-v0.14.0.apk', browser_download_url: 'https://x/apk' }] };

(async () => {
  // the API answers: used as before
  calls.length = 0;
  let r = await latestRelease(REPO, fake(res(200, { body: apiBody }), new Error('should not be asked')));
  assert.deepEqual(r, { tag: 'v0.14.0', page: apiBody.html_url, apk: 'https://x/apk', notes: 'notes' });
  assert.equal(calls.length, 1, 'the web page is not asked when the API answers');
  // API without any release: none, and nothing else is tried
  calls.length = 0;
  assert.equal(await latestRelease(REPO, fake(res(404), new Error('no'))), null);
  assert.equal(calls.length, 1);
  // the API is over its limit (403), a network error, or a server error: the page gives the tag
  for (const api of [res(403), res(500), res(429), new Error('Network request failed')]) {
    r = await latestRelease(REPO, fake(api, res(200, { url: 'https://github.com/me/Direct/releases/tag/v0.14.0' })));
    assert.deepEqual(r, { tag: 'v0.14.0', page: 'https://github.com/me/Direct/releases/tag/v0.14.0', apk: 'https://github.com/me/Direct/releases/download/v0.14.0/Direct-v0.14.0.apk', notes: '' });
  }
  r = await latestRelease(REPO, fake(res(403), res(200, { url: 'https://github.com/me/Direct/releases/tag/v0.14.0?foo=1#x' })));
  assert.equal(r?.tag, 'v0.14.0', 'a query or fragment on the address is not part of the tag');
  assert.equal(await latestRelease(REPO, fake(res(403), res(404))), null, 'the page says there is no release');
  // both fail: the error says what each answered
  await assert.rejects(latestRelease(REPO, fake(res(403), res(503))), /api HTTP 403; page HTTP 503/);
  await assert.rejects(latestRelease(REPO, fake(new Error('Network request failed'), new Error('Network request failed'))), /Network request failed; Network request failed/);
  // a page that did not redirect to a release is not trusted
  await assert.rejects(latestRelease(REPO, fake(res(403), res(200, { url: 'https://github.com/me/Direct/releases' }))), /no release address/);
  await assert.rejects(latestRelease(REPO, fake(res(403), res(200))), /no release address/);

  // which is newer
  assert.ok(isNewer('v0.14.0', '0.13.7'));
  assert.ok(!isNewer('v0.14.0', '0.14.0'));
  assert.ok(!isNewer('v0.13.7', '0.14.0'));
  assert.ok(isNewer('v0.14.1', '0.14.0'));
  console.log('update.test.ts OK');
})().catch(e => { console.error(e); process.exit(1); });
