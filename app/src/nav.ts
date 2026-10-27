export type Route =
  | { name: 'tabs' }
  | { name: 'chat'; id: string }
  | { name: 'verify'; id: string }
  | { name: 'mycode' }
  | { name: 'add' }
  | { name: 'connection' }
  | { name: 'update' }
  | { name: 'theme' }
  | { name: 'language' }
  | { name: 'blocked' }
  | { name: 'about' };
