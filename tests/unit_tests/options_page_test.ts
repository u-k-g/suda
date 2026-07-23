// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import * as testHelper from "./test_helper.js";
import "../../tests/unit_tests/test_chrome_stubs.js";
import * as optionsPage from "../../pages/options.js";

context("options page", () => {
  setup(async () => {
    await testHelper.jsdomStub("pages/options.html");
    await optionsPage.init();
  });

  teardown(async () => {
    await Settings.clear();
  });

  should("move keybinding controls to the dedicated page", () => {
    assert.equal(null, optionsPage.getOptionEl("keyMappings"));
    assert.equal(null, optionsPage.getOptionEl("keyBindingMode"));
    assert.isTrue(document.querySelector('.options-page-link[href="keybindings.html"]') != null);
  });

  should("preserve keybinding settings when saving options", async () => {
    await Settings.set("keyBindingMode", "vim");
    await Settings.set("keyMappings", "map q scrollUp");

    await optionsPage.saveOptions();

    assert.equal("vim", Settings.get("keyBindingMode"));
    assert.equal("map q scrollUp", Settings.get("keyMappings"));
  });

  should("show the configurable scroll defaults", () => {
    assert.equal("120", optionsPage.getOptionEl("scrollStepSize").value);
    assert.equal("800", optionsPage.getOptionEl("fastScrollStepSize").value);
  });

  should("show the default accent field only for Arc themes", () => {
    const theme = optionsPage.getOptionEl("theme");
    const accent = optionsPage.getOptionEl("accentColor");
    const container = document.querySelector("#accent-container");

    assert.equal("arc-dark", theme.value);
    assert.equal("#6CED96", accent.value);
    assert.isFalse(container.style.display === "none");

    theme.value = "gruvbox-dark-hard";
    theme.dispatchEvent(new window.Event("input"));
    assert.equal("none", container.style.display);
    assert.equal("none", document.querySelector("#accent-heading").style.display);

    theme.value = "arc-light";
    theme.dispatchEvent(new window.Event("input"));
    assert.isFalse(container.style.display === "none");
  });

  should("preview and save a valid custom Arc accent", async () => {
    const accent = optionsPage.getOptionEl("accentColor");
    accent.value = "12abEF";
    accent.dispatchEvent(new window.Event("input"));

    assert.equal("#12abef", document.documentElement.style.getPropertyValue("--suda-accent-color"));
    assert.equal(
      "rgb(18, 171, 239)",
      document.querySelector("#accent-swatch").style.backgroundColor,
    );

    await optionsPage.saveOptions();
    assert.equal("#12ABEF", Settings.get("accentColor"));
  });

  should("reject an invalid custom Arc accent", async () => {
    const accent = optionsPage.getOptionEl("accentColor");
    accent.value = "green";

    await optionsPage.saveOptions();

    assert.isTrue(accent.classList.contains("validation-error"));
    assert.isTrue(document.querySelector(".validation-message").textContent.includes("hex color"));
    assert.equal("#6CED96", Settings.get("accentColor"));
  });

  should("leave the browser's new-tab page untouched by default", () => {
    assert.isTrue(document.querySelector("#browserNewTabPage").checked);
    assert.isFalse(document.querySelector("#sudaNewTabPage").checked);
    assert.isFalse(optionsPage.getOptionEl("openCommandBarOnNewTabPage").checked);
  });

  should("hide command-bar mode descriptions by default", () => {
    assert.isFalse(optionsPage.getOptionEl("showCommandBarModeDescriptions").checked);
  });

  should("center the command bar on the browser window by default", async () => {
    assert.isTrue(document.querySelector("#commandBarCenterWindow").checked);
    assert.isFalse(document.querySelector("#commandBarCenterTab").checked);

    document.querySelector("#commandBarCenterTab").checked = true;
    await optionsPage.saveOptions();
    assert.equal("tab", Settings.get("commandBarCenter"));
  });

  should("use the configured command-bar mode and source defaults", () => {
    const uncheckedModeValues = Array.from(
      document.querySelectorAll('[name="disabledCommandBarModes"]:not(:checked)'),
    ).map((element) => element.value);
    const uncheckedSourceValues = Array.from(
      document.querySelectorAll('[name="disabledModelessCommandBarSources"]:not(:checked)'),
    ).map((element) => element.value);

    assert.equal(["url"], uncheckedModeValues);
    assert.equal(["history"], uncheckedSourceValues);
  });

  should("save unchecked command-bar modes and modeless sources as disabled", async () => {
    document.querySelector('[name="disabledCommandBarModes"][value="marks"]').checked = false;
    document.querySelector('[name="disabledCommandBarModes"][value="url"]').checked = true;
    document.querySelector(
      '[name="disabledModelessCommandBarSources"][value="bookmarks"]',
    ).checked = false;
    document.querySelector(
      '[name="disabledModelessCommandBarSources"][value="history"]',
    ).checked = true;

    await optionsPage.saveOptions();

    assert.equal(["marks"], Settings.get("disabledCommandBarModes"));
    assert.equal(["bookmarks"], Settings.get("disabledModelessCommandBarSources"));
  });

  should("show exclusion rule editor for exclusion rules", async () => {
    const rule = {
      passKeys: "",
      pattern: "example.com",
    };
    await Settings.set("exclusionRules", [rule]);
    await optionsPage.init();
    const el = document.querySelector("#exclusion-rules input[name=pattern]");
    assert.equal("example.com", el.value);
  });

  context("backup", () => {
    should("exclude settings which are default values", () => {
      const settings = JSON.parse(optionsPage.prepareBackupSettings());
      // This should exclude all values which are defaults.
      assert.equal(["settingsVersion"], Object.keys(settings));
    });

    should("include settings which have changed on another settings page", async () => {
      await Settings.set("keyMappings", "map a scrollUp");
      const settings = JSON.parse(optionsPage.prepareBackupSettings());
      assert.equal(["keyMappings", "settingsVersion"], Object.keys(settings));
      assert.equal("map a scrollUp", settings.keyMappings);
    });

    should("export settings with sorted keys", async () => {
      optionsPage.getOptionEl("linkHintCharacters").value = "abcd";
      await Settings.set("keyMappings", "map a scrollUp");
      const settings = JSON.parse(optionsPage.prepareBackupSettings());
      assert.equal(["keyMappings", "linkHintCharacters", "settingsVersion"], Object.keys(settings));
    });

    should("include exclusion rules", async () => {
      const rule = {
        passKeys: "",
        pattern: "example.com",
      };
      await Settings.set("exclusionRules", [rule]);
      await optionsPage.init();
      const settings = JSON.parse(optionsPage.prepareBackupSettings());
      assert.equal([rule], settings["exclusionRules"]);
    });
  });
});
