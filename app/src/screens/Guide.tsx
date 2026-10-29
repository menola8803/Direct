import React, { useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Text } from '../ui';
import { useApp } from '../store';
import { LangChoice } from '../i18n';
import { Btn, Card, Screen } from '../ui';
import InviteFlow from './InviteFlow';

// Getting-started guide. Shown once after the first start (then the key is created), and any time from
// Settings. Pages: welcome and language, create the key, invite and connect, what you can do, conference calls, good to know.

const PAGES = 6;

export default function Guide({ first, onClose }: { first?: boolean; onClose: () => void }) {
  const { theme, t, langChoice, setLang } = useApp();
  const { width } = useWindowDimensions();
  const w = width - 32; // the Screen frame has 16 px on each side
  const scroller = useRef<any>(null); // ScrollView instance
  const [page, setPage] = useState(0);
  const last = page === PAGES - 1;

  const go = (i: number) => { const n = Math.max(0, Math.min(PAGES - 1, i)); setPage(n); scroller.current?.scrollTo({ x: n * w, animated: true }); };
  const settled = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / w));

  const body = { fontSize: 15, lineHeight: 23, color: theme.muted } as const;
  const title = { fontFamily: theme.fonts.heading, fontWeight: '600', fontSize: 28, lineHeight: 33, color: theme.ink, letterSpacing: -0.5 } as const;

  const Steps = ({ items }: { items: string[] }) => (
    <Card>
      {items.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: theme.accent, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.accent }}>{i + 1}</Text>
          </View>
          <Text style={{ flex: 1, fontSize: 15, lineHeight: 22, color: theme.ink }}>{s}</Text>
        </View>
      ))}
    </Card>
  );
  const Feature = ({ icon, head, text }: { icon: string; head: string; text: string }) => (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.chip, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.ink }}>{head}</Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: theme.muted }}>{text}</Text>
      </View>
    </View>
  );
  const langs: [LangChoice, string][] = [['system', t.phoneLang], ['sv', t.swedish], ['en', t.english]];
  const pageStyle = { width: w };
  const scrollStyle = { gap: 14, paddingBottom: 8 };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
        <Text accessibilityLiveRegion="polite" style={{ fontSize: 13, fontWeight: '700', color: theme.muted, letterSpacing: 0.5 }}>{t.guideTitle} · {page + 1} / {PAGES}</Text>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10} style={{ paddingVertical: 8, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.accent }}>{first ? t.guideSkip : t.guideDone}</Text>
        </Pressable>
      </View>

      <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={settled} style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        <View style={pageStyle}>
          <ScrollView contentContainerStyle={scrollStyle} showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: 'center', paddingTop: 8 }}>
              <View style={{ width: 104, height: 104, borderRadius: 52, borderWidth: 3, borderColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: theme.primary, fontFamily: theme.fonts.display, fontSize: 44, lineHeight: 52, textAlign: 'center', includeFontPadding: false }}>D</Text>
                </View>
              </View>
            </View>
            <Text style={[title, { textAlign: 'center' }]}>{t.g1t}</Text>
            <Text style={[body, { textAlign: 'center' }]}>{t.g1b}</Text>
            <Card>
              <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: theme.accent }}>{t.guideLang}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {langs.map(([k, label]) => (
                  <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: langChoice === k }} onPress={() => setLang(k)}
                    style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: langChoice === k ? theme.chip : 'transparent', borderWidth: langChoice === k ? 2 : 1, borderColor: langChoice === k ? theme.primary : theme.line }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.ink }}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>{t.g1c}</Text>
            </Card>
          </ScrollView>
        </View>

        <View style={pageStyle}>
          <ScrollView contentContainerStyle={scrollStyle} showsVerticalScrollIndicator={false}>
            <Text style={title}>{t.g2t}</Text>
            <Steps items={[t.g2a, t.g2b, t.g2c]} />
            <Text style={body}>{t.g2d}</Text>
          </ScrollView>
        </View>

        <View style={pageStyle}>
          <ScrollView contentContainerStyle={scrollStyle} showsVerticalScrollIndicator={false}>
            <Text style={title}>{t.g3t}</Text>
            <InviteFlow />
            <Card>
              {[t.g3b, t.g3d].map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                  <Text style={{ color: theme.accent, fontSize: 15, lineHeight: 22 }}>•</Text>
                  <Text style={{ flex: 1, fontSize: 15, lineHeight: 22, color: theme.ink }}>{s}</Text>
                </View>
              ))}
            </Card>
          </ScrollView>
        </View>

        <View style={pageStyle}>
          <ScrollView contentContainerStyle={scrollStyle} showsVerticalScrollIndicator={false}>
            <Text style={title}>{t.g4t}</Text>
            <Card>
              <Feature icon="💬" head={t.g4chat} text={t.g4chatb} />
              <Feature icon="📎" head={t.g4file} text={t.g4fileb} />
              <Feature icon="📞" head={t.g4voice} text={t.g4voiceb} />
              <Feature icon="📹" head={t.g4video} text={t.g4videob} />
              <Feature icon="🎙" head={t.g4rec} text={t.g4recb} />
              <Feature icon="🎥" head={t.g4vrec} text={t.g4vrecb} />
              <Feature icon="👥" head={t.g4conf} text={t.g4confb} />
            </Card>
          </ScrollView>
        </View>

        <View style={pageStyle}>
          <ScrollView contentContainerStyle={scrollStyle} showsVerticalScrollIndicator={false}>
            <Text style={title}>{t.gcT}</Text>
            <Steps items={[t.gc1, t.gc2, t.gc3, t.gc4, t.gc5]} />
            <Text style={body}>{t.gcN}</Text>
          </ScrollView>
        </View>

        <View style={pageStyle}>
          <ScrollView contentContainerStyle={scrollStyle} showsVerticalScrollIndicator={false}>
            <Text style={title}>{t.g5t}</Text>
            <Card>
              {[t.g5a, t.g5b, t.g5c, t.g5d, t.g5e].map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                  <Text style={{ color: theme.accent, fontSize: 15, lineHeight: 22 }}>•</Text>
                  <Text style={{ flex: 1, fontSize: 15, lineHeight: 22, color: theme.ink }}>{s}</Text>
                </View>
              ))}
            </Card>
          </ScrollView>
        </View>
      </ScrollView>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: PAGES }, (_, i) => (
          <View key={i} style={{ width: i === page ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === page ? theme.primary : theme.line }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {page > 0 ? <View style={{ flex: 1 }}><Btn title={t.guideBack} kind="secondary" onPress={() => go(page - 1)} /></View> : null}
        <View style={{ flex: 2 }}>
          <Btn title={last ? (first ? t.guideStart : t.guideDone) : t.guideNext} onPress={() => (last ? onClose() : go(page + 1))} />
        </View>
      </View>
    </Screen>
  );
}
