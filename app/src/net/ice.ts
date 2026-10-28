// Which ICE servers the app uses, depending on the privacy settings.
import type { IceServer } from './peers';
import { stunOrDefault } from './stun';
import { parseTurn, toIce } from './turn';

export type IceSettings = { stunList: string; turnList: string; hideIp: boolean; tcpOnly: boolean };
export type IcePlan = {
  iceServers: IceServer[];
  relayOnly: boolean;   // only relayed candidates: the contact never sees your IP address
  needsTurn: boolean;   // relay-only was asked for but no TURN server is set: no connection can be made
};

// TURN over TCP: a bare turn: URL gets ?transport=tcp, turns: (TLS) is TCP already.
export const asTcp = (u: string) => (/^turns:/i.test(u) || u.includes('?') ? u : `${u}?transport=tcp`);

export function planIce(s: IceSettings): IcePlan {
  const turn = parseTurn(s.turnList);
  const relayOnly = s.hideIp || s.tcpOnly;
  const iceServers: IceServer[] = [];
  // STUN answers over UDP and reveals the public address, so it is left out when everything must go through a relay.
  if (!relayOnly) iceServers.push({ urls: stunOrDefault(s.stunList) });
  for (const t of turn) { const e = toIce(t); iceServers.push(s.tcpOnly ? { ...e, urls: asTcp(t.urls) } : e); }
  return { iceServers, relayOnly, needsTurn: relayOnly && turn.length === 0 };
}
