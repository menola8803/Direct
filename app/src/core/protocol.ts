// Messages sent (encrypted in a session with forward secrecy) between two phones.
export type FileKind = 'file' | 'voice' | 'video';
export type Plain =
  | { t: 'msg'; id: string; text: string; at: number }
  | { t: 'ack'; id: string }
  | { t: 'file'; id: string; name: string; mime: string; size: number; kind: FileKind; chunks: number; at: number; dur?: number }
  | { t: 'chunk'; id: string; i: number; d: string }
  | { t: 'abort'; id: string }
  | { t: 'call'; k: 'invite' | 'accept' | 'decline' | 'end'; cid: string; video: boolean; members?: string[] };

// Internal to the connection layer (never passed on to the app).
export type Inner =
  | { t: 'rtc'; k: 'offer' | 'answer'; sdp: string };

// Signaling (SDP/ICE) goes encrypted via the relay server or via manual codes. The server only sees who talks to whom.
export type Signal =
  | { k: 'hello' }
  | { k: 'offer'; sdp: string }
  | { k: 'answer'; sdp: string }
  | { k: 'ice'; c: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null } };

export type MsgStatus = 'queued' | 'sent' | 'delivered';

// The one with the lowest signing key starts the connection. Avoids both sending an offer at the same time.
export const isInitiator = (mySignPub: string, theirSignPub: string) => mySignPub < theirSignPub;

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
