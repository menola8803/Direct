import { cmpVersion } from './core/semver';

// Repo där releaser publiceras. Måste vara publikt för att appen ska kunna läsa det utan inloggning.
export const UPDATE_REPO = 'menola8803/direct-design';

export type Release = { tag: string; page: string; apk?: string; notes: string };

export async function latestRelease(repo = UPDATE_REPO): Promise<Release | null> {
  const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const apk = (j.assets ?? []).find((a: any) => String(a.name).toLowerCase().endsWith('.apk'));
  return { tag: j.tag_name, page: j.html_url, apk: apk?.browser_download_url, notes: String(j.body ?? '').slice(0, 600) };
}

export const isNewer = (tag: string, current: string) => cmpVersion(tag, current) > 0;
