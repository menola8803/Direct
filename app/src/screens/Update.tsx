import React, { useState } from 'react';
import { Linking, Text } from 'react-native';
import Constants from 'expo-constants';
import { useApp } from '../store';
import { isNewer, latestRelease, Release } from '../update';
import { Btn, Card, Header, Screen } from '../ui';

export default function Update({ onBack }: { onBack: () => void }) {
  const { theme, t } = useApp();
  const cur = Constants.expoConfig?.version ?? '0.0.0';
  const [msg, setMsg] = useState(''); const [rel, setRel] = useState<Release | null>(null); const [busy, setBusy] = useState(false);
  const check = async () => {
    setBusy(true); setRel(null); setMsg(t.checking);
    try {
      const r = await latestRelease();
      if (!r) setMsg(t.noRelease);
      else if (isNewer(r.tag, cur)) { setRel(r); setMsg(`${t.newVersion}: ${r.tag}`); }
      else setMsg(t.upToDate);
    } catch { setMsg(t.updateFail); }
    setBusy(false);
  };
  return (
    <Screen>
      <Header title={t.update} sub={t.updateSub} onBack={onBack} />
      <Card><Text style={{ color: theme.ink }}>{t.version} {cur}</Text>{msg ? <Text style={{ color: theme.muted }}>{msg}</Text> : null}</Card>
      <Btn title={busy ? t.checking : t.checkUpdate} onPress={check} />
      {rel ? <Btn title={t.download} kind="secondary" onPress={() => Linking.openURL(rel.apk ?? rel.page).catch(() => {})} /> : null}
    </Screen>
  );
}
