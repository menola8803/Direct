import { Platform } from 'react-native';

export type ThemeName = 'beige' | 'usb';

export type Theme = {
  name: ThemeName;
  label: string;
  dark: boolean;
  bg: string;
  card: string;
  chip: string;
  line: string;
  ink: string;
  muted: string;
  accent: string;
  primary: string;
  onPrimary: string;
  good: string;
  danger: string;
  bubbleMine: string;
  onBubbleMine: string;
};

// Färgerna motsvarar skärmdesignen i design/ (Beige och USB).
export const themes: Record<ThemeName, Theme> = {
  beige: {
    name: 'beige', label: 'Beige', dark: false,
    bg: '#EFEDE8', card: '#FAF8F4', chip: '#E9E2D3', line: '#DDD8CD',
    ink: '#26231F', muted: '#6A6358', accent: '#7A5C2B',
    primary: '#26231F', onPrimary: '#F3E9D2',
    good: '#2F6E4C', danger: '#A8403A',
    bubbleMine: '#DCCBA8', onBubbleMine: '#26231F',
  },
  usb: {
    name: 'usb', label: 'USB', dark: true,
    bg: '#0F1A1C', card: '#172629', chip: '#1E3236', line: '#25393D',
    ink: '#EAF1EF', muted: '#B7C6C3', accent: '#5FC4B4',
    primary: '#E8B04A', onPrimary: '#0F1A1C',
    good: '#5FC4B4', danger: '#E8776D',
    bubbleMine: '#4A3A18', onBubbleMine: '#EAF1EF',
  },
};

export const headingFont = Platform.select({ ios: 'Georgia', default: 'serif' });
