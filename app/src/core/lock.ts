// When the app locks itself. Pure functions, so they can be tested without the app.
// The lock is a gate in the app: it asks for the phone's fingerprint, face or screen lock before the app is shown.
export const LOCK_DELAYS = [0, 60, 300] as const; // seconds in the background before the lock is needed
export const DEFAULT_LOCK_DELAY = 60;

// Anything that is not one of the choices becomes the default.
export function normLockDelay(n: unknown): number {
  const v = Number(n);
  return (LOCK_DELAYS as readonly number[]).includes(v) ? v : DEFAULT_LOCK_DELAY;
}

// Should the app ask for unlocking when it comes back to the screen?
//  on: the lock is switched on. left: when the app left the screen (ms), null if it did not.
//  held: the app left on purpose to open a file picker, a share sheet or a system dialog (not counted as leaving).
export function shouldLock(o: { on: boolean; left: number | null; now: number; delay: unknown; held?: boolean }): boolean {
  if (!o.on || o.held || o.left == null) return false;
  return o.now - o.left >= normLockDelay(o.delay) * 1000;
}
