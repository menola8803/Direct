// Meddelanden som skickas (krypterade) mellan två telefoner.
export type Plain =
  | { t: 'msg'; id: string; text: string; at: number }
  | { t: 'ack'; id: string };

// Signalering (SDP/ICE) går krypterad via reläservern. Servern ser bara vem som pratar med vem.
export type Signal =
  | { k: 'hello' }
  | { k: 'offer'; sdp: string }
  | { k: 'answer'; sdp: string }
  | { k: 'ice'; c: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null } };

export type MsgStatus = 'queued' | 'sent' | 'delivered';

// Den med lägst signeringsnyckel startar anslutningen. Undviker att båda skickar offer samtidigt.
export const isInitiator = (mySignPub: string, theirSignPub: string) => mySignPub < theirSignPub;

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
