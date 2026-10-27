// Jämför versionsnummer som "v0.7.0" och "0.10.1". Returnerar >0 om a är nyare än b.
export function cmpVersion(a: string, b: string): number {
  const p = (v: string) => v.replace(/^v/i, '').split('-')[0].split('.').map(x => parseInt(x, 10) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d; }
  return 0;
}
