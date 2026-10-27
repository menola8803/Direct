// Compares version numbers like "v0.7.0" and "0.10.1". Returns >0 if a is newer than b.
export function cmpVersion(a: string, b: string): number {
  const p = (v: string) => v.replace(/^v/i, '').split('-')[0].split('.').map(x => parseInt(x, 10) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d; }
  return 0;
}
