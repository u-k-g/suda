// @ts-nocheck -- loaded as a classic script in content-script and extension-page contexts.

const ThemeManager = {
  defaultTheme: "arc-dark",

  get themes() {
    return globalThis.SudaThemeCatalog || [];
  },

  get(themeId) {
    return this.themes.find((theme) => theme.id === themeId) ||
      this.themes.find((theme) => theme.id === this.defaultTheme);
  },

  apply(themeId, root = globalThis.document?.documentElement) {
    const theme = this.get(themeId);
    if (!theme || !root) return;

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
      "--gruvbox-yellow": theme.accent,
      "--gruvbox-yellow-bright": theme.yellow,
      "--gruvbox-orange": theme.orange,
      "--gruvbox-red": theme.red,
      "--gruvbox-green": theme.green,
      "--gruvbox-green-bright": theme.green,
      "--gruvbox-aqua": theme.accent,
      "--gruvbox-blue": theme.accent,
      "--gruvbox-purple": theme.accent,
      "--suda-background-color": theme.background,
      "--suda-background-text-color": theme.foreground,
      "--suda-foreground-color": theme.surface,
      "--suda-foreground-text-color": theme.foreground,
      "--suda-link-color": theme.accent,
      "--suda-border-color": theme.border,
      "--suda-muted-color": theme.muted,
      "--suda-error-color": theme.red,
      "--suda-color-scheme": theme.mode,
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
