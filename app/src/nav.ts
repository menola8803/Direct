import { Person } from './store';
export type Route =
  | { name: 'tabs' }
  | { name: 'chat'; person: Person }
  | { name: 'theme' }
  | { name: 'language' }
  | { name: 'blocked' }
  | { name: 'about' };
