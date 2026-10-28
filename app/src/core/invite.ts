// Invite links. The code (card) travels in the URL fragment (#...), which browsers never send to a web server.
import { decodeCard } from './crypto';

export const INVITE_PAGE = 'https://menola8803.github.io/Direct/i.html';
export const RELEASES_URL = 'https://github.com/menola8803/Direct/releases/latest';

export const inviteLink = (card: string) => `${INVITE_PAGE}#${card}`;
export const deepLink = (card: string) => `direct://add?c=${encodeURIComponent(card)}`;

// Accepts direct://add?c=<card>, https://…/i.html#<card>, or any text containing a card. Returns the card string or null.
export function cardFromUrl(url: string): string | null {
  try {
    let text = url.trim();
    const q = /[?&]c=([^&#\s]+)/.exec(text);
    if (q) text = decodeURIComponent(q[1]);
    const i = text.indexOf('direct1:');
    if (i < 0) return null;
    const card = text.slice(i).split(/[\s&#]/)[0];
    return decodeCard(card) ? card : null;
  } catch { return null; }
}

export function inviteMessage(card: string, s: { inviteText: string; inviteGet: string; inviteHave: string; inviteCodeFallback: string }) {
  return `${s.inviteText}\n\n${s.inviteGet} ${RELEASES_URL}\n\n${s.inviteHave}\n${inviteLink(card)}\n\n${s.inviteCodeFallback} ${card}`;
}
