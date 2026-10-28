import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Text, TextInput } from '../ui';
import { useApp } from '../store';
import { BACKUP_EXT, backupFileName, createBackup, passphraseProblem, readBackup } from '../core/backup';
import { readText, writeCacheText } from '../files';
import { holdLock } from '../lockhold';
import { Btn, Card, Header, Screen } from '../ui';

function useField() {
  const { theme } = useApp();
  return {
    style: { height: 52, borderWidth: 1, borderColor: theme.line, borderRadius: 14, paddingHorizontal: 16, fontSize: 17, color: theme.ink, backgroundColor: theme.bg } as const,
    ph: theme.muted,
    props: { secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false, autoComplete: 'off', importantForAutofill: 'no' } as const,
  };
}

// Choose a backup file and its passphrase, then put the key, contacts and conversations back.
// `replacing` is true when the app already holds data that the restore will replace (then it asks first).
export function RestoreCard({ replacing, onDone }: { replacing: boolean; onDone: () => void }) {
  const { theme, t, restoreBackup } = useApp();
  const f = useField();
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState('');

  const pick = async () => {
    setMsg(''); holdLock();
    const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false }).catch(() => null);
    const a = r && !r.canceled ? r.assets?.[0] : null;
    if (!a) return;
    try {
      if ((a.size ?? 0) > 50 * 1024 * 1024) { setMsg(t.bkBadFile); return; }
      setFile({ name: a.name, text: await readText(a.uri) });
    } catch { setMsg(t.bkReadFail); }
  };
  const run = async () => {
    if (!file || busy) return;
    setBusy(true); setPct(0); setMsg('');
    try {
      const r = await readBackup(file.text, pass, p => setPct(p));
      if (!r.ok) { setMsg(r.error === 'format' ? t.bkBadFile : r.error === 'passphrase' ? t.bkWrongPass : t.bkDamaged); return; }
      await restoreBackup(r.data);
      setFile(null); setPass('');
      Alert.alert(t.bkRestore, t.bkRestored);
      onDone();
    } catch { setMsg(t.bkReadFail); } finally { setBusy(false); }
  };
  const go = () => {
    if (!replacing) return run();
    Alert.alert(t.bkConfirmTitle, t.bkConfirm, [{ text: t.cancel, style: 'cancel' }, { text: t.bkConfirmGo, style: 'destructive', onPress: run }]);
  };

  return (
    <Card>
      <Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink }}>{t.bkRestore}</Text>
      <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.bkRestoreHelp}</Text>
      {file ? (
        <>
          <Text style={{ fontSize: 13, color: theme.muted }}>{t.bkPicked}: <Text style={{ color: theme.ink, fontWeight: '600' }}>{file.name}</Text></Text>
          <TextInput value={pass} onChangeText={setPass} placeholder={t.bkPassOpen} placeholderTextColor={f.ph} style={f.style} editable={!busy} {...f.props} />
          <Btn title={busy ? `${t.bkWorking} ${Math.round(pct * 100)}%` : t.bkOpen} onPress={go} />
          {busy ? <Text style={{ fontSize: 13, color: theme.muted }}>{t.bkWorkingNote}</Text> : <Btn title={t.bkOtherFile} kind="secondary" onPress={pick} />}
        </>
      ) : <Btn title={t.bkPick} kind="secondary" onPress={pick} />}
      {msg ? <Text style={{ color: theme.danger, lineHeight: 20 }}>{msg}</Text> : null}
    </Card>
  );
}

// Settings → Backup: create an encrypted backup file and share it, or restore one.
export default function Backup({ onBack }: { onBack: () => void }) {
  const { theme, t, getBackup } = useApp();
  const f = useField();
  const [pass, setPass] = useState(''); const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false); const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState(''); const [ok, setOk] = useState(false);

  const make = async () => {
    if (busy) return;
    setOk(false);
    const pr = passphraseProblem(pass);
    if (pr) { setMsg(pr === 'short' ? t.bkShort : t.bkSame); return; }
    if (pass !== again) { setMsg(t.bkMismatch); return; }
    const data = getBackup();
    if (!data) { setMsg(t.bkFail); return; }
    setMsg(''); setBusy(true); setPct(0);
    try {
      const text = await createBackup(data, pass, { onProgress: p => setPct(p) });
      const uri = await writeCacheText(backupFileName(new Date()), text);
      holdLock();
      await Sharing.shareAsync(uri, { mimeType: 'application/octet-stream', dialogTitle: t.bkMake });
      setPass(''); setAgain(''); setOk(true);
    } catch { setMsg(t.bkFail); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Header title={t.bkTitle} sub={t.bkSub} onBack={onBack} />
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink }}>{t.bkMake}</Text>
          <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.bkMakeHelp}</Text>
          <TextInput value={pass} onChangeText={setPass} placeholder={t.bkPass} placeholderTextColor={f.ph} style={f.style} editable={!busy} {...f.props} />
          <TextInput value={again} onChangeText={setAgain} placeholder={t.bkPass2} placeholderTextColor={f.ph} style={f.style} editable={!busy} {...f.props} />
          <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.bkPassHint}</Text>
          <Btn title={busy ? `${t.bkWorking} ${Math.round(pct * 100)}%` : t.bkCreate} onPress={make} />
          {busy ? <Text style={{ fontSize: 13, color: theme.muted }}>{t.bkWorkingNote}</Text> : null}
          {msg ? <Text style={{ color: theme.danger, lineHeight: 20 }}>{msg}</Text> : null}
          {ok ? <Text style={{ color: theme.good, lineHeight: 20 }}>{t.bkDone}</Text> : null}
        </Card>
        <RestoreCard replacing onDone={onBack} />
      </ScrollView>
    </Screen>
  );
}
export { BACKUP_EXT };
