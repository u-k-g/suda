// @ts-nocheck -- global-script theme modules are exercised in the unit-test environment.
import "../../lib/theme_catalog.js";
import "../../lib/themes.js";

context("themes", () => {
  should("include the complete imported catalog and curated themes", () => {
    assert.equal(31, ThemeManager.themes.length);
    const names = new Set(ThemeManager.themes.map((theme) => theme.name));
    for (
      const name of [
        "Gruvbox",
        "Grove",
        "Jade",
        "Everforest",
        "Iceberg",
        "Catppuccin Mocha",
        "Rose Pine Dawn",
        "Nord",
        "Black Metal",
        "Ayu",
        "Vesper",
        "Matte Black",
        "*Zen",
        "Oscura Midnight",
        "TokyoNight",
        "Linear",
        "True Black",
        "Solarized",
      ]
    ) {
      assert.isTrue(names.has(name), `Missing theme: ${name}`);
    }
    for (
      const name of [
        "Absolutely Night",
        "Absolutely Day",
        "Ayu Mirage",
        "Ayu Night",
        "Ayu Day",
        "Black Metal (Bathory)",
        "Black Metal (Mayhem)",
        "Black Metal (Venom)",
        "Everforest Night",
        "Everforest Day",
        "Gruvbox Night",
        "Gruvbox Day",
        "Material",
        "Material Dark",
        "Nord Night",
        "Nord Day",
        "Nord Wave",
        "Oscura Dusk",
        "Rose Pine Moon",
        "Solarized Night",
        "Solarized Day",
        "TokyoNight Night",
        "TokyoNight Day",
        "TokyoNight Moon",
        "TokyoNight Storm",
        "*Zen Night",
        "*Zen Day",
        "*Zen Dark",
        "*Zen Light",
      ]
    ) {
      assert.isFalse(names.has(name), `Unexpected theme: ${name}`);
    }
  });

  should("use the Grove palette", () => {
    const grove = ThemeManager.get("grove");
    assert.equal("#1b2821", grove.background);
    assert.equal("#fffaff", grove.foreground);
    assert.equal("#69d69a", grove.accent);
    assert.equal("#69d69a", grove.warning);
  });

  should("use the Jade palette", () => {
    const jade = ThemeManager.get("jade");
    assert.equal("#071c15", jade.background);
    assert.equal("#121c15", jade.surface);
    assert.equal("#cace9e", jade.foreground);
    assert.equal("#2dd5b7", jade.accent);
    assert.equal("#549e6a", jade.success);
    assert.equal("#e5c736", jade.warning);
  });

  should("list starred themes first, then the rest alphabetically by name", () => {
    const names = ThemeManager.themes.map((theme) => theme.name);
    assert.equal("*Zen", names[0]);
    assert.equal("*Zen", names[1]);

    const firstUnstarred = names.findIndex((name) => !name.startsWith("*"));
    assert.isTrue(firstUnstarred > 0);
    assert.isTrue(names.slice(0, firstUnstarred).every((name) => name.startsWith("*")));
    assert.isTrue(names.slice(firstUnstarred).every((name) => !name.startsWith("*")));

    const unstarred = names.slice(firstUnstarred);
    const sortedUnstarred = [...unstarred].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    assert.equal(sortedUnstarred.join("\n"), unstarred.join("\n"));
  });

  should("filter themes by appearance mode", () => {
    const dark = ThemeManager.themesForMode("dark");
    const light = ThemeManager.themesForMode("light");
    assert.isTrue(dark.length > 0);
    assert.isTrue(light.length > 0);
    assert.equal(ThemeManager.themes.length, dark.length + light.length);
    assert.isTrue(dark.every((theme) => theme.mode === "dark"));
    assert.isTrue(light.every((theme) => theme.mode === "light"));
    assert.equal("zen-night", ThemeManager.preferredThemeIdForMode("dark"));
    assert.equal("zen-day", ThemeManager.preferredThemeIdForMode("light"));
    assert.equal("*Zen", dark[0].name);
    assert.equal("*Zen", light[0].name);
    // Mode filter means the same display name is fine for a night/day pair.
    assert.equal(1, dark.filter((theme) => theme.name === "Gruvbox").length);
    assert.equal(1, light.filter((theme) => theme.name === "Gruvbox").length);
  });

  should("define every theme with the semantic UI color contract", () => {
    const requiredKeys = [
      "accent",
      "background",
      "border",
      "danger",
      "foreground",
      "id",
      "mode",
      "muted",
      "name",
      "success",
      "surface",
      "warning",
    ];
    const colorKeys = requiredKeys.filter((key) => !["id", "mode", "name"].includes(key));

    for (const theme of ThemeManager.themes) {
      for (const key of requiredKeys) assert.isTrue(Object.hasOwn(theme, key));
      assert.isTrue(["dark", "light"].includes(theme.mode), theme.id);
      for (const key of colorKeys) {
        assert.isTrue(/^#[0-9a-f]{6}$/i.test(theme[key]), `${theme.id}.${key}`);
      }
      assert.isTrue(ThemeManager.contrastRatio(theme.foreground, theme.background) >= 4.5);
      assert.isTrue(ThemeManager.contrastRatio(theme.foreground, theme.surface) >= 4.5);
      assert.isTrue(ThemeManager.contrastRatio(theme.muted, theme.surface) >= 3);
      assert.isTrue(ThemeManager.contrastRatio(theme.surface, theme.background) < 2);
    }
  });

  should("apply semantic colors and light-dark browser controls to Suda-owned roots", () => {
    const properties = new Map();
    const root = {
      dataset: {},
      style: {
        colorScheme: "",
        setProperty: (name, value) => properties.set(name, value),
      },
    };

    ThemeManager.apply("zen-day", root);

    assert.equal("zen-day", root.dataset.sudaTheme);
    assert.equal("light", root.dataset.sudaThemeMode);
    assert.equal("light", root.style.colorScheme);
    assert.equal("#f4f1ed", properties.get("--suda-canvas-color"));
    assert.equal(ThemeManager.get("zen-day").surface, properties.get("--suda-surface-color"));
    assert.equal("#27272a", properties.get("--suda-text-color"));
    assert.equal("#6ced96", properties.get("--suda-accent-color"));
    assert.equal("#e5484d", properties.get("--suda-danger-color"));
    assert.equal("#f5a524", properties.get("--suda-warning-color"));
    assert.equal("#30a46c", properties.get("--suda-success-color"));
  });

  should("not override a host page's color scheme", () => {
    const properties = new Map();
    const ownerDocument = {
      documentElement: null,
      location: { protocol: "https:" },
    };
    const root = {
      ownerDocument,
      dataset: {},
      style: {
        colorScheme: "dark",
        setProperty: (name, value) => properties.set(name, value),
      },
    };
    ownerDocument.documentElement = root;

    ThemeManager.apply("zen-day", root);

    assert.equal("dark", root.style.colorScheme);
    assert.equal("zen-day", root.dataset.sudaTheme);
    assert.equal("#f4f1ed", properties.get("--suda-canvas-color"));
  });

  should("expose neutral Suda palette aliases and remove legacy Gruvbox properties", () => {
    const properties = new Map();
    const root = {
      dataset: {},
      style: {
        colorScheme: "",
        removeProperty: (name) => properties.delete(name),
        setProperty: (name, value) => properties.set(name, value),
      },
    };

    properties.set("--gruvbox-bg", "stale");
    properties.set("--gruvbox-fg", "stale");
    ThemeManager.apply("gruvbox-night", root);
    assert.equal(undefined, properties.get("--gruvbox-bg"));
    assert.equal(undefined, properties.get("--gruvbox-fg"));
    assert.equal(ThemeManager.get("gruvbox-night").background, properties.get("--suda-bg"));
    assert.equal(ThemeManager.get("gruvbox-night").foreground, properties.get("--suda-fg"));

    ThemeManager.apply("grove", root);
    assert.equal(undefined, properties.get("--gruvbox-bg"));
    assert.equal(undefined, properties.get("--gruvbox-fg"));
    assert.equal("#1b2821", properties.get("--suda-bg"));
    assert.equal(ThemeManager.get("grove").surface, properties.get("--suda-surface"));
    assert.equal("#fffaff", properties.get("--suda-fg"));
    assert.equal(ThemeManager.get("grove").accent, properties.get("--suda-accent"));
  });

  should("apply a normalized custom accent only to capable themes", () => {
    const properties = new Map();
    const root = {
      dataset: {},
      style: {
        colorScheme: "",
        setProperty: (name, value) => properties.set(name, value),
      },
    };

    ThemeManager.apply("zen-night", root, "12ABef");
    assert.equal("#12abef", properties.get("--suda-accent-color"));
    assert.equal("#f5a524", properties.get("--suda-warning-color"));
    assert.isFalse(
      properties.get("--suda-overlay-color") === properties.get("--suda-canvas-color"),
    );

    ThemeManager.apply("gruvbox-night", root, "#12ABEF");
    assert.equal("#458588", properties.get("--suda-accent-color"));
    assert.equal("#d79921", properties.get("--suda-warning-color"));
    assert.equal(
      properties.get("--suda-canvas-color"),
      properties.get("--suda-overlay-color"),
    );

    ThemeManager.apply("black-metal", root);
    assert.equal("#a06666", properties.get("--suda-accent-color"));
    ThemeManager.apply("black-metal", root, "#12ABEF");
    assert.equal("#12abef", properties.get("--suda-accent-color"));
  });

  should("reject malformed custom accent colors", () => {
    assert.equal("#6ced96", ThemeManager.normalizeHexColor(" 6CED96 "));
    assert.equal(null, ThemeManager.normalizeHexColor("#6CED9"));
    assert.equal(null, ThemeManager.normalizeHexColor("green"));
  });

  should("derive readable text colors from the accent color", () => {
    const properties = new Map();
    const root = {
      dataset: {},
      style: {
        colorScheme: "",
        setProperty: (name, value) => properties.set(name, value),
      },
    };

    // The default mint accent is light, so text drawn on a solid accent fill must be dark.
    ThemeManager.apply("zen-night", root, "#6CED96");
    assert.equal("#1d1d1f", properties.get("--suda-accent-contrast-color"));
    assert.equal("#187c39", properties.get("--suda-accent-selected-color"));
    assert.equal("#ffffff", properties.get("--suda-accent-selected-text-color"));

    // A dark accent gets white text on top of it.
    ThemeManager.apply("zen-night", root, "#312e81");
    assert.equal("#ffffff", properties.get("--suda-accent-contrast-color"));
  });

  should("use dark ink on light accent fills and not wash pale accents into body text", () => {
    const properties = new Map();
    const root = {
      dataset: {},
      style: {
        colorScheme: "",
        setProperty: (name, value) => properties.set(name, value),
      },
    };

    // Oscura's signature pale yellow is closer to white than black.
    ThemeManager.apply("oscura-midnight", root);
    assert.equal("#e6e7a3", properties.get("--suda-accent-color"));
    assert.equal("#e6e7a3", properties.get("--suda-accent-selected-color"));
    assert.equal("#1d1d1f", properties.get("--suda-accent-selected-text-color"));
    assert.equal("#1d1d1f", properties.get("--suda-accent-contrast-color"));

    // Match/link accent text must stay distinct from body text so highlights remain visible.
    const accentText = properties.get("--suda-accent-text-color");
    const bodyText = properties.get("--suda-text-color");
    const canvas = properties.get("--suda-canvas-color");
    assert.isTrue(ThemeManager.isLightColor("#e6e7a3"));
    assert.isTrue(ThemeManager.contrastRatio(accentText, canvas) >= 4.5);
    assert.isTrue(
      ThemeManager.contrastRatio(accentText, bodyText) >= 2.5,
      `accent text ${accentText} too close to body text ${bodyText}`,
    );
    // Old behavior washed pale accents toward white (~#eeefc0); deepened gold must be darker.
    assert.isTrue(
      ThemeManager.contrastRatio(accentText, "#ffffff") >
        ThemeManager.contrastRatio("#eeefc0", "#ffffff"),
    );
  });

  should("source the default palette from the theme catalog", () => {
    const theme = ThemeManager.get(ThemeManager.defaultTheme);
    assert.equal("zen-night", theme.id);
    assert.equal("#19191b", theme.background);
    assert.equal("#6ced96", theme.accent);
  });
});
