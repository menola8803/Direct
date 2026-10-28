import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, View } from 'react-native';
import { Text, TextInput } from '../ui';
import * as Contacts from 'expo-contacts/legacy';
import { Person, useApp } from '../store';
import { useNet } from '../net/net';
import { encodeCard } from '../core/crypto';
import { inviteMessage } from '../core/invite';
import { Route } from '../nav';
import { Avatar, Btn, H1, Sub, SmallBtn } from '../ui';
import { holdLock } from '../lockhold';

export default function ContactsScreen({ onOpen, go }: { onOpen: (id: string) => void; go: (r: Route) => void }) {
  const { theme, t, contacts, blocked, block, identity, name } = useApp();
  const { link } = useNet();
  const [book, setBook] = useState<Person[]>([]);
  const [denied, setDenied] = useState(false);
  const [failed, setFailed] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    holdLock();
    const r = await Contacts.requestPermissionsAsync();
    if (r.status !== 'granted') { setDenied(true); return; }
    setDenied(false); setFailed('');
    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers], sort: Contacts.SortTypes.FirstName });
    setBook(data.filter(c => c.name && c.phoneNumbers?.length).map(c => ({ id: c.id ?? c.name!, name: c.name!, phone: c.phoneNumbers![0].number })));
  }, []);
  useEffect(() => { load().catch(e => setFailed(String(e?.message ?? e))); }, [load]);

  const s = q.trim().toLowerCase();
  const mine = useMemo(() => Object.values(contacts).filter(c => !blocked[c.id] && (!s || c.name.toLowerCase().includes(s))).sort((a, b) => a.name.localeCompare(b.name)), [contacts, blocked, s]);
  const others = useMemo(() => book.filter(p => !s || p.name.toLowerCase().includes(s)), [book, s]);
  const data: ({ kind: 'h'; title: string } | { kind: 'c'; id: string } | { kind: 'p'; p: Person })[] = [
    { kind: 'h', title: t.inApp },
    ...mine.map(c => ({ kind: 'c' as const, id: c.id })),
    ...(mine.length === 0 ? [] : []),
    { kind: 'h', title: t.fromPhonebook },
    ...others.map(p => ({ kind: 'p' as const, p })),
  ];

  const menu = (id: string) => Alert.alert(contacts[id].name, undefined, [
    { text: t.block, style: 'destructive', onPress: () => Alert.alert(t.blockTitle, t.blockBody, [{ text: t.cancel, style: 'cancel' }, { text: t.block, style: 'destructive', onPress: () => block(id, contacts[id].name) }]) },
    { text: t.cancel, style: 'cancel' },
  ]);
  const invite = (p: Person) => {
    const body = identity ? inviteMessage(encodeCard(identity, name), t, name) : t.inviteText;
    holdLock();
    Linking.openURL(`sms:${p.phone ?? ''}?body=${encodeURIComponent(body)}`).catch(() => {});
  };

  return (
    <View style={{ flex: 1, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}><H1>{t.contacts}</H1><Sub>{t.contactsSub}</Sub></View>
        <SmallBtn title={t.myCode} onPress={() => go({ name: 'mycode' })} />
        <View style={{ width: 8 }} />
        <SmallBtn title={`+ ${t.add}`} tone="accent" onPress={() => go({ name: 'add' })} />
      </View>
      <TextInput value={q} onChangeText={setQ} placeholder={t.search} placeholderTextColor={theme.muted}
        style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card, paddingHorizontal: 16, fontSize: 15, color: theme.ink }} />
      {failed ? <Text style={{ color: theme.danger, fontSize: 13 }}>{t.contactsLoadFail} {failed.slice(0, 160)}</Text> : null}
      {denied ? (
        <View style={{ gap: 10 }}><Text style={{ color: theme.muted }}>{t.contactsDenied}</Text><Btn title={t.allowContacts} kind="secondary" onPress={() => load().catch(e => setFailed(String(e?.message ?? e)))} /></View>
      ) : null}
      <FlatList data={data} keyExtractor={(d, i) => (d.kind === 'h' ? 'h' + i : d.kind === 'c' ? d.id : 'p' + d.p.id)} contentContainerStyle={{ gap: 4, paddingBottom: 8 }}
        renderItem={({ item }) => {
          if (item.kind === 'h') return <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1, color: theme.muted, marginTop: 10, textTransform: 'uppercase' }}>{item.title}</Text>;
          if (item.kind === 'c') {
            const c = contacts[item.id];
            return (
              <Pressable onPress={() => onOpen(c.id)} onLongPress={() => menu(c.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 }}>
                <Avatar name={c.name} ring={link[c.id] === 'open' ? theme.good : theme.line} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink }}>{c.name}</Text>
                  <Text style={{ fontSize: 13, color: theme.muted }}>{link[c.id] === 'open' ? t.online : link[c.id] === 'connecting' ? t.connecting : t.offline}{c.verified ? ` · ${t.verified}` : ''}</Text>
                </View>
              </Pressable>
            );
          }
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 }}>
              <Avatar name={item.p.name} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink }}>{item.p.name}</Text>
                <Text style={{ fontSize: 13, color: theme.muted }}>{item.p.phone}</Text>
              </View>
              <SmallBtn title={t.invite} tone="accent" onPress={() => invite(item.p)} />
            </View>
          );
        }} />
      {mine.length === 0 ? <Text style={{ color: theme.muted, fontSize: 13 }}>{t.noContactsYet}</Text> : null}
    </View>
  );
}
