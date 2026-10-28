import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, Linking, View } from 'react-native';
import { useFonts } from 'expo-font';
import { PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { cardFromUrl } from './src/core/invite';
import Invite from './src/screens/Invite';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './src/net/random';
import { AppProvider, useApp } from './src/store';
import { NetProvider } from './src/net/net';
import { Route } from './src/nav';
import { Screen, TabBar } from './src/ui';
import Welcome from './src/screens/Welcome';
import Guide from './src/screens/Guide';
import Chats from './src/screens/Chats';
import ContactsScreen from './src/screens/Contacts';
import Settings from './src/screens/Settings';
import Chat from './src/screens/Chat';
import ThemePicker from './src/screens/ThemePicker';
import LanguagePicker from './src/screens/LanguagePicker';
import Blocked from './src/screens/Blocked';
import About from './src/screens/About';
import MyCode from './src/screens/MyCode';
import AddContact from './src/screens/AddContact';
import Verify from './src/screens/Verify';
import Connection from './src/screens/Connection';
import Update from './src/screens/Update';
import StunServers from './src/screens/StunServers';
import TurnServers from './src/screens/TurnServers';
import Privacy from './src/screens/Privacy';
import ManualPair from './src/screens/ManualPair';
import Conference from './src/screens/Conference';
import MediaTest from './src/screens/MediaTest';
import Storage from './src/screens/Storage';
import CallScreen from './src/screens/CallScreen';
import Splash from './src/screens/Splash';
import { useNet } from './src/net/net';

function Content() {
  const { ready, identity, introSeen, setSettings } = useApp();
  const { call } = useNet();
  const [stack, setStack] = useState<Route[]>([{ name: 'tabs' }]);
  const [pending, setPending] = useState<string | null>(null);
  const [tab, setTab] = useState<'chats' | 'contacts' | 'settings'>('chats');
  const push = useCallback((r: Route) => setStack(s => [...s, r]), []);
  const pop = useCallback(() => setStack(s => (s.length > 1 ? s.slice(0, -1) : s)), []);

  // Invite links (direct://add?c=… or the web invite page) open the app on the invite screen.
  useEffect(() => {
    const take = (u?: string | null) => { const c = u ? cardFromUrl(u) : null; if (c) setPending(c); };
    Linking.getInitialURL().then(take).catch(() => {});
    const sub = Linking.addEventListener('url', e => take(e.url));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (pending && identity && ready) { push({ name: 'invite', card: pending }); setPending(null); }
  }, [pending, identity, ready, push]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) { pop(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, pop]);

  if (!ready) return <View style={{ flex: 1 }} />;
  // First start after install: the guide, then the screen where the key is created.
  if (!identity) return introSeen ? <Welcome /> : <Guide first onClose={() => setSettings({ introSeen: true })} />;
  if (call.status !== 'idle') return <CallScreen />;

  const r = stack[stack.length - 1];
  switch (r.name) {
    case 'chat': return <Screen><Chat id={r.id} onBack={pop} onVerify={() => push({ name: 'verify', id: r.id })} onPair={() => push({ name: 'pair', id: r.id })} /></Screen>;
    case 'verify': return <Verify id={r.id} onBack={pop} onRemoved={() => setStack([{ name: 'tabs' }])} />;
    case 'pair': return <ManualPair id={r.id} onBack={pop} />;
    case 'conference': return <Conference onBack={pop} />;
    case 'mediatest': return <MediaTest onBack={pop} />;
    case 'storage': return <Storage onBack={pop} />;
    case 'invite': return <Invite card={r.card} onBack={pop} onOpenChat={id => setStack(st => [...st.slice(0, -1), { name: 'chat', id }])} />;
    case 'mycode': return <MyCode onBack={pop} />;
    case 'add': return <AddContact onBack={pop} onAdded={id => setStack(s => [...s.slice(0, -1), { name: 'chat', id }])} />;
    case 'connection': return <Connection onBack={pop} />;
    case 'stun': return <StunServers onBack={pop} />;
    case 'turn': return <TurnServers onBack={pop} />;
    case 'privacy': return <Privacy onBack={pop} go={push} />;
    case 'update': return <Update onBack={pop} />;
    case 'theme': return <ThemePicker onBack={pop} />;
    case 'language': return <LanguagePicker onBack={pop} />;
    case 'blocked': return <Blocked onBack={pop} />;
    case 'guide': return <Guide onClose={pop} />;
    case 'about': return <About onBack={pop} />;
    default:
      return (
        <Screen>
          <View style={{ flex: 1 }}>
            {tab === 'chats' && <Chats onOpen={id => push({ name: 'chat', id })} />}
            {tab === 'contacts' && <ContactsScreen onOpen={id => push({ name: 'chat', id })} go={push} />}
            {tab === 'settings' && <Settings go={push} />}
          </View>
          <TabBar tab={tab} setTab={setTab} />
        </Screen>
      );
  }
}

// Fonts and saved state load first (on the same dark color as the native start screen),
// then the animated start screen plays on top of the app while it gets ready.
function Root() {
  const { ready } = useApp();
  const [fontsLoaded] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, Cinzel_700Bold });
  const [splashDone, setSplashDone] = useState(false);
  if (!ready || !fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#0B1416' }} />;
  return (
    <View style={{ flex: 1 }}>
      <Content />
      {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
    </View>
  );
}

function Themed() {
  const { theme } = useApp();
  return (<><StatusBar style={theme.dark ? 'light' : 'dark'} /><Root /></>);
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider><NetProvider><Themed /></NetProvider></AppProvider>
    </SafeAreaProvider>
  );
}
