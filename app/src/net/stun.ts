// STUN servers: parsing the user's list and testing whether a server actually answers.
import type { RtcApi } from './peers';

// Neutral public defaults (not Google). stun.telnyx.com is on the list the Tor Project validated for Snowflake in 2026
// (tor-browser-build issue 41775). Not testable from the build environment (no UDP/DNS): use "Test STUN" in the app.
export const DEFAULT_STUN = ['stun:stun.cloudflare.com:3478', 'stun:stun.nextcloud.com:443', 'stun:stun.telnyx.com:3478'];

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

// Milliseconds until the server returned a server-reflexive candidate, or null if it did not answer.
export function pingStun(rtc: RtcApi, url: string, ms = 4000): Promise<number | null> {
  return new Promise(resolve => {
    let pc: any;
    const t0 = Date.now();
    const done = (ok: boolean) => { clearTimeout(t); try { pc?.close(); } catch {} resolve(ok ? Date.now() - t0 : null); };
    const t = setTimeout(() => done(false), ms);
    try {
      pc = new rtc.RTCPeerConnection({ iceServers: [{ urls: url }] });
      pc.createDataChannel('t');
      pc.addEventListener('icecandidate', (e: any) => { if (e.candidate && / typ srflx /.test(e.candidate.candidate)) done(true); });
      pc.createOffer().then((o: any) => pc.setLocalDescription(o)).catch(() => done(false));
    } catch { done(false); }
  });
}

export const testStun = async (rtc: RtcApi, url: string, ms = 4000) => (await pingStun(rtc, url, ms)) !== null;
