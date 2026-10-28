import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import { Text } from '../ui';
import { useApp } from '../store';
import { LOCK_DELAYS, normLockDelay } from '../core/lock';
import { Strings } from '../i18n';
import { Card, Header, Screen } from '../ui';
import { authenticate, lockPossible } from '../lock';

const names = (t: Strings): Record<number, string> => ({ 0: t.lockNow, 60: t.lockMin1, 300: t.lockMin5 });
export const lockLabel = (t: Strings, on: boolean) => (on ? t.lockOnRight : t.lockOffRight);

// Switch the app lock on or off and choose how soon it locks again.
export default function AppLock({ onBack }: { onBack: () => void }) {
  const { theme, t, lockOn, lockDelay, setSettings } = useApp();
  const [busy, setBusy] = useState(false);
  const cur = normLockDelay(lockDelay);
  const n = names(t);

  const toggle = async (v: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      // Both ways ask for the fingerprint/screen lock first, so only the owner can switch the lock on or off.
      const possible = await lockPossible();
      if (v && !possible) { Alert.alert(t.lockTitle, t.lockNeedScreen); return; }
      if (!v && !possible) { setSettings({ lockOn: false }); return; } // no screen lock on the phone any more: nothing to confirm
      const r = await authenticate(t.lockConfirm, t.cancel);
      if (r.ok) setSettings({ lockOn: v });
    } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Header title={t.lockTitle} sub={t.lockSub} onBack={onBack} />
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 12 }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: theme.ink }}>{t.lockUse}</Text>
            <Switch value={lockOn} onValueChange={toggle} disabled={busy} />
          </View>
        </Card>
        {lockOn ? (
          <>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.muted, paddingHorizontal: 4 }}>{t.lockAfter}</Text>
            {LOCK_DELAYS.map(d => (
              <Pressable key={d} accessibilityRole="radio" accessibilityState={{ selected: cur === d }} onPress={() => setSettings({ lockDelay: d })}
                style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderRadius: 16, backgroundColor: theme.card, borderWidth: cur === d ? 2 : 1, borderColor: cur === d ? theme.primary : theme.line }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: theme.ink }}>{n[d]}</Text>
                {cur === d ? <Text style={{ color: theme.primary, fontSize: 18, fontWeight: '700' }}>✓</Text> : null}
              </Pressable>
            ))}
            <Card><Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.lockDelayHelp}</Text></Card>
          </>
        ) : null}
        <Card><Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.lockHelp}</Text></Card>
      </ScrollView>
    </Screen>
  );
}
