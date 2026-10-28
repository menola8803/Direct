import React from 'react';
import { StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';

// Wide-tracked text that is centered exactly. The native letterSpacing adds space after the last letter
// as well (and platforms differ), so wordmarks drift to one side. Here every letter is its own Text with
// gaps only BETWEEN letters, so the block is always centered, and with `justify` it stretches to the
// width of its parent (for a tagline under a wordmark: both then start and end at the same edges).
export function Spaced({ text, spacing, style, justify = false, wordGap, containerStyle }: {
  text: string; spacing: number; style: TextStyle; justify?: boolean; wordGap?: number; containerStyle?: StyleProp<ViewStyle>;
}) {
  const word = wordGap ?? (style.fontSize ?? 14) * 0.55;
  const kids: React.ReactNode[] = [];
  let pendingWord = false;
  Array.from(text).forEach((ch, i) => {
    if (/\s/.test(ch)) { pendingWord = kids.length > 0; return; }
    if (kids.length > 0) {
      const base = spacing + (pendingWord ? word : 0);
      kids.push(<View key={`g${i}`} style={justify ? { flexBasis: base, flexGrow: pendingWord ? 3 : 1 } : { width: base }} />);
    }
    pendingWord = false;
    kids.push(<Text key={`c${i}`} style={[style, { letterSpacing: 0 }]} allowFontScaling={false}>{ch}</Text>);
  });
  return (
    <View
      accessible accessibilityLabel={text}
      importantForAccessibility="yes"
      style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, containerStyle]}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: justify ? 'space-between' : 'center' }, justify ? { flexGrow: 1 } : null]}>
        {kids}
      </View>
    </View>
  );
}
