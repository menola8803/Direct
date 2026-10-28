export type Route =
  | { name: 'tabs' }
  | { name: 'chat'; id: string }
  | { name: 'verify'; id: string }
  | { name: 'mycode' }
  | { name: 'invite'; card: string }
  | { name: 'pair'; id: string }
  | { name: 'mediatest' }
  | { name: 'storage' }
  | { name: 'add' }
  | { name: 'connection' }
  | { name: 'stun' }
  | { name: 'turn' }
  | { name: 'privacy' }
  | { name: 'update' }
  | { name: 'theme' }
  | { name: 'language' }
  | { name: 'keep' }
  | { name: 'lock' }
  | { name: 'filemode' }
  | { name: 'backup' }
  | { name: 'blocked' }
  | { name: 'guide' }
  | { name: 'about' };
