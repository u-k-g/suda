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

  should("populate the form fields with the settings", () => {
    const settings = Settings.getSettings();
    const field = optionsPage.getOptionEl("keyMappings");
    assert.isTrue(Settings.defaultOptions.keyMappings.length > 0);
    assert.equal(Settings.defaultOptions.keyMappings, settings.keyMappings);
    assert.equal(settings.keyMappings, field.value);
  });

  should("select Helix by default while retaining the Suda classic option", () => {
    assert.isTrue(document.querySelector("#helixKeyBindings").checked);
    assert.isFalse(document.querySelector("#vimKeyBindings").checked);
  });

  should("show the configurable scroll defaults", () => {
    assert.equal("120", optionsPage.getOptionEl("scrollStepSize").value);
    assert.equal("800", optionsPage.getOptionEl("fastScrollStepSize").value);
  });

  should("use the Suda blank page and open its command bar by default", () => {
    assert.isTrue(document.querySelector("#sudaNewTabPage").checked);
    assert.isTrue(optionsPage.getOptionEl("openCommandBarOnNewTabPage").checked);
  });

  should("hide command-bar mode descriptions by default", () => {
    assert.isFalse(optionsPage.getOptionEl("showCommandBarModeDescriptions").checked);
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

  should("show validation errors for invalid fields on save", async () => {
    const el = optionsPage.getOptionEl("keyMappings");
    assert.isFalse(el.classList.contains("validation-error"));
    assert.equal(0, document.querySelectorAll(".validation-message").length);

    el.value = "invalid-mapping-statement";
    await optionsPage.saveOptions();
    assert.isTrue(el.classList.contains("validation-error"));

    const messageEls = document.querySelectorAll(".validation-message");
    assert.equal(1, messageEls.length);
    assert.isTrue(messageEls[0].innerHTML.includes(el.value));
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

    should("include settings which have changed from the default", () => {
      optionsPage.getOptionEl("keyMappings").value = "map a scrollUp";
      const settings = JSON.parse(optionsPage.prepareBackupSettings());
      assert.equal(["keyMappings", "settingsVersion"], Object.keys(settings));
      assert.equal("map a scrollUp", settings.keyMappings);
    });

    should("export settings with sorted keys", () => {
      optionsPage.getOptionEl("linkHintCharacters").value = "abcd";
      optionsPage.getOptionEl("keyMappings").value = "map a scrollUp";
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
