// Meddelanden som skickas (krypterade i en session med forward secrecy) mellan två telefoner.
export type FileKind = 'file' | 'voice' | 'video';
export type Plain =
  | { t: 'msg'; id: string; text: string; at: number }
  | { t: 'ack'; id: string }
  | { t: 'file'; id: string; name: string; mime: string; size: number; kind: FileKind; chunks: number; at: number; dur?: number }
  | { t: 'chunk'; id: string; i: number; d: string }
  | { t: 'abort'; id: string }
  | { t: 'call'; k: 'invite' | 'accept' | 'decline' | 'end'; cid: string; video: boolean; members?: string[] };

// Internt i anslutningslagret (skickas aldrig vidare till appen).
export type Inner =
  | { t: 'rtc'; k: 'offer' | 'answer'; sdp: string };

// Signalering (SDP/ICE) går krypterad via reläservern eller via manuella koder. Servern ser bara vem som pratar med vem.
export type Signal =
  | { k: 'hello' }
  | { k: 'offer'; sdp: string }
  | { k: 'answer'; sdp: string }
  | { k: 'ice'; c: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null } };

export type MsgStatus = 'queued' | 'sent' | 'delivered';

// Den med lägst signeringsnyckel startar anslutningen. Undviker att båda skickar offer samtidigt.
export const isInitiator = (mySignPub: string, theirSignPub: string) => mySignPub < theirSignPub;

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
