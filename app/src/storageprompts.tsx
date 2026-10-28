import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { useApp } from './store';
import { deleteFiles, hasPublicFiles } from './files';
import { openAllFilesAccess } from './storageaccess';

// Two one-time questions after the start screen, shown only when there is a key:
// 1. Use the folder Download/Direct? (needs Android's "all files access", Android 11 or later)
// 2. Delete files that an earlier install left in Download/Direct? (Android keeps that folder when an app is uninstalled)
export function StoragePrompts() {
  const { ready, identity, t, publicStorage, storagePrompted, orphanAsked, contacts, setSettings } = useApp();
  const open = useRef(false); // one dialog at a time

  useEffect(() => {
    if (!ready || !identity || storagePrompted || publicStorage || open.current) return;
    if (Platform.OS !== 'android' || Number(Platform.Version) < 30) { setSettings({ storagePrompted: true }); return; }
    open.current = true;
    const done = (go: boolean) => { open.current = false; setSettings({ storagePrompted: true }); if (go) openAllFilesAccess(); };
    Alert.alert(t.spotPromptTitle, t.spotPromptBody, [
      { text: t.laterBtn, style: 'cancel', onPress: () => done(false) },
      { text: t.spotGrant, onPress: () => done(true) },
    ], { cancelable: false });
  }, [ready, identity, storagePrompted, publicStorage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready || !identity || orphanAsked || !publicStorage || open.current) return;
    // A phone that already has contacts is an ongoing install, and its files belong to it.
    if (Object.keys(contacts).length > 0 || !hasPublicFiles()) { setSettings({ orphanAsked: true }); return; }
    open.current = true;
    const done = (del: boolean) => { open.current = false; if (del) deleteFiles(); setSettings({ orphanAsked: true }); };
    Alert.alert(t.orphanTitle, t.orphanBody, [
      { text: t.orphanKeep, style: 'cancel', onPress: () => done(false) },
      { text: t.orphanDelete, style: 'destructive', onPress: () => done(true) },
    ], { cancelable: false });
  }, [ready, identity, orphanAsked, publicStorage, contacts]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
