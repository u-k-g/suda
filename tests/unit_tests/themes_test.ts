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
    assert.equal("#6d5bd0", properties.get("--suda-link-color"));
  });
});
