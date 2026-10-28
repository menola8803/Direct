// Invite links. The code (card) travels in the URL fragment (#...), which browsers never send to a web server.
import { decodeCard } from './crypto';

export const INVITE_PAGE = 'https://menola8803.github.io/Direct/i.html';
export const RELEASES_URL = 'https://github.com/menola8803/Direct/releases/latest';
// Always the newest release: GitHub redirects /releases/latest/download/<name> to the asset with that exact name
// in the latest release. The release workflow uploads the APK under this fixed name (in addition to Direct-<tag>.apk).
export const APK_URL = 'https://github.com/menola8803/Direct/releases/latest/download/Direct.apk';

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

export type InviteStrings = { inviteIntro: string; inviteGet: string; inviteAllow: string; inviteHave: string; inviteSomeone: string };

// The SMS: who invites and what Direct is, a fixed link to the newest APK with the note about allowing the install,
// and the invite link that adds the sender. Plain characters only (no dashes or arrows) so it stays a normal SMS alphabet.
export function inviteMessage(card: string, s: InviteStrings, name?: string) {
  const who = (name ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 40) || s.inviteSomeone;
  return [
    s.inviteIntro.replace('{name}', () => who),
    `${s.inviteGet}\n${APK_URL}\n${s.inviteAllow}`,
    `${s.inviteHave}\n${inviteLink(card)}`,
  ].join('\n\n');
}
