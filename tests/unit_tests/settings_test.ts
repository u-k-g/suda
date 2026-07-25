import "./test_helper.js";
import "../../lib/settings.js";

context("settings", () => {
  context("accent setting migration", () => {
    teardown(async () => {
      await Settings.clear();
    });

    should("migrate the old Arc-specific setting name", async () => {
      await chrome.storage.sync.set({
        settingsVersion: "2.4.1",
        arcAccentColor: "#12ABEF",
      });

      await Settings.load();
      assert.equal("#12ABEF", Settings.get("accentColor"));
      assert.isFalse(Object.hasOwn(Settings.getSettings(), "arcAccentColor"));

      await Settings.setSettings(Settings.getSettings());
      const stored = await chrome.storage.sync.get(null);
      assert.isFalse(Object.hasOwn(stored, "arcAccentColor"));
    });
  });

  context("removed keybinding profile migration", () => {
    teardown(async () => {
      await Settings.clear();
    });

    should("discard the obsolete profile setting", async () => {
      await chrome.storage.sync.set({
        settingsVersion: "2.4.1",
        keyBindingMode: "vim",
      });

      await Settings.load();
      assert.isFalse(Object.hasOwn(Settings.getSettings(), "keyBindingMode"));

      await Settings.setSettings(Settings.getSettings());
      const stored = await chrome.storage.sync.get(null);
      assert.isFalse(Object.hasOwn(stored, "keyBindingMode"));
    });
  });

  context("command-bar settings migration", () => {
    teardown(async () => {
      await Settings.clear();
    });

    should("remove obsolete mode visibility settings", async () => {
      await chrome.storage.sync.set({
        settingsVersion: "2.4.1",
        disabledCommandBarModes: ["commands", "tabs", "actions", "find"],
        disabledModelessCommandBarSources: ["commands", "history"],
      });

      await Settings.load();

      assert.isFalse(Object.hasOwn(Settings.getSettings(), "disabledCommandBarModes"));
      assert.equal(["history"], Settings.get("disabledModelessCommandBarSources"));

      await Settings.setSettings(Settings.getSettings());
      const stored = await chrome.storage.sync.get(null);
      assert.isFalse(Object.hasOwn(stored, "disabledCommandBarModes"));
    });
  });

  context("hard reload command migration", () => {
    teardown(async () => {
      await Settings.clear();
    });

    should("convert the old reload hard option into the hardReload command", async () => {
      await chrome.storage.sync.set({
        settingsVersion: "2.4.1",
        keyMappings: "map <space>x reload hard\nmap y reload",
      });

      await Settings.load();

      assert.equal(
        "map <space>x hardReload\nmap y reload",
        Settings.get("keyMappings"),
      );
    });
  });

  context("removed command migration", () => {
    teardown(async () => {
      await Settings.clear();
    });

    should("discard mappings for commands which no longer exist", async () => {
      await chrome.storage.sync.set({
        settingsVersion: "2.4.1",
        keyMappings: [
          "map x toggleViewSource",
          "map z1 setZoom level=1.1",
          "map z2 showHelp",
          "map z3 Marks.activateGotoMode",
          "map z4 CommandBar.activateFind",
          "map z5 CommandBar.activateEditUrlInNewTab",
          "map z6 CommandBar.activateBookmarksInNewTab",
          "map z7 visitPreviousTab",
          "map z8 goUp",
          "map z9 openCopiedUrlInCurrentTab",
          "map z10 CommandBar.activate",
          "map z11 CommandBar.activateInNewTab",
          "map y reload",
        ].join("\n"),
        disabledActions: [
          "showHelp",
          "Marks.activateGotoMode",
          "reload",
        ],
      });

      await Settings.load();

      assert.equal("map y reload", Settings.get("keyMappings"));
      assert.equal(["reload"], Settings.get("disabledActions"));
    });
  });

  context("v2.0 migration", () => {
    setup(async () => {
      // Prior to Suda 2.0.0, the settings values were encoded as JSON strings.
      await chrome.storage.sync.set({ scrollStepSize: JSON.stringify(123) });
    });

    teardown(async () => {
      await Settings.clear();
    });

    should("Run v2.0.0 migration when loading settings", async () => {
      let storage = await chrome.storage.sync.get(null);
      assert.equal("123", storage.scrollStepSize);
      // The JSON value should've been migrated to an int when loading settings.
      await Settings.load();
      const settings = Settings.getSettings();
      assert.equal(123, settings["scrollStepSize"]);
      // When writing settings, the JSON value should be persisted back to storage.
      await Settings.set(settings);
      storage = await chrome.storage.sync.get(null);
      assert.equal(123, storage.scrollStepSize);
    });
  });

  context("v2.4 migration", () => {
    setup(async () => {
      await chrome.storage.sync.set({
        settingsVersion: "2.3",
      });
    });

    teardown(async () => {
      await Settings.clear();
    });

    should("Handle null newTabUrl", async () => {
      // Users who never changed newTabUrl from its old default ("about:newtab") won't have it
      // stored, because Settings.pruneOutDefaultValues removes keys equal to the default. The
      // migration should still set browserNewTabPage as the destination.
      await Settings.load();
      const settings = Settings.getSettings();
      assert.equal(Settings.newTabDestinations.browserNewTabPage, settings.newTabDestination);
    });

    should("Remove deprecated option", async () => {
      await chrome.storage.sync.set({ newTabUrl: "pages/blank.html" });
      await Settings.load();
      const settings = Settings.getSettings();
      assert.isFalse(Object.hasOwn(settings, "newTabUrl"));
    });

    should("Handle pages/blank.html new tab URL", async () => {
      await chrome.storage.sync.set({ newTabUrl: "pages/blank.html" });
      await Settings.load();
      const settings = Settings.getSettings();
      assert.equal(Settings.newTabDestinations.sudaNewTabPage, settings.newTabDestination);
    });

    should("Handle https://example.com new tab URL", async () => {
      await chrome.storage.sync.set({ newTabUrl: "https://example.com" });
      await Settings.load();
      const settings = Settings.getSettings();
      assert.equal(Settings.newTabDestinations.customUrl, settings.newTabDestination);
      assert.equal("https://example.com", settings.newTabCustomUrl);
    });
  });

  context("v2.4.1 migration", () => {
    setup(async () => {
      await chrome.storage.sync.set({ settingsVersion: "2.4.0" });
    });

    teardown(async () => {
      await Settings.clear();
    });

    should("Sets default/missing newTabDestination to browserNewTabPage", async () => {
      await Settings.load();
      const settings = Settings.getSettings();
      assert.equal(Settings.newTabDestinations.browserNewTabPage, settings.newTabDestination);
    });

    should("Preserve customUrl destination", async () => {
      await chrome.storage.sync.set({ newTabDestination: Settings.newTabDestinations.customUrl });
      await Settings.load();
      const settings = Settings.getSettings();
      assert.equal(Settings.newTabDestinations.customUrl, settings.newTabDestination);
    });
  });
});
