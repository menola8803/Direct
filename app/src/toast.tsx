import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './ui';
import { useApp } from './store';

// A small box at the bottom of the screen that shows a result and fades away by itself.
export type ToastData = { kind: 'info' | 'busy' | 'ok' | 'fail'; title: string; detail?: string };

export function useToast() {
  const [data, setData] = useState<ToastData | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(({ finished }) => { if (finished) setData(null); });
  }, [opacity]);
  // ms = how long it stays before fading; without ms it stays until the next show() or hide().
  const show = useCallback((d: ToastData, ms?: number) => {
    clearTimeout(timer.current);
    setData(d);
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    if (ms) timer.current = setTimeout(hide, ms);
  }, [opacity, hide]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return { show, hide, node: data ? <ToastBox data={data} opacity={opacity} /> : null };
}

function ToastBox({ data, opacity }: { data: ToastData; opacity: Animated.Value }) {
  const { theme } = useApp();
  const inset = useSafeAreaInsets().bottom;
  const color = data.kind === 'ok' ? theme.good : data.kind === 'fail' ? theme.danger : theme.accent;
  const mark = data.kind === 'ok' ? '✓' : data.kind === 'fail' ? '✗' : 'i';
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: 16, right: 16, bottom: inset + 24, opacity, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, borderWidth: 1.5, borderColor: color, backgroundColor: theme.card, elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}
    >
      <View style={{ width: 30, alignItems: 'center' }}>
        {data.kind === 'busy' ? <ActivityIndicator color={color} /> : <Text style={{ fontSize: 26, fontWeight: '700', color }}>{mark}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: data.kind === 'info' || data.kind === 'busy' ? theme.ink : color }}>{data.title}</Text>
        {data.detail ? <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted, marginTop: 2 }}>{data.detail}</Text> : null}
      </View>
    </Animated.View>
  );
}
