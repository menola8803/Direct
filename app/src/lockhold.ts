// Called just before the app opens a file picker, a share sheet or a system screen on purpose, so that coming back
// from there is not counted as leaving the app (see lock.tsx). A hold that is not used expires after two minutes.
let heldAt = 0;
export const holdLock = () => { heldAt = Date.now(); };
// True once if a hold is active; it is used up either way.
export function takeHold(now = Date.now()): boolean {
  const h = heldAt !== 0 && now - heldAt < 120_000;
  heldAt = 0;
  return h;
}
