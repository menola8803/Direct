import React from 'react';
import { View } from 'react-native';
import { Text } from '../ui';
import { useApp } from '../store';

// The invite flow as a picture: who does what, in which order, and what travels between the two phones.
// Used on the "Invite and connect" page of the getting-started guide. Plain views and text, so it follows the theme,
// the language and the width of the phone.

type Who = 'A' | 'B';

export default function InviteFlow() {
  const { theme, t } = useApp();
  const accent = theme.accent;

  const Pill = ({ who }: { who: Who }) => (
    <View style={{ minWidth: 26, height: 22, paddingHorizontal: 7, borderRadius: 11, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.chip, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.ink }}>{who}</Text>
    </View>
  );
  const Num = ({ n }: { n: number }) => (
    <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: accent, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: accent }}>{n}</Text>
    </View>
  );
  const box = { backgroundColor: theme.card, borderColor: theme.line, borderWidth: 1, borderRadius: 18, padding: 12 } as const;

  // One step. A's steps sit to the left and B's to the right, so the zigzag shows who is acting.
  const Step = ({ who, n, title, sub }: { who: Who; n: number; title: string; sub: string }) => (
    <View accessible accessibilityLabel={`${who === 'A' ? t.flA : t.flB}. ${n}. ${title}. ${sub}`}
      style={[box, { width: '90%', alignSelf: who === 'A' ? 'flex-start' : 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
      <Num n={n} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.ink }}>{title}</Text>
        <Text style={{ fontSize: 13, lineHeight: 18, color: theme.muted }}>{sub}</Text>
      </View>
      <Pill who={who} />
    </View>
  );
  // What happens between two steps: an arrow, and when something is sent, what and in which direction.
  const Link = ({ label, dir }: { label?: string; dir?: string }) => (
    <View accessible={!!label} accessibilityLabel={label} importantForAccessibility={label ? 'yes' : 'no-hide-descendants'} accessibilityElementsHidden={!label}
      style={{ alignItems: 'center', paddingVertical: 4, gap: 2 }}>
      {label ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', borderWidth: 1, borderColor: accent, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: accent }}>{dir}</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: accent }}>{label}</Text>
        </View>
      ) : null}
      <Text style={{ fontSize: 16, lineHeight: 18, color: accent }}>↓</Text>
    </View>
  );
  const Way = ({ head, lines }: { head: string; lines: string[] }) => (
    <View style={{ borderWidth: 1, borderColor: theme.line, borderRadius: 14, padding: 12, gap: 3, backgroundColor: theme.chip }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: theme.primary }}>{head}</Text>
      {lines.map((l, i) => <Text key={i} style={{ fontSize: 13, lineHeight: 19, color: theme.ink }}>{l}</Text>)}
    </View>
  );

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 10 }}>
        {([['A', t.flA, t.flAs], ['B', t.flB, t.flBs]] as [Who, string, string][]).map(([w, name, sub]) => (
          <View key={w} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pill who={w} />
            <Text style={{ fontSize: 13, color: theme.muted }}><Text style={{ fontWeight: '700', color: theme.ink }}>{name}</Text> · {sub}</Text>
          </View>
        ))}
      </View>

      <Step who="A" n={1} title={t.fl1t} sub={t.fl1s} />
      <Link dir="A → B" label={t.flSms1} />
      <Step who="B" n={2} title={t.fl2t} sub={t.fl2s} />
      <Link />
      <Step who="B" n={3} title={t.fl3t} sub={t.fl3s} />
      <Link />
      <Step who="B" n={4} title={t.fl4t} sub={t.fl4s} />
      <Link dir="B → A" label={t.flSms2} />
      <Step who="A" n={5} title={t.fl5t} sub={t.fl5s} />
      <Link />

      <View style={[box, { gap: 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Num n={6} />
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: theme.ink }}>{t.fl6t}</Text>
        </View>
        <Way head={t.fl6a} lines={[t.fl6a1, t.fl6a2, t.fl6a3]} />
        <Way head={t.fl6b} lines={[t.fl6b1, t.fl6b2, t.fl6b3]} />
      </View>
      <Link />

      <View accessible style={[box, { borderColor: theme.good, borderWidth: 1.5, alignItems: 'center', gap: 2 }]}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: theme.good }}>{t.encryptedDirect}</Text>
        <Text style={{ fontSize: 13, lineHeight: 18, color: theme.ink, textAlign: 'center' }}>{t.flDone}</Text>
      </View>

      <Text style={{ marginTop: 12, fontSize: 14, lineHeight: 20, fontWeight: '600', color: accent, textAlign: 'center' }}>{t.flWarn}</Text>
    </View>
  );
}
