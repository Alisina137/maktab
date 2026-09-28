export const tokens = {
  color: {
    canvas: "#f7f8fb",
    surface: "#ffffff",
    surfaceMuted: "#eef2f7",
    text: "#172033",
    textMuted: "#64748b",
    border: "#d8e0ea",
    brand: "#265dcb",
    brandStrong: "#1d4ca8",
    success: "#198754",
    warning: "#b7791f",
    danger: "#c0392b",
    focus: "#7aa2ff"
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 18,
    pill: 999
  },
  shadow: {
    card: "0 10px 30px rgba(23, 32, 51, 0.08)"
  },
  typography: {
    family: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    size: {
      sm: 13,
      md: 15,
      lg: 18,
      xl: 24,
      xxl: 34
    },
    lineHeight: {
      compact: 1.25,
      normal: 1.5,
      relaxed: 1.7
    }
  }
} as const;

export const designTokenCss = `
:root {
  --ml-color-canvas: ${tokens.color.canvas};
  --ml-color-surface: ${tokens.color.surface};
  --ml-color-surface-muted: ${tokens.color.surfaceMuted};
  --ml-color-text: ${tokens.color.text};
  --ml-color-text-muted: ${tokens.color.textMuted};
  --ml-color-border: ${tokens.color.border};
  --ml-color-brand: ${tokens.color.brand};
  --ml-color-brand-strong: ${tokens.color.brandStrong};
  --ml-color-success: ${tokens.color.success};
  --ml-color-warning: ${tokens.color.warning};
  --ml-color-danger: ${tokens.color.danger};
  --ml-color-focus: ${tokens.color.focus};
  --ml-radius-sm: ${tokens.radius.sm}px;
  --ml-radius-md: ${tokens.radius.md}px;
  --ml-radius-lg: ${tokens.radius.lg}px;
  --ml-shadow-card: ${tokens.shadow.card};
  --ml-font-family: ${tokens.typography.family};
}`;
