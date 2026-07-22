// @ts-nocheck -- loaded as a classic script in content-script and extension-page contexts.

const ThemeManager = {
  defaultTheme: "arc-dark",
  // The Arc themes let the user personalize their accent color with a custom hex code.
  arcThemes: new Set(["arc-dark", "arc-light"]),

  get themes() {
    return globalThis.SudaThemeCatalog || [];
  },

  get(themeId) {
    return this.themes.find((theme) => theme.id === themeId) ||
      this.themes.find((theme) => theme.id === this.defaultTheme);
  },

  // Returns "#rrggbb" for a user-entered hex color, or null if it's malformed.
  normalizeHexColor(value) {
    if (typeof value !== "string") return null;
    const match = value.trim().match(/^#?([0-9a-fA-F]{6})$/);
    return match ? `#${match[1].toLowerCase()}` : null;
  },

  hexToRgb(hex) {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  },

  rgbToHex(rgb) {
    return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
  },

  // Mixes `hex` with `targetHex`; weight is the fraction of `hex` retained.
  mixHexColors(hex, targetHex, weight) {
    const a = this.hexToRgb(hex);
    const b = this.hexToRgb(targetHex);
    return this.rgbToHex(a.map((channel, i) => channel * weight + b[i] * (1 - weight)));
  },

  // Picks a readable text color to place on top of a fill of color `hex`.
  contrastColorOn(hex) {
    const [r, g, b] = this.hexToRgb(hex).map((channel) => channel / 255);
    const luminance = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
    return luminance > 0.55 ? "#1d1d1f" : "#ffffff";
  },

  // The accent color for a theme, honoring the user's custom hex color for the Arc themes.
  accentFor(theme, accentColor = null) {
    if (!this.arcThemes.has(theme.id)) return theme.accent;
    return this.normalizeHexColor(accentColor) || theme.accent;
  },

  apply(themeId, root = globalThis.document?.documentElement, accentColor = null) {
    const theme = this.get(themeId);
    if (!theme || !root) return;

    const accent = this.accentFor(theme, accentColor);
    const properties = {
      "--gruvbox-bg-hard": theme.background,
      "--gruvbox-bg": theme.surface,
      "--gruvbox-bg-soft": theme.surface,
      "--gruvbox-bg-1": theme.surface,
      "--gruvbox-bg-2": theme.border,
      "--gruvbox-fg": theme.foreground,
      "--gruvbox-white": theme.foreground,
      "--gruvbox-fg-muted": theme.muted,
      "--gruvbox-fg-dim": theme.muted,
      "--gruvbox-yellow": accent,
      "--gruvbox-yellow-bright": theme.yellow,
      "--gruvbox-orange": theme.orange,
      "--gruvbox-red": theme.red,
      "--gruvbox-green": theme.green,
      "--gruvbox-green-bright": theme.green,
      "--gruvbox-aqua": accent,
      "--gruvbox-blue": accent,
      "--gruvbox-purple": accent,
      "--suda-background-color": theme.background,
      "--suda-background-text-color": theme.foreground,
      "--suda-foreground-color": theme.surface,
      "--suda-foreground-text-color": theme.foreground,
      "--suda-link-color": accent,
      "--suda-border-color": theme.border,
      "--suda-muted-color": theme.muted,
      "--suda-error-color": theme.red,
      "--suda-color-scheme": theme.mode,
      "--suda-accent-color": accent,
      // Text/icons drawn on a solid accent fill, and accent-colored text drawn on the panel.
      "--suda-accent-contrast-color": this.contrastColorOn(accent),
      "--suda-accent-subtle-color": this.mixHexColors(accent, theme.background, 0.18),
      "--suda-accent-text-color": theme.mode === "dark"
        ? this.mixHexColors(accent, "#ffffff", 0.68)
        : this.mixHexColors(accent, "#000000", 0.55),
    };

    root.dataset.sudaTheme = theme.id;
    root.style.colorScheme = theme.mode;
    for (const [name, value] of Object.entries(properties)) root.style.setProperty(name, value);
  },
};

globalThis.ThemeManager = ThemeManager;

// Paint with the default palette immediately. Settings replaces this with the saved theme once
// storage has loaded, but CSS should never need its own hardcoded fallback palette in the meantime.
ThemeManager.apply(ThemeManager.defaultTheme);
