export const theme = {
  color: {
    background: "#071A1B",
    surface: "#0D3331",
    surfaceRaised: "#164844",
    primary: "#F4C96B",
    primaryStrong: "#D6A74B",
    accent: "#64D6B4",
    danger: "#F06B5D",
    text: "#F7F3E8",
    textMuted: "#A9C4BD",
    outline: "#2C5A55",
    overlay: "#031010D9",
  },
  radius: {
    small: 10,
    medium: 16,
    large: 24,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  motionMs: {
    fast: 120,
    normal: 220,
    slow: 360,
  },
} as const;

export type ThemeColor = keyof typeof theme.color;
