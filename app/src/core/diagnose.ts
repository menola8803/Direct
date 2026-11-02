// Explains why a connection to a contact does not come up. Plain TypeScript, so it can be tested in Node.
//
// The facts come from the connection manager (what happened during the latest attempt) and the settings. Nothing here
// holds an IP address: only counts and states, so a report can be shown or copied without giving away where anyone is.

export type SignalState = 'connecting' | 'online' | 'offline';

// What happened during one attempt to connect to a contact.
export type Diag = {
  at: number;                         // when the attempt started
  how: 'offer' | 'answer' | 'manual'; // we made the offer / we answered the other phone's offer / pairing without a server
  heard: boolean;                     // the other phone answered (we offered) or made contact (we answered)
  gather: string; ice: string; conn: string; dc: string; // last states seen: ICE gathering, ICE connection, connection, data channel
  cand: { host: number; srflx: number; relay: number; other: number }; // our own addresses by kind (srflx = learned from STUN)
  remote: number;                     // addresses received from the other phone
  offline?: boolean;                  // the signal server said the other phone is not connected to it
  ended?: { at: number; why: string };
  errors: string[];
};
export type SignalInfo = { url: string; state: SignalState; err: string; since: number; tries: number };

export type Facts = {
  signal: SignalInfo;
  link?: 'connecting' | 'open' | 'closed';
  diag?: Diag;
  relayOnly: boolean; // privacy mode: everything must go through a relay
  hasTurn: boolean;   // at least one TURN server is set
  now: number;
};
export type Cause = 'open' | 'no-server' | 'server-wait' | 'server-down' | 'no-attempt' | 'peer-offline' | 'in-progress' | 'no-reply'
  | 'no-address' | 'no-remote' | 'no-path' | 'channel' | 'other';
export type Hint = 'stun-silent' | 'no-turn';

const total = (d: Diag) => d.cand.host + d.cand.srflx + d.cand.relay + d.cand.other;
export const SERVER_WAIT_MS = 25_000;
export const IN_PROGRESS_MS = 8_000;

// The most likely reason, checked from the outside in: the signal server, then the other phone, then the network between.
export function cause(f: Facts): Cause {
  if (f.link === 'open') return 'open';
  const d = f.diag;
  if (d?.how !== 'manual') {
    if (!f.signal.url) return 'no-server';
    if (f.signal.state !== 'online') return f.signal.state === 'connecting' && f.now - f.signal.since < SERVER_WAIT_MS ? 'server-wait' : 'server-down';
  }
  if (!d) return 'no-attempt';
  if (d.offline && !d.heard && d.how !== 'manual') return 'peer-offline'; // the server knows: they are not there, no need to wait and see
  if (!d.ended && f.now - d.at < IN_PROGRESS_MS) return 'in-progress';
  if (!d.heard) return 'no-reply';
  if (total(d) === 0) return 'no-address';
  if (d.remote === 0 && d.how !== 'manual') return 'no-remote';
  if (d.conn === 'connected' || d.ice === 'connected' || d.ice === 'completed') return 'channel';
  return 'no-path';
}

// Extra hints for the "no direct path" case.
export function hints(f: Facts): Hint[] {
  const d = f.diag, out: Hint[] = [];
  if (!d || cause(f) !== 'no-path') return out;
  if (!f.relayOnly && d.cand.srflx === 0 && d.cand.relay === 0) out.push('stun-silent');
  if (!f.hasTurn) out.push('no-turn');
  return out;
}

const hostOf = (u: string) => u.replace(/^wss?:\/\//i, '').split(/[/?#]/)[0] || '-';
const secs = (ms: number) => `${Math.max(0, Math.round(ms / 1000))} s`;

// The technical report as plain text (English on purpose: it is meant to be pasted to whoever helps).
export function reportText(f: Facts, version: string): string {
  const d = f.diag, s = f.signal, L: string[] = [];
  L.push(`Direct ${version}`);
  L.push(`Signal server: ${s.url ? `${s.state} · ${hostOf(s.url)}` : 'not set'}${s.url && s.state === 'connecting' && s.since ? ` · trying for ${secs(f.now - s.since)}` : ''}`);
  if (s.url && s.err) L.push(`  last signal error: ${s.err}${s.tries > 1 ? ` (${s.tries} tries)` : ''}`);
  L.push(`Link: ${f.link ?? 'none'}`);
  L.push(`Privacy mode (relay only): ${f.relayOnly ? 'yes' : 'no'} · TURN servers: ${f.hasTurn ? 'yes' : 'none'}`);
  if (!d) { L.push('Attempt: none yet'); return L.join('\n'); }
  const how = d.how === 'offer' ? 'we made the offer' : d.how === 'answer' ? 'we answered the other phone' : 'manual pairing';
  L.push(`Attempt: ${how} · ${secs(f.now - d.at)} ago${d.ended ? ` · ended after ${secs(d.ended.at - d.at)}: ${d.ended.why}` : ' · still going'}`);
  L.push(`Other phone answered: ${d.heard ? 'yes' : 'no'}${d.offline ? ' · the server says it is not connected to it' : ''}`);
  L.push(`Our addresses: host ${d.cand.host} · STUN ${d.cand.srflx} · relay ${d.cand.relay}${d.cand.other ? ` · other ${d.cand.other}` : ''}`);
  L.push(`Their addresses received: ${d.remote}`);
  L.push(`ICE: gathering ${d.gather} · ice ${d.ice} · connection ${d.conn} · channel ${d.dc}`);
  if (d.errors.length) L.push(`Errors: ${d.errors.join(' | ')}`);
  L.push(`Verdict: ${cause(f)}`);
  return L.join('\n');
}
