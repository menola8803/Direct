export type Route =
  | { name: 'tabs' }
  | { name: 'chat'; id: string }
  | { name: 'verify'; id: string }
  | { name: 'mycode' }
  | { name: 'invite'; card: string }
  | { name: 'pair'; id: string }
  | { name: 'conference' }
  | { name: 'mediatest' }
  | { name: 'storage' }
  | { name: 'add' }
  | { name: 'connection' }
  | { name: 'stun' }
  | { name: 'update' }
  | { name: 'theme' }
  | { name: 'language' }
  | { name: 'blocked' }
  | { name: 'about' };
