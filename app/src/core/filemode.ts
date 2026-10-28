// Where new files go. Chosen in Settings → Storage; every person decides for their own phone.
//  visible: a folder you can open in the Files app (Download/Direct, needs "all files access"), not encrypted.
//  private: encrypted, kept in the app's own folder, opened only through Direct.
export type FileModeChoice = 'visible' | 'private';
export const FILE_MODES: FileModeChoice[] = ['visible', 'private'];
export const DEFAULT_FILE_MODE: FileModeChoice = 'visible';
export const normFileMode = (v: unknown): FileModeChoice => (v === 'private' ? 'private' : DEFAULT_FILE_MODE);
