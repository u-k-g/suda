// @ts-nocheck -- global-script theme modules are exercised in the unit-test environment.
import "../../lib/theme_catalog.js";
import "../../lib/themes.js";

context("themes", () => {
  should("include the complete imported catalog and curated themes", () => {
    assert.equal(50, ThemeManager.themes.length);
    const names = new Set(ThemeManager.themes.map((theme) => theme.name));
    for (
      const name of [
        "Gruvbox Dark",
        "Gruvbox Light",
        "Everforest Dark",
        "Everforest Light",
        "Iceberg Light",
        "Catppuccin Mocha",
        "Rose Pine Dawn",
        "Nord",
        "Black Metal (Mayhem)",
        "Ayu Light",
        "Absolutely Dark",
        "Vesper",
        "Matte Black",
        "* Zen Dark",
        "* Zen Light",
        "Oscura Dusk",
        "Oscura Midnight",
        "TokyoNight Night",
        "Linear Dark",
        "True Black",
      ]
    ) {
      assert.isTrue(names.has(name), `Missing theme: ${name}`);
    }
    for (
      const name of [
        "Everforest Dark Hard",
        "Everforest Dark Med",
        "Everforest Dark Soft",
        "Everforest Light Hard",
        "Everforest Light Med",
        "Everforest Light Soft",
        "Gruvbox Dark Hard",
        "Gruvbox Dark Soft",
        "Gruvbox Light Hard",
        "Gruvbox Light Soft",
        "Gruvbox Material",
        "Material",
        "Material Dark",
        "Material Ocean",
        "Oceanic Material",
      ]
    ) {
      assert.isFalse(names.has(name), `Unexpected theme: ${name}`);
    }
  });

  should("list starred themes first, then the rest alphabetically by name", () => {
    const names = ThemeManager.themes.map((theme) => theme.name);
    assert.equal("* Zen Dark", names[0]);
    assert.equal("* Zen Light", names[1]);

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

  should("apply semantic colors and light-dark browser controls", () => {
    const properties = new Map();
    const root = {
      dataset: {},
      style: {
        colorScheme: "",
        setProperty: (name, value) => properties.set(name, value),
      },
    };

    ThemeManager.apply("zen-light", root);

    assert.equal("zen-light", root.dataset.sudaTheme);
    assert.equal("light", root.style.colorScheme);
    assert.equal("#f4f1ed", properties.get("--suda-canvas-color"));
    assert.equal(ThemeManager.get("zen-light").surface, properties.get("--suda-surface-color"));
    assert.equal("#27272a", properties.get("--suda-text-color"));
    assert.equal("#6ced96", properties.get("--suda-accent-color"));
    assert.equal("#e5484d", properties.get("--suda-danger-color"));
    assert.equal("#f5a524", properties.get("--suda-warning-color"));
    assert.equal("#30a46c", properties.get("--suda-success-color"));
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

    ThemeManager.apply("zen-dark", root, "12ABef");
    assert.equal("#12abef", properties.get("--suda-accent-color"));
    assert.equal("#f5a524", properties.get("--suda-warning-color"));
    assert.isFalse(
      properties.get("--suda-overlay-color") === properties.get("--suda-canvas-color"),
    );

    ThemeManager.apply("gruvbox-dark", root, "#12ABEF");
    assert.equal("#458588", properties.get("--suda-accent-color"));
    assert.equal("#d79921", properties.get("--suda-warning-color"));
    assert.equal(
      properties.get("--suda-canvas-color"),
      properties.get("--suda-overlay-color"),
    );
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
    ThemeManager.apply("zen-dark", root, "#6CED96");
    assert.equal("#1d1d1f", properties.get("--suda-accent-contrast-color"));
    assert.equal("#187c39", properties.get("--suda-accent-selected-color"));
    assert.equal("#ffffff", properties.get("--suda-accent-selected-text-color"));

    // A dark accent gets white text on top of it.
    ThemeManager.apply("zen-dark", root, "#312e81");
    assert.equal("#ffffff", properties.get("--suda-accent-contrast-color"));
  });

  should("source the default palette from the theme catalog", () => {
    const theme = ThemeManager.get(ThemeManager.defaultTheme);
    assert.equal("zen-dark", theme.id);
    assert.equal("#19191b", theme.background);
    assert.equal("#6ced96", theme.accent);
  });
});
