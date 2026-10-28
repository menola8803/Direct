import React, { useRef } from 'react';
import { Pressable, Vibration, View } from 'react-native';
import { useApp } from './store';
import { Btn, Text } from './ui';
import { useToast } from './toast';

// One way of testing things in Settings, the same everywhere:
//   tap         -> a box explains how the test works
//   press+hold  -> the test runs; a box says "Testing…", then OK or Not working, and fades away by itself.
export type TestResult = { ok: boolean; detail?: string };
export type Res = number | null | undefined; // ms, null = failed, undefined = not tested

export function useTestBox() {
  const { t } = useApp();
  const toast = useToast();
  const busy = useRef(false);
  const help = (title: string, body: string) => toast.show({ kind: 'info', title, detail: body }, 7000);
  const run = async (what: string, fn: () => Promise<TestResult>): Promise<TestResult | null> => {
    if (busy.current) return null; // one test at a time
    busy.current = true; Vibration.vibrate(25);
    toast.show({ kind: 'busy', title: t.boxTesting, detail: what });
    let r: TestResult;
    try { r = await fn(); } catch { r = { ok: false }; }
    busy.current = false;
    toast.show({ kind: r.ok ? 'ok' : 'fail', title: r.ok ? t.boxOk : t.boxFail, detail: r.detail }, 2500);
    return r;
  };
  return { help, run, node: toast.node };
}

// A button that is a test: tap for help, hold to run.
export function TestBtn({ title, onHelp, onTest, kind = 'secondary' }: { title: string; onHelp: () => void; onTest: () => void; kind?: 'primary' | 'secondary' }) {
  const { t } = useApp();
  return <Btn title={title} kind={kind} hint={t.holdHintBtn} onPress={onHelp} onLongPress={onTest} />;
}

// A server in a list: ✓/✗ marker, address (tap = help, hold = test) and a delete button.
export function TestRow({ label, sub, res, noAnswer, helpText, testLabel, onHelp, onTest, onDelete }: {
  label: string; sub?: string; res: Res; noAnswer: string; helpText: string; testLabel: string;
  onHelp: () => void; onTest: () => void; onDelete: () => void;
}) {
  const { theme, t } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
      <Text style={{ width: 22, fontSize: 16, color: res === undefined ? theme.muted : res === null ? theme.danger : theme.good }}>{res === undefined ? '•' : res === null ? '✗' : '✓'}</Text>
      <Pressable
        style={{ flex: 1, paddingVertical: 6 }}
        delayLongPress={500}
        onPress={onHelp}
        onLongPress={onTest}
        accessibilityRole="button"
        accessibilityHint={helpText}
        accessibilityActions={[{ name: 'test', label: testLabel }]}
        onAccessibilityAction={onTest}>
        <Text style={{ fontSize: 14, color: theme.ink }}>{label}</Text>
        {res === null || res !== undefined || sub ? <Text style={{ fontSize: 12, color: theme.muted }}>{res === null ? noAnswer : res !== undefined ? `${res} ms` : sub}</Text> : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t.delete} onPress={onDelete} hitSlop={8}
        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.line }}>
        <Text style={{ color: theme.danger, fontWeight: '600' }}>{t.delete}</Text>
      </Pressable>
    </View>
  );
}
