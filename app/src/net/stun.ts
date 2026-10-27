// STUN servers: parsing the user's list and testing whether a server actually answers.
import type { RtcApi } from './peers';

// Neutral public defaults (not Google). Unverified from the build environment: use "Test STUN" in the app.
export const DEFAULT_STUN = ['stun:stun.cloudflare.com:3478', 'stun:stun.nextcloud.com:443', 'stun:stun.stunprotocol.org:3478'];

// Accepts "host:port", "stun:host:port" or "stun://host:port", one per line or comma/space separated. Max 8.
export function parseStun(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const t = raw.trim().replace(/^stuns?:\/\//i, 'stun:');
    if (!t) continue;
    const u = /^stuns?:/i.test(t) ? t : `stun:${t}`;
    if (!/^stuns?:[A-Za-z0-9.\-[\]:]+$/.test(u) || u.length > 100) continue;
    if (!out.includes(u)) out.push(u);
    if (out.length >= 8) break;
  }
  return out;
}

export const stunOrDefault = (text: string) => { const l = parseStun(text); return l.length ? l : DEFAULT_STUN; };

// True if the server returned a server-reflexive candidate (i.e. it answered).
export function testStun(rtc: RtcApi, url: string, ms = 4000): Promise<boolean> {
  return new Promise(resolve => {
    let pc: any;
    const done = (ok: boolean) => { clearTimeout(t); try { pc?.close(); } catch {} resolve(ok); };
    const t = setTimeout(() => done(false), ms);
    try {
      pc = new rtc.RTCPeerConnection({ iceServers: [{ urls: url }] });
      pc.createDataChannel('t');
      pc.addEventListener('icecandidate', (e: any) => { if (e.candidate && / typ srflx /.test(e.candidate.candidate)) done(true); });
      pc.createOffer().then((o: any) => pc.setLocalDescription(o)).catch(() => done(false));
    } catch { done(false); }
  });
}
