// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import * as testHelper from "./test_helper.js";
import "../../tests/unit_tests/test_chrome_stubs.js";
import * as optionsPage from "../../pages/options.js";

const waitForAutoSave = () => new Promise((resolve) => setTimeout(resolve, 350));

context("options page", () => {
  setup(async () => {
    await testHelper.jsdomStub("pages/options.html");
    await optionsPage.init();
  });

  teardown(async () => {
    await Settings.clear();
  });

  should("fold keybindings into the unified settings shell", () => {
    assert.equal(null, optionsPage.getOptionEl("keyMappings"));
    assert.isTrue(typeof Settings.get("keyMappings") === "string");
    assert.equal(null, document.querySelector('input[name="keyBindingMode"]'));
    assert.isTrue(document.querySelector("#settings-shell") != null);
    assert.isTrue(document.querySelector("#panel-keybindings") != null);
    assert.isTrue(document.querySelector("#settings-section-button") != null);
    assert.isTrue(
      document.querySelector('.settings-section-option[data-section="keybindings"]') != null,
    );
    assert.equal(null, document.querySelector("footer"));
    assert.equal(null, document.querySelector("#save"));
  });

  should("load normal mode separately from the settings UI module", async () => {
    const source = await Deno.readTextFile("pages/options.ts");
    assert.isTrue(source.includes('import "./settings_page_dependencies.js"'));
    assert.isFalse(source.includes('import "./all_content_scripts.js"'));
    assert.isTrue(
      document.querySelector('script[src="all_content_scripts.js"][type="module"]') != null,
    );
    assert.isTrue(document.querySelector('link[href="options_layout.css"]') != null);
    assert.isTrue(document.querySelector('link[href="settings_shell.css"]') != null);
  });

  should("switch between general and keybindings panels", () => {
    assert.isFalse(document.querySelector("#panel-general").hidden);
    assert.isTrue(document.querySelector("#panel-keybindings").hidden);
    assert.equal("General", document.querySelector("#settings-section-label").textContent);

    optionsPage.showSettingsSection("keybindings");
    assert.isTrue(document.querySelector("#panel-general").hidden);
    assert.isFalse(document.querySelector("#panel-keybindings").hidden);
    assert.equal("Keybindings", document.querySelector("#settings-section-label").textContent);
    assert.equal(
      "true",
      document.querySelector('.settings-section-option[data-section="keybindings"]')
        .getAttribute("aria-selected"),
    );

    optionsPage.showSettingsSection("general");
    assert.isFalse(document.querySelector("#panel-general").hidden);
    assert.isTrue(document.querySelector("#panel-keybindings").hidden);
    assert.equal("General", document.querySelector("#settings-section-label").textContent);
  });

  should("group each setting's copy and control into one row", () => {
    const appearance = document.querySelector("#theme-mode-container").closest(".setting-row");
    assert.equal("Appearance", appearance.querySelector(".setting-copy h2").textContent);
    assert.isTrue(
      appearance.querySelector(".setting-copy .example").textContent.includes(
        "Night or day",
      ),
    );
    assert.equal(
      document.querySelector("#setting-themeModeDay"),
      appearance.querySelector(".setting-switch input"),
    );
    assert.isFalse(document.querySelector("#theme-mode-container .setting-enum-select") != null);

    const theme = optionsPage.getOptionEl("theme").closest(".setting-row");
    assert.equal("Theme", theme.querySelector(".setting-copy h2").textContent);
    assert.isTrue(
      theme.querySelector(".setting-copy .example").textContent.includes(
        "Choose a Suda interface theme",
      ),
    );
    assert.equal(optionsPage.getOptionEl("theme"), theme.querySelector(".setting-control select"));

    const hideHud = optionsPage.getOptionEl("hideHud").closest(".setting-row");
    assert.equal(
      "Hide the Heads Up Display (HUD) in insert mode",
      hideHud.querySelector(".setting-name").textContent,
    );
    assert.equal(
      optionsPage.getOptionEl("hideHud"),
      hideHud.querySelector(".setting-switch input"),
    );
  });

  should("filter themes by appearance mode and switch to a matching theme", () => {
    const theme = optionsPage.getOptionEl("theme");
    const dayToggle = document.querySelector("#setting-themeModeDay");
    assert.equal("dark", optionsPage.getThemeModeFromForm());
    assert.isFalse(dayToggle.checked);
    assert.equal("zen-night", theme.value);

    const darkIds = Array.from(theme.options).map((option) => option.value);
    assert.isTrue(darkIds.includes("zen-night"));
    assert.isTrue(darkIds.includes("gruvbox-night"));
    assert.isFalse(darkIds.includes("zen-day"));
    assert.isFalse(darkIds.includes("gruvbox-day"));
    for (const id of darkIds) {
      assert.equal("dark", ThemeManager.get(id).mode);
    }

    dayToggle.checked = true;
    dayToggle.dispatchEvent(new window.Event("change", { bubbles: true }));

    assert.equal("light", optionsPage.getThemeModeFromForm());
    assert.equal("zen-day", theme.value);
    const lightIds = Array.from(theme.options).map((option) => option.value);
    assert.isTrue(lightIds.includes("zen-day"));
    assert.isTrue(lightIds.includes("gruvbox-day"));
    assert.isFalse(lightIds.includes("zen-night"));
    assert.isFalse(lightIds.includes("gruvbox-night"));
    for (const id of lightIds) {
      assert.equal("light", ThemeManager.get(id).mode);
    }
  });

  should("explain how to replace the new-tab shortcut with the command bar", () => {
    const guide = document.querySelector(".new-tab-command-bar-guide");

    assert.equal(
      "Replace new tabs with the Command Bar",
      guide.querySelector("h2").textContent,
    );
    assert.isTrue(guide.textContent.includes("helium://extensions/shortcuts"));
    assert.isTrue(guide.textContent.includes("chrome://extensions/shortcuts"));
    assert.isTrue(guide.textContent.includes("Open Suda's all-mode command bar"));
    assert.equal(guide, document.querySelector("#settings-grid-container").lastElementChild);
  });

  should("enable command-bar-only mode by default and allow disabling it", async () => {
    const commandBarOnly = optionsPage.getOptionEl("commandBarOnly");
    assert.isTrue(commandBarOnly.checked);
    assert.isTrue(
      commandBarOnly.closest(".setting-row").textContent.includes(
        "helium://extensions/shortcuts",
      ),
    );

    commandBarOnly.checked = false;
    await optionsPage.saveOptions();

    assert.isFalse(Settings.get("commandBarOnly"));
    assert.isFalse((await chrome.storage.sync.get("commandBarOnly")).commandBarOnly);
  });

  should("configure find match flash frequency and allow zero to disable it", async () => {
    const findMatchFlashHz = optionsPage.getOptionEl("findMatchFlashHz");
    assert.equal("6", findMatchFlashHz.value);
    assert.isTrue(findMatchFlashHz.parentElement.classList.contains("setting-number-field"));
    assert.equal("Hz", findMatchFlashHz.nextElementSibling.textContent);

    findMatchFlashHz.value = "0";
    await optionsPage.saveOptions();

    assert.equal(0, Settings.get("findMatchFlashHz"));
    assert.equal(0, (await chrome.storage.sync.get("findMatchFlashHz")).findMatchFlashHz);
  });

  should("keep complex editors collapsed until requested", () => {
    const searchEngines = optionsPage.getOptionEl("searchEngines");
    const panel = searchEngines.closest(".setting-editor-panel");
    const toggle = document.querySelector('[aria-controls="setting-editor-searchEngines"]');

    assert.isTrue(panel.hidden);
    assert.equal("false", toggle.getAttribute("aria-expanded"));

    toggle.click();
    assert.isFalse(panel.hidden);
    assert.equal("true", toggle.getAttribute("aria-expanded"));
  });

  should(
    "present radio settings as compact selects without changing their storage format",
    async () => {
      const newTabSelect = document.querySelector(
        '#new-tab-url-container select[aria-label="New tab destination"]',
      );
      assert.equal("browserNewTabPage", newTabSelect.value);

      newTabSelect.value = "customUrl";
      newTabSelect.dispatchEvent(new window.Event("input"));
      await optionsPage.saveOptions();

      assert.equal("customUrl", Settings.get("newTabDestination"));
    },
  );

  should("automatically save changed options", async () => {
    const scrollStepSize = optionsPage.getOptionEl("scrollStepSize");
    scrollStepSize.value = "144";
    scrollStepSize.dispatchEvent(new window.Event("input"));

    await waitForAutoSave();

    assert.equal(144, Settings.get("scrollStepSize"));
    assert.equal(144, (await chrome.storage.sync.get("scrollStepSize")).scrollStepSize);
  });

  should("save recent-tab cycle settings", async () => {
    const size = optionsPage.getOptionEl("recentTabCycleSize");
    const timeout = optionsPage.getOptionEl("recentTabCycleTimeoutMs");
    size.value = "7";
    timeout.value = "1200";
    size.dispatchEvent(new window.Event("input"));
    timeout.dispatchEvent(new window.Event("input"));

    await waitForAutoSave();

    assert.equal(7, Settings.get("recentTabCycleSize"));
    assert.equal(1200, Settings.get("recentTabCycleTimeoutMs"));
    assert.equal(
      7,
      (await chrome.storage.sync.get("recentTabCycleSize")).recentTabCycleSize,
    );
    assert.equal(
      1200,
      (await chrome.storage.sync.get("recentTabCycleTimeoutMs")).recentTabCycleTimeoutMs,
    );
  });

  should("preserve custom keybindings when saving options", async () => {
    await Settings.set("keyMappings", "map q scrollUp");

    await optionsPage.saveOptions();

    assert.equal("map q scrollUp", Settings.get("keyMappings"));
  });

  should("show the configurable scroll defaults", () => {
    assert.equal("120", optionsPage.getOptionEl("scrollStepSize").value);
    assert.equal("800", optionsPage.getOptionEl("fastScrollStepSize").value);
  });

  should("show the recent-tab cycle defaults", () => {
    assert.equal("4", optionsPage.getOptionEl("recentTabCycleSize").value);
    assert.equal("350", optionsPage.getOptionEl("recentTabCycleTimeoutMs").value);
  });

  should("show the accent field for Zen and Black Metal with their palette defaults", () => {
    const theme = optionsPage.getOptionEl("theme");
    const accent = optionsPage.getOptionEl("accentColor");
    const row = document.querySelector("#accent-row");

    assert.equal("zen-night", theme.value);
    assert.equal("#6CED96", accent.value);
    assert.isFalse(row.style.display === "none");

    theme.value = "gruvbox-night";
    theme.dispatchEvent(new window.Event("input"));
    assert.equal("none", row.style.display);

    theme.value = "black-metal";
    theme.dispatchEvent(new window.Event("input"));
    assert.isFalse(row.style.display === "none");
    assert.equal("#A06666", accent.value);

    const dayToggle = document.querySelector("#setting-themeModeDay");
    dayToggle.checked = true;
    dayToggle.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.equal("zen-day", theme.value);
    assert.isFalse(row.style.display === "none");
    assert.equal("#6CED96", accent.value);
  });

  should("preview and save a valid custom Zen accent", async () => {
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

  should("reject an invalid custom Zen accent", async () => {
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

  should("preserve unfinished command-bar text by default and allow disabling it", async () => {
    const preserveDrafts = optionsPage.getOptionEl("preserveCommandBarDrafts");
    assert.isTrue(preserveDrafts.checked);

    preserveDrafts.checked = false;
    await optionsPage.saveOptions();

    assert.isFalse(Settings.get("preserveCommandBarDrafts"));
    assert.isFalse(
      (await chrome.storage.sync.get("preserveCommandBarDrafts")).preserveCommandBarDrafts,
    );
  });

  should("center the command bar on the browser window by default", async () => {
    assert.isTrue(document.querySelector("#commandBarCenterWindow").checked);
    assert.isFalse(document.querySelector("#commandBarCenterTab").checked);

    document.querySelector("#commandBarCenterTab").checked = true;
    await optionsPage.saveOptions();
    assert.equal("tab", Settings.get("commandBarCenter"));
  });

  should("use the configured command-bar source defaults", () => {
    const uncheckedSourceValues = Array.from(
      document.querySelectorAll('[name="disabledModelessCommandBarSources"]:not(:checked)'),
    ).map((element) => element.value);

    assert.equal(null, document.querySelector('[name="disabledCommandBarModes"]'));
    assert.equal([], uncheckedSourceValues);
    assert.equal(
      null,
      document.querySelector('[name="disabledModelessCommandBarSources"][value="commands"]'),
    );
    assert.isTrue(
      document.querySelector('[name="disabledModelessCommandBarSources"]')
        .closest(".setting-row").textContent.includes("Suda actions are always included"),
    );
  });

  should("save unchecked modeless sources as disabled", async () => {
    document.querySelector(
      '[name="disabledModelessCommandBarSources"][value="bookmarks"]',
    ).checked = false;
    document.querySelector(
      '[name="disabledModelessCommandBarSources"][value="history"]',
    ).checked = true;

    await optionsPage.saveOptions();

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
