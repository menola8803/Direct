import React from 'react';
import { Pressable, StyleSheet, Text as RNText, TextInput as RNTextInput, TextInputProps, TextProps, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from './store';
import { Theme } from './theme';
import { Spaced } from './spaced';

// Text and TextInput that pick the theme's font family from fontWeight (custom fonts need one family per weight).
function familyFor(theme: Theme, weight: unknown, explicit?: string) {
  if (explicit) return explicit;
  const w = String(weight ?? '400');
  const f = theme.fonts;
  return w === '700' || w === 'bold' ? f.bold : w === '800' || w === '900' ? f.extrabold : w === '600' ? f.semibold : w === '500' ? f.medium : f.regular;
}
export function Text({ style, ...rest }: TextProps) {
  const { theme } = useApp();
  const f = StyleSheet.flatten(style) ?? {};
  const fam = familyFor(theme, f.fontWeight, f.fontFamily);
  return <RNText {...rest} style={[style, fam ? { fontFamily: fam, fontWeight: undefined } : null]} />;
}
export function TextInput({ style, ...rest }: TextInputProps) {
  const { theme } = useApp();
  const f = StyleSheet.flatten(style) ?? {};
  const fam = familyFor(theme, f.fontWeight, f.fontFamily);
  return <RNTextInput {...rest} style={[style, fam ? { fontFamily: fam, fontWeight: undefined } : null]} />;
}

// Screen frame that never ends up under the Android status bar or gesture bar.
export function Screen({ children, bottom = true }: { children: React.ReactNode; bottom?: boolean }) {
  const { theme } = useApp();
  const i = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: i.top + 12, paddingBottom: bottom ? i.bottom + 12 : 0, paddingHorizontal: 16, gap: 14 }}>
      {children}
    </View>
  );
}

export function H1({ children, size = 28 }: { children: React.ReactNode; size?: number }) {
  const { theme } = useApp();
  return <Text style={{ fontFamily: theme.fonts.heading, fontWeight: '600', fontSize: size, color: theme.ink, letterSpacing: -0.4 }}>{children}</Text>;
}
export function Sub({ children }: { children: React.ReactNode }) {
  const { theme } = useApp();
  return <Text style={{ fontSize: 14, color: theme.muted, marginTop: 2 }}>{children}</Text>;
}
export function Label({ children, color }: { children: React.ReactNode; color?: string }) {
  const { theme } = useApp();
  return <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: color ?? theme.accent }}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { theme } = useApp();
  return <View style={[{ backgroundColor: theme.card, borderColor: theme.line, borderWidth: 1, borderRadius: 22, padding: 16, gap: 14 }, style]}>{children}</View>;
}

export function Btn({ title, onPress, onLongPress, hint, kind = 'primary' }: { title: string; onPress: () => void; onLongPress?: () => void; hint?: string; kind?: 'primary' | 'secondary' | 'danger' }) {
  const { theme } = useApp();
  const bg = kind === 'primary' ? theme.primary : theme.card;
  const fg = kind === 'primary' ? theme.onPrimary : kind === 'danger' ? theme.danger : theme.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityHint={hint} onPress={onPress} onLongPress={onLongPress} delayLongPress={500}
      style={({ pressed }) => ({ minHeight: 52, borderRadius: 16, backgroundColor: bg, opacity: pressed ? 0.85 : 1, alignItems: 'center', justifyContent: 'center', borderWidth: kind === 'primary' ? 0 : 1, borderColor: kind === 'danger' ? theme.danger : theme.line })}>
      <Text style={{ color: fg, fontSize: 16, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function SmallBtn({ title, onPress, tone }: { title: string; onPress: () => void; tone?: 'accent' }) {
  const { theme } = useApp();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: theme.chip, borderWidth: tone === 'accent' ? 1 : 0, borderColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: tone === 'accent' ? theme.accent : theme.ink, fontWeight: '600', fontSize: 14 }}>{title}</Text>
    </Pressable>
  );
}

export function Avatar({ name, size = 44, ring }: { name: string; size?: number; ring?: string }) {
  const { theme } = useApp();
  const ini = name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <View style={{ width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, borderWidth: 2, borderColor: ring ?? theme.line, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.chip, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.accent, fontFamily: theme.fonts.heading, fontWeight: '600', fontSize: size / 3 }}>{ini}</Text>
      </View>
    </View>
  );
}

export function Header({ title, sub, onBack }: { title: string; sub?: string; onBack: () => void }) {
  const { theme, t } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable accessibilityLabel={t.back} accessibilityRole="button" onPress={onBack}
        style={{ width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.muted, fontSize: 22 }}>‹</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <H1 size={22}>{title}</H1>
        {sub ? <Sub>{sub}</Sub> : null}
      </View>
    </View>
  );
}

export function Row({ title, sub, right, onPress, danger }: { title: string; sub?: string; right?: string; onPress?: () => void; danger?: boolean }) {
  const { theme } = useApp();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: danger ? theme.danger : theme.ink }}>{title}</Text>
        {sub ? <Text style={{ fontSize: 13, color: theme.muted }}>{sub}</Text> : null}
      </View>
      {right ? <Text style={{ fontSize: 13, fontWeight: '600', color: theme.muted }}>{right}</Text> : <Text style={{ color: theme.muted, fontSize: 18 }}>›</Text>}
    </Pressable>
  );
}

export function TabBar({ tab, setTab }: { tab: 'chats' | 'contacts' | 'settings'; setTab: (t: 'chats' | 'contacts' | 'settings') => void }) {
  const { theme, t } = useApp();
  const items: ['chats' | 'contacts' | 'settings', string][] = [['chats', t.tabChats], ['contacts', t.tabContacts], ['settings', t.tabSettings]];
  return (
    <View style={{ flexDirection: 'row', gap: 4, backgroundColor: theme.card, borderColor: theme.line, borderWidth: 1, borderRadius: 22, padding: 6 }}>
      {items.map(([k, label]) => (
        <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)}
          style={{ flex: 1, minHeight: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: tab === k ? theme.chip : 'transparent' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: tab === k ? theme.tabActive : theme.muted }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// Small preview of a theme (used in the theme picker).
export function ThemePreview({ th }: { th: Theme }) {
  return (
    <View style={{ width: 120, height: 200, borderRadius: 16, backgroundColor: th.bg, borderWidth: 1, borderColor: th.line, padding: 10, gap: 8 }}>
      <View style={{ height: 10, width: 60, borderRadius: 5, backgroundColor: th.ink }} />
      <View style={{ height: 34, borderRadius: 10, backgroundColor: th.card, borderWidth: 1, borderColor: th.line }} />
      <View style={{ height: 22, width: 80, borderRadius: 10, backgroundColor: th.card, borderWidth: 1, borderColor: th.line }} />
      <View style={{ height: 22, width: 70, borderRadius: 10, backgroundColor: th.bubbleMine, alignSelf: 'flex-end' }} />
      <View style={{ flex: 1 }} />
      <View style={{ height: 28, borderRadius: 10, backgroundColor: th.primary }} />
    </View>
  );
}

export const styles = StyleSheet.create({ fill: { flex: 1 } });


// Branded page header (Dark theme): ring logo and the wordmark with the tagline under it.
// The whole group is centered in the card; the tagline is stretched to the width of DIRECT.
export function BrandHeader({ tagline }: { tagline: string }) {
  const { theme } = useApp();
  if (theme.name !== 'dark') return <H1>Direct</H1>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: '#162B2E', borderRadius: 24, borderWidth: 1, borderColor: '#2D322B', paddingVertical: 16, paddingHorizontal: 16 }}>
      <View style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#8A6D2E', alignItems: 'center', justifyContent: 'center' }}>
          <RNText style={{ color: theme.primary, fontFamily: theme.fonts.display, fontSize: 22, lineHeight: 26, textAlign: 'center', includeFontPadding: false }}>D</RNText>
        </View>
      </View>
      <View style={{ alignItems: 'stretch', gap: 5 }}>
        <Spaced text="DIRECT" spacing={7} justify style={{ color: theme.primary, fontFamily: theme.fonts.display, fontSize: 34, lineHeight: 40 }} />
        <Spaced text={`— ${tagline} —`} spacing={1} justify style={{ color: theme.accent, fontFamily: theme.fonts.bold, fontSize: 10 }} />
      </View>
    </View>
  );
}
