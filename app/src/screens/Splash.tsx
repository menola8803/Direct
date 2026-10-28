import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { useApp } from '../store';
import { Spaced } from '../spaced';

// Start screen. Always dark, whatever theme is chosen.
// Designed on a 390 x 844 canvas and scaled to the screen (see design "Direct startbild").
// Everything that moves is a plain transform/opacity animation on the native driver,
// except the ring that draws itself (stroke offset, JS driver, runs once).

const W0 = 390;
const H0 = 844;
const SHOW_MS = 3300;
const SHOW_REDUCED_MS = 1200;
const FADE_MS = 450;
const MIN_SKIP_MS = 700;

const C = {
  bg: '#0B1416', teal: '#17393E', panel: '#132225', line: '#2A4448',
  gold: '#E8B04A', goldDim: '#8A6D2E', goldPale: '#F3D9A0', mint: '#5FC4B4',
  ink: '#B7C6C3', dim: '#8FA5A2', red: '#E8776D',
};
const DISPLAY = 'Cinzel_700Bold';
const SANS = 'PlusJakartaSans_700Bold';

type Ease = (t: number) => number;

// One-off entrance 0 -> 1.
function useEntrance(delay: number, duration: number, reduce: boolean, native = true) {
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    const a = Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}

// Endless loop: 'repeat' runs 0 -> 1 and starts over, 'pingpong' runs 0 -> 1 -> 0.
function useLoop(kind: 'repeat' | 'pingpong', duration: number, delay: number, reduce: boolean, easing: Ease = Easing.linear) {
  const v = useRef(new Animated.Value(reduce ? 0.5 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    const step = kind === 'repeat'
      ? Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: true })
      : Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]);
    const a = Animated.sequence([Animated.delay(delay), Animated.loop(step)]);
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}

// Highlight that lights one feature button for ~0.8 s every 3 s.
function usePulse(delay: number, reduce: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const cycle = Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(300),
      Animated.timing(v, { toValue: 0, duration: 240, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay(2220),
    ]);
    const a = Animated.sequence([Animated.delay(delay), Animated.loop(cycle)]);
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}

const lerp = (v: Animated.Value, from: number, to: number) => v.interpolate({ inputRange: [0, 1], outputRange: [from, to] });

// ---- Background: a faint network where packets travel straight from node to node ----

const STARS: [number, number, number, number][] = [
  [36, 84, 2.4, 0], [122, 52, 2, 600], [214, 104, 2.6, 1200], [318, 62, 2, 300], [356, 150, 2.4, 1800], [70, 176, 2.2, 900],
  [30, 724, 2.4, 1500], [104, 808, 2, 400], [196, 752, 2.6, 2100], [290, 820, 2, 1000], [362, 736, 2.4, 1700],
];
const EDGES = 'M36 84L122 52L214 104L318 62L356 150M36 84L70 176L214 104M30 724L104 808L196 752L290 820L362 736M30 724L196 752L362 736';

function Star({ x, y, r, delay, reduce }: { x: number; y: number; r: number; delay: number; reduce: boolean }) {
  const v = useLoop('pingpong', 3200, delay, reduce);
  return <Animated.View style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: C.mint, opacity: lerp(v, 0.25, 0.85) }} />;
}

function Packet({ from, to, duration, delay, color, size, reduce }: { from: [number, number]; to: [number, number]; duration: number; delay: number; color: string; size: number; reduce: boolean }) {
  const v = useLoop('repeat', duration, delay, reduce);
  if (reduce) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: size / 2, backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ translateX: lerp(v, from[0] - size / 2, to[0] - size / 2) }, { translateY: lerp(v, from[1] - size / 2, to[1] - size / 2) }],
      }}
    />
  );
}

function Network({ reduce }: { reduce: boolean }) {
  const fade = useEntrance(100, 800, reduce);
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: fade }]}>
      <Svg width={W0} height={H0} style={StyleSheet.absoluteFill}>
        <Path d={EDGES} stroke={C.mint} strokeOpacity={0.16} strokeWidth={1} fill="none" />
      </Svg>
      {STARS.map(([x, y, r, d], i) => <Star key={i} x={x} y={y} r={r} delay={d} reduce={reduce} />)}
      <Packet from={[70, 176]} to={[214, 104]} duration={3400} delay={0} color={C.gold} size={6} reduce={reduce} />
      <Packet from={[362, 736]} to={[196, 752]} duration={4200} delay={1100} color={C.gold} size={6} reduce={reduce} />
      <Packet from={[30, 724]} to={[196, 752]} duration={3800} delay={2000} color={C.gold} size={6} reduce={reduce} />
    </Animated.View>
  );
}

// ---- Logo: ring that draws itself, D, two peers orbiting, ripples ----

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING_LEN = 2 * Math.PI * 56;

function Ripple({ delay, color, reduce }: { delay: number; color: string; reduce: boolean }) {
  const v = useLoop('repeat', 3400, delay, reduce, Easing.out(Easing.quad));
  if (reduce) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: 137, top: 234, width: 116, height: 116, borderRadius: 58, borderWidth: 1.5, borderColor: color,
        opacity: lerp(v, 0.5, 0), transform: [{ scale: lerp(v, 1, 2.7) }],
      }}
    />
  );
}

function Peer({ left, top, color }: { left: number; top: number; color: string }) {
  return (
    <>
      <View style={{ position: 'absolute', left: left - 7, top: top - 7, width: 28, height: 28, borderRadius: 14, backgroundColor: color, opacity: 0.22 }} />
      <View style={{ position: 'absolute', left, top, width: 14, height: 14, borderRadius: 7, backgroundColor: color }} />
    </>
  );
}

function Logo({ reduce }: { reduce: boolean }) {
  const pop = useEntrance(50, 700, reduce);
  const draw = useEntrance(150, 1000, reduce, false);
  const inner = useEntrance(500, 800, reduce);
  const orbit = useLoop('repeat', 9000, 0, reduce);
  return (
    <Animated.View style={{ position: 'absolute', left: 115, top: 212, width: 160, height: 160, opacity: pop, transform: [{ scale: lerp(pop, 0.82, 1) }] }}>
      <Svg width={160} height={160}>
        <AnimatedCircle
          cx={80} cy={80} r={56} stroke={C.gold} strokeWidth={3.5} strokeLinecap="round" fill="none"
          strokeDasharray={`${RING_LEN} ${RING_LEN}`} strokeDashoffset={lerp(draw, RING_LEN, 0)}
          rotation={-90} origin="80, 80"
        />
      </Svg>
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: 160, height: 160, alignItems: 'center', justifyContent: 'center', opacity: inner }}>
        <View style={{ position: 'absolute', left: 34, top: 34, width: 92, height: 92, borderRadius: 46, borderWidth: 1.2, borderColor: C.goldDim }} />
        <Text style={{ fontFamily: DISPLAY, fontSize: 46, lineHeight: 56, color: C.gold, textAlign: 'center', includeFontPadding: false }}>D</Text>
      </Animated.View>
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: 160, height: 160, transform: [{ rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
        <Peer left={73} top={17} color={C.mint} />
        <Peer left={73} top={129} color={C.goldPale} />
      </Animated.View>
    </Animated.View>
  );
}

function Wordmark({ tagline, reduce }: { tagline: string; reduce: boolean }) {
  const v = useEntrance(550, 700, reduce);
  return (
    <Animated.View style={{ position: 'absolute', left: 0, top: 384, width: W0, alignItems: 'center', opacity: v, transform: [{ translateY: lerp(v, 16, 0) }] }}>
      {/* The block is as wide as the wider of the two lines. Both are stretched to that width, so they read as one block centered on the logo. */}
      <View style={{ alignItems: 'stretch', gap: 12 }}>
        <Spaced text="DIRECT" spacing={10} justify style={{ fontFamily: DISPLAY, fontSize: 42, lineHeight: 50, color: C.gold, textShadowColor: 'rgba(232,176,74,0.3)', textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 } }} />
        <Spaced text={`— ${tagline} —`} spacing={2} justify style={{ fontFamily: SANS, fontSize: 11, color: C.mint }} />
      </View>
    </Animated.View>
  );
}

// ---- Voice, video, conference ----

function Bar({ x, h, delay, reduce }: { x: number; h: number; delay: number; reduce: boolean }) {
  const v = useLoop('pingpong', 1100, delay, reduce);
  return <Animated.View style={{ position: 'absolute', left: x, top: 18 - h / 2, width: 4, height: h, borderRadius: 2, backgroundColor: C.mint, transform: [{ scaleY: lerp(v, 0.3, 1) }] }} />;
}

function VoiceIcon({ reduce }: { reduce: boolean }) {
  const bars: [number, number, number][] = [[2, 12, 0], [9, 22, 180], [16, 30, 360], [23, 20, 120], [30, 14, 300]];
  return <View style={{ width: 36, height: 36 }}>{bars.map(([x, h, d], i) => <Bar key={i} x={x} h={h} delay={d} reduce={reduce} />)}</View>;
}

function VideoIcon({ reduce }: { reduce: boolean }) {
  const v = useLoop('repeat', 1200, 0, reduce);
  return (
    <View style={{ width: 38, height: 36 }}>
      <Svg width={38} height={36} viewBox="0 0 38 36">
        <G fill="none" stroke={C.gold} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
          <Rect x={2.5} y={8.5} width={22} height={19} rx={5} />
          <Path d="M24.5 15.5L35 9.5V26.5L24.5 20.5Z" />
        </G>
      </Svg>
      <Animated.View style={{ position: 'absolute', left: 7.5, top: 13, width: 4, height: 4, borderRadius: 2, backgroundColor: C.red, opacity: reduce ? 1 : v.interpolate({ inputRange: [0, 0.55, 0.7, 1], outputRange: [1, 1, 0.15, 0.15] }) }} />
    </View>
  );
}

function Node({ x, y, delay, reduce }: { x: number; y: number; delay: number; reduce: boolean }) {
  const v = useLoop('pingpong', 1800, delay, reduce);
  return <Animated.View style={{ position: 'absolute', left: x - 5, top: y - 5, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: C.mint, backgroundColor: C.bg, transform: [{ scale: lerp(v, 1, 1.35) }] }} />;
}

function ConferenceIcon({ reduce }: { reduce: boolean }) {
  const nodes: [number, number, number][] = [[8, 8, 0], [28, 8, 450], [28, 28, 900], [8, 28, 1350]];
  return (
    <View style={{ width: 36, height: 36 }}>
      <Svg width={36} height={36} viewBox="0 0 36 36">
        <Path d="M8 8H28V28H8ZM8 8L28 28M28 8L8 28" stroke={C.mint} strokeOpacity={0.55} strokeWidth={1.4} fill="none" />
      </Svg>
      {nodes.map(([x, y, d], i) => <Node key={i} x={x} y={y} delay={d} reduce={reduce} />)}
    </View>
  );
}

function Feature({ x, label, enter, glow, reduce, children }: { x: number; label: string; enter: number; glow: number; reduce: boolean; children: React.ReactNode }) {
  const ent = useEntrance(enter, 700, reduce);
  const lab = useEntrance(enter + 400, 800, reduce);
  const pulse = usePulse(glow, reduce);
  return (
    <>
      <Animated.View style={{ position: 'absolute', left: x, top: 520, width: 72, height: 72, opacity: ent, transform: [{ translateY: lerp(ent, 16, 0) }] }}>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -14, top: -14, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(232,176,74,0.05)', opacity: pulse, transform: [{ scale: lerp(pulse, 0.9, 1.2) }] }} />
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -6, top: -6, width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(232,176,74,0.10)', opacity: pulse, transform: [{ scale: lerp(pulse, 0.95, 1.15) }] }} />
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: C.gold, opacity: pulse }} />
      </Animated.View>
      <Animated.View style={{ position: 'absolute', left: x + 36 - 54, top: 606, width: 108, alignItems: 'center', opacity: lab }}>
        <Spaced text={label} spacing={2} style={{ fontFamily: SANS, fontSize: 10.5, color: C.ink }} />
      </Animated.View>
    </>
  );
}

function Connectors({ reduce }: { reduce: boolean }) {
  const fade = useEntrance(1200, 800, reduce);
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: fade }]}>
      <Svg width={W0} height={H0} style={StyleSheet.absoluteFill}>
        <Path d="M123 556H159M231 556H267" stroke={C.line} strokeWidth={1.5} />
      </Svg>
      <Packet from={[123, 556]} to={[159, 556]} duration={2200} delay={0} color={C.gold} size={5.6} reduce={reduce} />
      <Packet from={[267, 556]} to={[231, 556]} duration={2200} delay={1100} color={C.mint} size={5.6} reduce={reduce} />
    </Animated.View>
  );
}

function Encrypted({ text, reduce }: { text: string; reduce: boolean }) {
  const v = useEntrance(1500, 800, reduce);
  return (
    <Animated.View style={{ position: 'absolute', left: 0, top: 668, width: W0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: v }}>
      <Svg width={12} height={14} viewBox="0 0 12 14">
        <G fill="none" stroke={C.dim} strokeWidth={1.5} strokeLinejoin="round">
          <Rect x={1.5} y={6} width={9} height={7} rx={1.8} />
          <Path d="M3.5 6V4.2a2.5 2.5 0 0 1 5 0V6" />
        </G>
      </Svg>
      <Spaced text={text} spacing={2.2} style={{ fontFamily: SANS, fontSize: 10, color: C.dim }} containerStyle={{ marginLeft: 8 }} />
    </Animated.View>
  );
}

// ---- Screen ----

export default function Splash({ onDone }: { onDone: () => void }) {
  const { t } = useApp();
  const { width: W, height: H } = useWindowDimensions();
  const [reduce, setReduce] = useState<boolean | null>(null);
  const fade = useRef(new Animated.Value(1)).current;
  const closing = useRef(false);
  const born = useRef(Date.now());
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then(r => live && setReduce(!!r)).catch(() => live && setReduce(false));
    return () => { live = false; };
  }, []);

  const finish = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(fade, { toValue: 0, duration: FADE_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => done.current());
  }, [fade]);

  useEffect(() => {
    if (reduce === null) return;
    const timer = setTimeout(finish, reduce ? SHOW_REDUCED_MS : SHOW_MS);
    return () => clearTimeout(timer);
  }, [reduce, finish]);

  const s = Math.min(W / W0, H / H0, 1.3);
  const top0 = (H - H0 * s) / 2;
  const r = reduce === true;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade, backgroundColor: C.bg, zIndex: 100, elevation: 100 }]}>
      <StatusBar style="light" />
      <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (Date.now() - born.current > MIN_SKIP_MS) finish(); }}>
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="glowTop" cx={W / 2} cy={top0 + 278 * s} r={330 * s} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={C.teal} stopOpacity="1" />
              <Stop offset="1" stopColor={C.teal} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="glowBottom" cx={W / 2} cy={H + 17 * s} r={260 * s} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={C.gold} stopOpacity="0.13" />
              <Stop offset="1" stopColor={C.gold} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={W} height={H} fill={C.bg} />
          <Rect x={0} y={0} width={W} height={H} fill="url(#glowTop)" />
          <Rect x={0} y={0} width={W} height={H} fill="url(#glowBottom)" />
        </Svg>
        {reduce !== null && (
          <View style={{ position: 'absolute', left: (W - W0) / 2, top: (H - H0) / 2, width: W0, height: H0, transform: [{ scale: s }] }}>
            <Network reduce={r} />
            <Ripple delay={0} color={C.mint} reduce={r} />
            <Ripple delay={1700} color={C.gold} reduce={r} />
            <Logo reduce={r} />
            <Wordmark tagline={t.tagline} reduce={r} />
            <Connectors reduce={r} />
            <Feature x={51} label={t.splashVoice} enter={800} glow={1300} reduce={r}><VoiceIcon reduce={r} /></Feature>
            <Feature x={159} label={t.splashVideo} enter={950} glow={2000} reduce={r}><VideoIcon reduce={r} /></Feature>
            <Feature x={267} label={t.splashConference} enter={1100} glow={2700} reduce={r}><ConferenceIcon reduce={r} /></Feature>
            <Encrypted text={t.splashEncrypted} reduce={r} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
