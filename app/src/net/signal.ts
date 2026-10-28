// Tests whether a signal server answers: opens a WebSocket and returns the milliseconds until it is open, or null.
export const isSignalUrl = (u: string) => /^wss?:\/\/[^\s/]+(\/\S*)?$/i.test(u.trim());

export function pingSignal(url: string, ms = 5000, WS: any = (globalThis as any).WebSocket): Promise<number | null> {
  return new Promise(resolve => {
    if (!WS || !isSignalUrl(url)) return resolve(null);
    let ws: any;
    const t0 = Date.now();
    let finished = false; // close() fires onclose, which would call done() again
    const done = (ok: boolean) => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      try { ws?.close(); } catch {}
      resolve(ok ? Date.now() - t0 : null);
    };
    const timer = setTimeout(() => done(false), ms);
    try {
      ws = new WS(url.trim());
      ws.onopen = () => done(true);
      ws.onerror = () => done(false);
      ws.onclose = () => done(false);
    } catch { done(false); }
  });
}
