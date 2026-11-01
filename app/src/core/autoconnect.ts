// Which contacts the app should start connecting to right now. Plain TypeScript, so it can be tested in Node.
//
// The app connects to its contacts when the signal server comes online (all of them), when a chat is opened and when
// something is sent. A contact that is added, or unblocked, while the app is already online was in none of those cases,
// so it stayed "offline" until the app was restarted. This picks exactly those: contacts that are not blocked and that
// have not been tried since the signal server last came online.
import type { Contact } from './crypto';

// `tried` is the set of contact ids already started. It is updated here: ids that are blocked or gone are removed, so a
// contact that is unblocked, or added again, is picked up again.
export function pickNewContacts(contacts: Record<string, Contact>, blocked: Record<string, unknown>, tried: Set<string>): Contact[] {
  for (const id of [...tried]) if (!contacts[id] || blocked[id]) tried.delete(id);
  const out: Contact[] = [];
  for (const c of Object.values(contacts)) {
    if (blocked[c.id] || tried.has(c.id)) continue;
    tried.add(c.id); out.push(c);
  }
  return out;
}
