// Opens Android's own settings pages for storage access and for uninstalling the app.
import { Linking } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import { holdLock } from './lockhold';

const pkg = () => Constants.expoConfig?.android?.package ?? 'se.sncab.direct';

// "Allow management of all files" for Direct (Android 11 or later). Needed to create the folder Download/Direct.
export async function openAllFilesAccess() {
  holdLock();
  try { await IntentLauncher.startActivityAsync('android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION', { data: `package:${pkg()}` }); }
  catch {
    try { await IntentLauncher.startActivityAsync('android.settings.MANAGE_ALL_FILES_ACCESS_PERMISSION'); }
    catch { Linking.openSettings().catch(() => {}); }
  }
}

// Android's own "Do you want to uninstall this app?" dialog. If it cannot be opened, the app info page is shown instead.
export async function startUninstall() {
  holdLock();
  try { await IntentLauncher.startActivityAsync('android.intent.action.DELETE', { data: `package:${pkg()}` }); }
  catch { Linking.openSettings().catch(() => {}); }
}
