const ThemeManager = {
  defaultTheme: "arc-dark",

  get themeSpecs() {
    return globalThis.SudaThemeCatalog || [];
  },

  get themes() {
    return this.themeSpecs.map((theme) => this.resolveTheme(theme));
  },

  getSpec(themeId) {
    return this.themeSpecs.find((theme) => theme.id === themeId) ||
      this.themeSpecs.find((theme) => theme.id === this.defaultTheme);
  },

  get(themeId) {
    const spec = this.getSpec(themeId);
    return spec ? this.resolveTheme(spec) : null;
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

  rgbToHsl(rgb) {
    const [r, g, b] = rgb.map((channel) => channel / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const lightness = (max + min) / 2;
    if (delta === 0) return [0, 0, lightness];

    let hue = max === r
      ? ((g - b) / delta) % 6
      : max === g
      ? ((b - r) / delta) + 2
      : ((r - g) / delta) + 4;
    hue = ((hue * 60) + 360) % 360;
    const saturation = delta / (1 - Math.abs((2 * lightness) - 1));
    return [hue, saturation, lightness];
  },

  hslToRgb([hue, saturation, lightness]) {
    const chroma = (1 - Math.abs((2 * lightness) - 1)) * saturation;
    const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
    const offset = lightness - (chroma / 2);
    const channels = hue < 60
      ? [chroma, x, 0]
      : hue < 120
      ? [x, chroma, 0]
      : hue < 180
      ? [0, chroma, x]
      : hue < 240
      ? [0, x, chroma]
      : hue < 300
      ? [x, 0, chroma]
      : [chroma, 0, x];
    return channels.map((channel) => (channel + offset) * 255);
  },

  // Mixes `hex` with `targetHex`; weight is the fraction of `hex` retained.
  mixHexColors(hex, targetHex, weight) {
    const a = this.hexToRgb(hex);
    const b = this.hexToRgb(targetHex);
    return this.rgbToHex(a.map((channel, i) => channel * weight + b[i] * (1 - weight)));
  },

  // Picks a readable text color to place on top of a fill of color `hex`.
  contrastColorOn(hex) {
    const [r, g, b] = this.hexToRgb(hex).map((channel) => {
      channel /= 255;
      return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    const luminance = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
    const whiteContrast = 1.05 / (luminance + 0.05);
    const darkContrast = (luminance + 0.05) / 0.055;
    return whiteContrast >= darkContrast ? "#ffffff" : "#1d1d1f";
  },

  contrastRatio(firstHex, secondHex) {
    const luminance = (hex) => {
      const [r, g, b] = this.hexToRgb(hex).map((channel) => {
        channel /= 255;
        return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
      });
      return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
    };
    const values = [luminance(firstHex), luminance(secondHex)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  },

  ensureContrast(foreground, background, minimumRatio) {
    if (this.contrastRatio(foreground, background) >= minimumRatio) return foreground;
    const target = this.contrastColorOn(background) === "#ffffff" ? "#ffffff" : "#000000";
    let passingColor = target;
    let low = 0;
    let high = 1;
    // Find the smallest visual adjustment which meets the requested contrast ratio.
    for (let i = 0; i < 12; i++) {
      const retainedForeground = (low + high) / 2;
      const candidate = this.mixHexColors(foreground, target, retainedForeground);
      if (this.contrastRatio(candidate, background) >= minimumRatio) {
        passingColor = candidate;
        low = retainedForeground;
      } else {
        high = retainedForeground;
      }
    }
    return passingColor;
  },

  // Terminal palettes provide strong base colors but do not define application surfaces. Derive
  // those roles consistently instead of treating an arbitrary ANSI color as a panel background.
  resolveTheme(spec) {
    const baseForeground = this.ensureContrast(spec.foreground, spec.background, 4.5);
    const surface = spec.surface ??
      this.mixHexColors(baseForeground, spec.background, spec.surfaceWeight ?? 0.07);
    const foreground = this.ensureContrast(baseForeground, surface, 4.5);
    const border = spec.border ??
      this.mixHexColors(foreground, spec.background, spec.borderWeight ?? 0.18);
    const mutedCandidate = spec.muted ??
      this.mixHexColors(foreground, spec.background, spec.mutedWeight ?? 0.58);
    const muted = this.ensureContrast(mutedCandidate, surface, 3);
    return { ...spec, foreground, surface, border, muted };
  },

  isAccentCustomizable(themeOrId) {
    const theme = typeof themeOrId === "string" ? this.get(themeOrId) : themeOrId;
    return theme?.customizableAccent === true;
  },

  // Honor a custom accent only when the selected theme declares that capability.
  accentFor(theme, accentColor = null) {
    if (!this.isAccentCustomizable(theme)) return theme.accent;
    return this.normalizeHexColor(accentColor) || theme.accent;
  },

  // Tonal-selection themes retain the accent hue while calming bright colors for filled rows.
  accentSelectionFor(theme, accent) {
    if (!theme.tonalSelection) return accent;
    const [hue, saturation, lightness] = this.rgbToHsl(this.hexToRgb(accent));
    const selectedSaturation = Math.min(saturation, 0.67);
    const selectedLightness = Math.min(0.30, Math.max(0.24, lightness * 0.43));
    return this.rgbToHex(this.hslToRgb([hue, selectedSaturation, selectedLightness]));
  },

  apply(themeId, root = globalThis.document?.documentElement, accentColor = null) {
    const theme = this.get(themeId);
    if (!theme || !root) return;

    const accent = this.accentFor(theme, accentColor);
    const accentSelection = this.accentSelectionFor(theme, accent);
    const accentContrast = this.contrastColorOn(accent);
    const accentSelectedContrast = this.contrastColorOn(accentSelection);
    const accentText = theme.mode === "dark"
      ? this.mixHexColors(accent, "#ffffff", 0.68)
      : this.mixHexColors(accent, "#000000", 0.55);
    const overlay = this.mixHexColors(
      accent,
      theme.background,
      theme.overlayAccentWeight ?? 0,
    );
    const overlayBorder = this.mixHexColors(
      accent,
      theme.border,
      theme.overlayBorderAccentWeight ?? 0,
    );
    const properties = {
      // The semantic theme contract used by all built-in Suda UI.
      "--suda-canvas-color": theme.background,
      "--suda-surface-color": theme.surface,
      "--suda-surface-subtle-color": this.mixHexColors(theme.surface, theme.background, 0.55),
      "--suda-surface-hover-color": this.mixHexColors(accent, theme.surface, 0.10),
      "--suda-overlay-color": overlay,
      "--suda-overlay-border-color": overlayBorder,
      "--suda-text-color": theme.foreground,
      "--suda-muted-color": theme.muted,
      "--suda-border-color": theme.border,
      "--suda-accent-color": accent,
      "--suda-accent-contrast-color": accentContrast,
      "--suda-accent-selected-color": accentSelection,
      "--suda-accent-selected-text-color": accentSelectedContrast,
      "--suda-accent-subtle-color": this.mixHexColors(accent, theme.background, 0.18),
      "--suda-accent-text-color": accentText,
      "--suda-danger-color": theme.danger,
      "--suda-danger-subtle-color": this.mixHexColors(theme.danger, theme.background, 0.18),
      "--suda-warning-color": theme.warning,
      "--suda-success-color": theme.success,
      "--suda-success-contrast-color": this.contrastColorOn(theme.success),
      "--suda-color-scheme": theme.mode,

      // Compatibility aliases for existing user CSS. Built-in styles use only the semantic tokens
      // above; these aliases can be removed in a future breaking release.
      "--suda-background-color": theme.background,
      "--suda-background-text-color": theme.foreground,
      "--suda-foreground-color": theme.surface,
      "--suda-foreground-text-color": theme.foreground,
      "--suda-link-color": accentText,
      "--suda-error-color": theme.danger,
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
      "--gruvbox-yellow-bright": accent,
      "--gruvbox-orange": theme.warning,
      "--gruvbox-red": theme.danger,
      "--gruvbox-green": theme.success,
      "--gruvbox-green-bright": theme.success,
      "--gruvbox-aqua": accent,
      "--gruvbox-blue": accent,
      "--gruvbox-purple": accent,
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
