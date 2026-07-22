// @ts-nocheck -- global-script theme modules are exercised in the unit-test environment.
import "../../lib/theme_catalog.js";
import "../../lib/themes.js";

context("themes", () => {
  should("include the complete imported catalog and curated themes", () => {
    assert.equal(80, ThemeManager.themes.length);
    const names = new Set(ThemeManager.themes.map((theme) => theme.name));
    for (
      const name of [
        "Gruvbox Dark Hard",
        "Everforest Dark Hard",
        "Iceberg Light",
        "Catppuccin Mocha",
        "Rose Pine Dawn",
        "Nord",
        "Black Metal (Mayhem)",
        "Ayu Light",
        "Absolutely Dark",
        "Vesper",
        "Matte Black",
        "Material Ocean",
        "Arc Dark",
        "Arc Light",
        "VS Code Plus Dark",
        "Xcode Dark",
        "Notion Light",
        "One Dark",
        "Raycast Dark",
        "TokyoNight Night",
        "Linear Dark",
        "True Black",
      ]
    ) {
      assert.isTrue(names.has(name), `Missing theme: ${name}`);
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

    ThemeManager.apply("arc-light", root);

    assert.equal("arc-light", root.dataset.sudaTheme);
    assert.equal("light", root.style.colorScheme);
    assert.equal("#f4f1ed", properties.get("--suda-background-color"));
    assert.equal("#6ced96", properties.get("--suda-link-color"));
  });

  should("apply a normalized custom accent only to Arc themes", () => {
    const properties = new Map();
    const root = {
      dataset: {},
      style: {
        colorScheme: "",
        setProperty: (name, value) => properties.set(name, value),
      },
    };

    ThemeManager.apply("arc-dark", root, "12ABef");
    assert.equal("#12abef", properties.get("--suda-accent-color"));
    assert.equal("#12abef", properties.get("--suda-link-color"));

    ThemeManager.apply("gruvbox-dark-hard", root, "#12ABEF");
    assert.equal("#d79921", properties.get("--suda-accent-color"));
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
    ThemeManager.apply("arc-dark", root, "#6CED96");
    assert.equal("#1d1d1f", properties.get("--suda-accent-contrast-color"));

    // A dark accent gets white text on top of it.
    ThemeManager.apply("arc-dark", root, "#312e81");
    assert.equal("#ffffff", properties.get("--suda-accent-contrast-color"));
  });

  should("source the default palette from the theme catalog", () => {
    const theme = ThemeManager.get(ThemeManager.defaultTheme);
    assert.equal("arc-dark", theme.id);
    assert.equal("#19191b", theme.background);
    assert.equal("#6ced96", theme.accent);
  });
});
