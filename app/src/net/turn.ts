// TURN servers: parsing the user's list and testing that a server really hands out a relay address.
import type { IceServer, RtcApi } from './peers';

export type Turn = { urls: string; username?: string; credential?: string };
export const MAX_TURN = 5;

// One server per line: "turn:host:3478 [username [password]]". turns: (TLS) works too, and ?transport=tcp|udp is kept.
// A bare "host:port" is taken as turn:host:port. Passwords may contain spaces (everything after the user name).
export function parseTurn(text: string): Turn[] {
  const out: Turn[] = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) continue;
    let u = parts[0].replace(/^(turns?):\/\//i, '$1:');
    if (!/^turns?:/i.test(u)) u = `turn:${u}`;
    if (!/^turns?:[A-Za-z0-9.\-[\]:]+(\?transport=(udp|tcp))?$/i.test(u) || u.length > 120) continue;
    u = u.replace(/^turns?:/i, m => m.toLowerCase()).replace(/\?transport=(udp|tcp)$/i, m => m.toLowerCase());
    const t: Turn = { urls: u };
    if (parts[1]) t.username = parts[1].slice(0, 200);
    if (parts.length > 2) t.credential = parts.slice(2).join(' ').slice(0, 300);
    if (out.some(x => x.urls === t.urls && x.username === t.username)) continue;
    out.push(t);
    if (out.length >= MAX_TURN) break;
  }
  return out;
}

export const turnLine = (t: Turn) => [t.urls, t.username, t.credential].filter(Boolean).join(' ');
export const turnText = (l: Turn[]) => l.map(turnLine).join('\n');
export const toIce = (t: Turn): IceServer => ({ urls: t.urls, username: t.username, credential: t.credential });

// Milliseconds until the server returned a relay candidate (so the address, port and password all work), or null.
export function pingTurn(rtc: RtcApi, t: Turn, ms = 6000): Promise<number | null> {
  return new Promise(resolve => {
    let pc: any;
    const t0 = Date.now();
    const done = (ok: boolean) => { clearTimeout(timer); try { pc?.close(); } catch {} resolve(ok ? Date.now() - t0 : null); };
    const timer = setTimeout(() => done(false), ms);
    try {
      pc = new rtc.RTCPeerConnection({ iceServers: [toIce(t)], iceTransportPolicy: 'relay' });
      pc.createDataChannel('t');
      pc.addEventListener('icecandidate', (e: any) => { if (e.candidate && / typ relay /.test(e.candidate.candidate)) done(true); });
      pc.createOffer().then((o: any) => pc.setLocalDescription(o)).catch(() => done(false));
    } catch { done(false); }
  });
}
