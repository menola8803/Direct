import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/store';
import { Route } from './src/nav';
import { Screen, TabBar } from './src/ui';
import Welcome from './src/screens/Welcome';
import Chats from './src/screens/Chats';
import ContactsScreen from './src/screens/Contacts';
import Settings from './src/screens/Settings';
import Chat from './src/screens/Chat';
import ThemePicker from './src/screens/ThemePicker';
import LanguagePicker from './src/screens/LanguagePicker';
import Blocked from './src/screens/Blocked';
import About from './src/screens/About';

function Root() {
  const { ready, profile, theme } = useApp();
  const [stack, setStack] = useState<Route[]>([{ name: 'tabs' }]);
  const [tab, setTab] = useState<'chats' | 'contacts' | 'settings'>('chats');
  const push = useCallback((r: Route) => setStack(s => [...s, r]), []);
  const pop = useCallback(() => setStack(s => (s.length > 1 ? s.slice(0, -1) : s)), []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) { pop(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, pop]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  if (!profile) return <Welcome />;

  const r = stack[stack.length - 1];
  switch (r.name) {
    case 'chat': return <Screen><Chat person={r.person} onBack={pop} /></Screen>;
    case 'theme': return <ThemePicker onBack={pop} />;
    case 'language': return <LanguagePicker onBack={pop} />;
    case 'blocked': return <Blocked onBack={pop} />;
    case 'about': return <About onBack={pop} />;
    default:
      return (
        <Screen>
          <View style={{ flex: 1 }}>
            {tab === 'chats' && <Chats onOpen={p => push({ name: 'chat', person: p })} />}
            {tab === 'contacts' && <ContactsScreen onOpen={p => push({ name: 'chat', person: p })} />}
            {tab === 'settings' && <Settings go={push} />}
          </View>
          <TabBar tab={tab} setTab={setTab} />
        </Screen>
      );
  }
}

function Themed() {
  const { theme } = useApp();
  return (<><StatusBar style={theme.dark ? 'light' : 'dark'} /><Root /></>);
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider><Themed /></AppProvider>
    </SafeAreaProvider>
  );
}
