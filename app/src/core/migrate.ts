// Upgrades saved settings from older versions. Pure, so it can be tested without the app.
export function migrateSaved(raw: any): any {
  if (!raw || typeof raw !== 'object') return {};
  const s = { ...raw };
  // 0.9.1: the dark theme was called 'usb'
  if (s.themeName === 'usb') s.themeName = 'dark';
  // 0.10.0: one TURN server in three fields became a list (one server per line)
  if (typeof s.turnUrl === 'string') {
    if (!s.turnList && s.turnUrl.trim()) {
      s.turnList = [s.turnUrl.trim(), String(s.turnUser ?? '').trim(), String(s.turnCred ?? '')].filter(Boolean).join(' ');
    }
    delete s.turnUrl; delete s.turnUser; delete s.turnCred;
  }
  return s;
}
