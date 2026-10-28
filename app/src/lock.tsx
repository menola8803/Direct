// App lock: a gate in front of the whole app. Unlocking uses the phone's own fingerprint, face or screen lock
// (expo-local-authentication). Nothing here holds a key: the lock decides what is shown, the data is encrypted separately.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Text } from './ui';
import { useApp } from './store';
import { useNet } from './net/net';
import { shouldLock } from './core/lock';
import { takeHold } from './lockhold';

// True when the phone has a screen lock (PIN, pattern, password) or a fingerprint/face, so the lock can work.
export async function lockPossible(): Promise<boolean> {
  try { return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE; } catch { return false; }
}
export type AuthResult = { ok: true } | { ok: false; error: string };
// Asks the phone for fingerprint, face or screen lock (the PIN is accepted when fingerprint/face is not available).
export async function authenticate(message: string, cancelLabel: string): Promise<AuthResult> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: message, cancelLabel, disableDeviceFallback: false });
    return r.success ? { ok: true } : { ok: false, error: r.error };
  } catch { return { ok: false, error: 'unknown' }; }
}

const L = createContext<{ locked: boolean }>({ locked: false });
export const useLocked = () => useContext(L).locked;

export function LockProvider({ children }: { children: React.ReactNode }) {
  const { ready, lockOn, lockDelay, setSettings, theme, t } = useApp();
  const { call } = useNet();
  const [unlocked, setUnlocked] = useState(false);
  const [away, setAway] = useState(false); // the app is not on the screen: cover it so the recent-apps picture shows no chat
  const [msg, setMsg] = useState('');
  const left = useRef<number | null>(null);
  const busy = useRef(false); // the unlock dialog is open, or just closed (it can make the app look as if it left)
  const busyUntil = useRef(0);
  const prevOn = useRef<boolean | null>(null);

  // Switching the lock on from Settings has just asked for the fingerprint, so the app starts unlocked.
  useEffect(() => {
    if (!ready) return;
    if (prevOn.current === false && lockOn) setUnlocked(true);
    prevOn.current = lockOn;
  }, [ready, lockOn]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      const now = Date.now();
      if (busy.current || now < busyUntil.current) return;
      if (st !== 'active') { if (left.current == null) left.current = now; setAway(true); return; }
      const lock = shouldLock({ on: lockOn, left: left.current, now, delay: lockDelay, held: takeHold(now) });
      left.current = null; setAway(false);
      if (lock) setUnlocked(false);
    });
    return () => sub.remove();
  }, [lockOn, lockDelay]);

  const locked = ready && lockOn && !unlocked;

  const unlock = useCallback(async () => {
    if (busy.current) return;
    busy.current = true; setMsg('');
    const r = await authenticate(t.lockPrompt, t.cancel);
    busy.current = false; busyUntil.current = Date.now() + 1500;
    if (r.ok) { setUnlocked(true); return; }
    if (r.error === 'not_enrolled' || r.error === 'passcode_not_set' || r.error === 'not_available') {
      // The phone has no screen lock any more: anyone can open the phone, so the lock cannot protect anything. Switch it off.
      if (!(await lockPossible())) { setSettings({ lockOn: false }); Alert.alert(t.lockTitle, t.lockGone); return; }
    }
    if (r.error !== 'user_cancel' && r.error !== 'system_cancel' && r.error !== 'app_cancel') setMsg(t.lockFailed);
  }, [t, setSettings]);

  // Ask as soon as the lock screen appears (not while the app is out of sight).
  useEffect(() => { if (locked && AppState.currentState === 'active') unlock(); }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  const cover = lockOn && (locked || away);
  return (
    <L.Provider value={{ locked }}>
      <View style={{ flex: 1 }}>
        {children}
        {cover ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14, zIndex: 100, elevation: 100 }]} accessibilityViewIsModal>
            <Text style={{ fontSize: 26, fontWeight: '800', color: theme.ink }}>Direct</Text>
            {locked ? (
              <>
                <Text style={{ fontSize: 15, color: theme.muted, textAlign: 'center' }}>{t.lockLocked}</Text>
                {call.status === 'incoming' ? <Text style={{ fontSize: 16, fontWeight: '700', color: theme.good, textAlign: 'center' }}>{t.lockCall}</Text> : null}
                {msg ? <Text style={{ color: theme.danger, textAlign: 'center' }}>{msg}</Text> : null}
                <Pressable accessibilityRole="button" onPress={unlock}
                  style={{ minHeight: 52, paddingHorizontal: 28, borderRadius: 16, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.onPrimary }}>{t.lockButton}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    </L.Provider>
  );
}
