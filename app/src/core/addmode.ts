// How contacts are added: with a short one-time code (the default) or with a QR code. A choice about what the
// "Add" button leads to; both ways stay reachable from the screens whatever is chosen.
export type AddMode = 'code' | 'qr';
export const ADD_MODES: AddMode[] = ['code', 'qr'];
export const DEFAULT_ADD_MODE: AddMode = 'code';
export const normAddMode = (v: unknown): AddMode => (v === 'qr' ? 'qr' : DEFAULT_ADD_MODE);
