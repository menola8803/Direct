import React from 'react';
import { StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';

// Wide-tracked text that is centered exactly. The native letterSpacing adds space after the last letter
// as well (and platforms differ), so wordmarks drift to one side. Here every letter is its own Text with
// fixed gaps only BETWEEN letters, so the block is as wide as its content and always centered.
// (No flex-grow tricks: Yoga on Android lets those fill the whole parent, which spread the letters out.)
export function Spaced({ text, spacing, style, wordGap, containerStyle }: {
  text: string; spacing: number; style: TextStyle; wordGap?: number; containerStyle?: StyleProp<ViewStyle>;
}) {
  const word = wordGap ?? (style.fontSize ?? 14) * 0.55;
  const kids: React.ReactNode[] = [];
  let pendingWord = false;
  Array.from(text).forEach((ch, i) => {
    if (/\s/.test(ch)) { pendingWord = kids.length > 0; return; }
    if (kids.length > 0) kids.push(<View key={`g${i}`} style={{ width: spacing + (pendingWord ? word : 0) }} />);
    pendingWord = false;
    kids.push(<Text key={`c${i}`} style={[style, { letterSpacing: 0 }]} allowFontScaling={false}>{ch}</Text>);
  });
  return (
    <View accessible accessibilityLabel={text} importantForAccessibility="yes" style={[{ alignSelf: 'center' }, containerStyle]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'center' }}>
        {kids}
      </View>
    </View>
  );
}
