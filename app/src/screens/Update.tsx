import React, { useState } from 'react';
import { Linking, Platform } from 'react-native';
import { Text } from '../ui';
import { File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import { useApp } from '../store';
import { isNewer, latestRelease, Release } from '../update';
import { Btn, Card, Header, Screen } from '../ui';
import { holdLock } from '../lockhold';

export default function Update({ onBack }: { onBack: () => void }) {
  const { theme, t } = useApp();
  const cur = Constants.expoConfig?.version ?? '0.0.0';
  const [msg, setMsg] = useState(''); const [rel, setRel] = useState<Release | null>(null); const [busy, setBusy] = useState(false);
  const install = async () => {
    if (!rel?.apk) { holdLock(); return Linking.openURL(rel!.page).catch(() => {}); }
    setBusy(true); setMsg(t.downloading);
    try {
      const f = await File.downloadFileAsync(rel.apk, new File(Paths.cache, 'direct-update.apk'), { idempotent: true } as any);
      if (Platform.OS === 'android') {
        holdLock();
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: f.contentUri, flags: 1, type: 'application/vnd.android.package-archive' });
        setMsg(t.installAllow);
      } else Linking.openURL(rel.page).catch(() => {});
    } catch { setMsg(t.installFail); }
    setBusy(false);
  };
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
      {rel ? <Btn title={t.installUpdate} onPress={install} /> : null}
      {rel ? <Btn title={t.download} kind="secondary" onPress={() => { holdLock(); Linking.openURL(rel.page).catch(() => {}); }} /> : null}
    </Screen>
  );
}
