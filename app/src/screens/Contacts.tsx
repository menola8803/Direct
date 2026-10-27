import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, Text, TextInput, View } from 'react-native';
import * as Contacts from 'expo-contacts';
import { Person, useApp } from '../store';
import { Avatar, Btn, H1, Sub, SmallBtn } from '../ui';

export const DEMO: Person = { id: 'demo-anna', name: 'Anna Lindqvist', demo: true };

export default function ContactsScreen({ onOpen }: { onOpen: (p: Person) => void }) {
  const { theme, t, blocked, block } = useApp();
  const [list, setList] = useState<Person[]>([]);
  const [denied, setDenied] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const r = await Contacts.requestPermissionsAsync();
    if (r.status !== 'granted') { setDenied(true); return; }
    setDenied(false);
    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers], sort: Contacts.SortTypes.FirstName });
    setList(data.filter(c => c.name && c.phoneNumbers?.length).map(c => ({ id: c.id ?? c.name!, name: c.name!, phone: c.phoneNumbers![0].number })));
  }, []);
  useEffect(() => { load().catch(() => setDenied(true)); }, [load]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [DEMO, ...list].filter(p => !blocked[p.id] && (!s || p.name.toLowerCase().includes(s)));
  }, [list, q, blocked]);

  const menu = (p: Person) => Alert.alert(p.name, undefined, [
    { text: t.block, style: 'destructive', onPress: () => Alert.alert(t.blockTitle, t.blockBody, [{ text: t.cancel, style: 'cancel' }, { text: t.block, style: 'destructive', onPress: () => block(p) }]) },
    { text: t.cancel, style: 'cancel' },
  ]);
  const invite = (p: Person) => Linking.openURL(`sms:${p.phone ?? ''}?body=${encodeURIComponent(t.inviteText)}`).catch(() => {});

  return (
    <View style={{ flex: 1, gap: 12 }}>
      <View><H1>{t.contacts}</H1><Sub>{t.contactsSub}</Sub></View>
      <TextInput value={q} onChangeText={setQ} placeholder={t.search} placeholderTextColor={theme.muted}
        style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card, paddingHorizontal: 16, fontSize: 15, color: theme.ink }} />
      <Text style={{ fontSize: 12, color: theme.muted, paddingHorizontal: 4 }}>{t.hold}</Text>
      {denied ? (
        <View style={{ gap: 10 }}><Text style={{ color: theme.muted }}>{t.contactsDenied}</Text><Btn title={t.allowContacts} kind="secondary" onPress={() => load().catch(() => {})} /></View>
      ) : null}
      <FlatList data={shown} keyExtractor={p => p.id} contentContainerStyle={{ gap: 4, paddingBottom: 8 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => (item.demo ? onOpen(item) : invite(item))} onLongPress={() => menu(item)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 }}>
            <Avatar name={item.name} ring={item.demo ? theme.good : theme.line} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink }}>{item.name}</Text>
              <Text style={{ fontSize: 13, color: theme.muted }}>{item.demo ? t.demoContact : item.phone}</Text>
            </View>
            {item.demo ? null : <SmallBtn title={t.invite} tone="accent" onPress={() => invite(item)} />}
          </Pressable>
        )} />
    </View>
  );
}
