import { cmpVersion } from './core/semver';

// Repository where releases are published. Must be public so the app can read it without signing in.
export const UPDATE_REPO = 'menola8803/Direct';

export type Release = { tag: string; page: string; apk?: string; notes: string };
type Fetch = (url: string, init?: any) => Promise<{ ok: boolean; status: number; url?: string; json: () => Promise<any> }>;

const why = (e: unknown) => String((e as any)?.message ?? e).slice(0, 60);

// The GitHub API. It lets an unsigned-in address make 60 calls an hour, and a mobile network shares addresses between many
// phones, so this can answer 403 even on the first try.
async function viaApi(repo: string, f: Fetch): Promise<Release | null> {
  const r = await f(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`api HTTP ${r.status}`);
  const j = await r.json();
  const apk = (j.assets ?? []).find((a: any) => String(a.name).toLowerCase().endsWith('.apk'));
  return { tag: j.tag_name, page: j.html_url, apk: apk?.browser_download_url, notes: String(j.body ?? '').slice(0, 600) };
}

// The web page of the newest release: github.com/<repo>/releases/latest sends the browser on to .../releases/tag/<tag>. No API
// call is used up, and the tag is read from the address it ended up at. The APK has a fixed name per release (see release.yml).
async function viaPage(repo: string, f: Fetch): Promise<Release | null> {
  const r = await f(`https://github.com/${repo}/releases/latest`, { headers: { Accept: 'text/html' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`page HTTP ${r.status}`);
  const m = /\/releases\/tag\/([^/?#]+)/.exec(String(r.url ?? ''));
  if (!m) throw new Error('page: no release address');
  const tag = decodeURIComponent(m[1]);
  return { tag, page: `https://github.com/${repo}/releases/tag/${tag}`, apk: `https://github.com/${repo}/releases/download/${tag}/Direct-${tag}.apk`, notes: '' };
}

// The newest release, or null when there is none. Tries the API, and the web page when the API will not answer. When both fail the
// error says what each answered, so a phone that cannot check can say why.
export async function latestRelease(repo = UPDATE_REPO, f: Fetch = fetch as any): Promise<Release | null> {
  try { return await viaApi(repo, f); } catch (e1) {
    try { return await viaPage(repo, f); } catch (e2) { throw new Error(`${why(e1)}; ${why(e2)}`); }
  }
}

export const isNewer = (tag: string, current: string) => cmpVersion(tag, current) > 0;
