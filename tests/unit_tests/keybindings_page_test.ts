// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import * as testHelper from "./test_helper.js";
import "../../tests/unit_tests/test_chrome_stubs.js";
import * as keybindingsPage from "../../pages/keybindings.js";
import * as optionsPage from "../../pages/options.js";

context("keybindings page", () => {
  setup(async () => {
    // Keybindings live inside the unified settings shell on options.html.
    await testHelper.jsdomStub("pages/options.html");
    await optionsPage.init();
    optionsPage.showSettingsSection("keybindings");
  });

  teardown(async () => {
    await Settings.clear();
  });

  should("show the active Helix bindings without a profile selector", () => {
    assert.equal(null, document.querySelector("#profile-selector"));
    assert.equal(null, document.querySelector('input[name="keyBindingMode"]'));

    const scrollDown = document.querySelector('[data-command="scrollDown"]');
    assert.isTrue(scrollDown != null);
    assert.isTrue(
      Array.from(scrollDown.querySelectorAll("kbd")).some((key) => key.textContent === "j"),
    );

    const options = document.querySelector('[data-command="openOptionsPage"]');
    assert.equal(
      ["Space", ","],
      Array.from(options.querySelectorAll("kbd")).map((key) => key.textContent),
    );
  });

  should("list every registered command, including those without a default binding", async () => {
    const { allCommands } = await import("../../background_scripts/all_commands.js");
    const commandNames = new Set(
      Array.from(document.querySelectorAll(".binding-row")).map((row) => row.dataset.command),
    );

    for (const command of allCommands) {
      assert.isTrue(
        commandNames.has(command.name),
        `expected command ${command.name} to appear in the keybindings table`,
      );
    }

    const unbound = document.querySelector(".binding-row.is-unbound");
    assert.isTrue(unbound != null);
    assert.equal("None", unbound.querySelector(".binding-unbound")?.textContent);
  });

  should("load only settings-page dependencies", async () => {
    const source = await Deno.readTextFile("pages/keybindings.ts");
    assert.isTrue(source.includes('import "./settings_page_dependencies.js"'));
    assert.isFalse(source.includes('import "./all_content_scripts.js"'));
  });

  should("render the two-column keybindings table", () => {
    const headers = Array.from(document.querySelectorAll(".table-header span"))
      .map((el) => el.textContent.trim().toLowerCase());
    assert.equal(["command", "keybinding"], headers);

    const row = document.querySelector(".binding-row");
    assert.isTrue(row.querySelector(".command-copy") != null);
    assert.isTrue(row.querySelector(".binding-keys") != null);
    assert.equal(null, row.querySelector(".binding-when"));
    assert.equal(null, row.querySelector(".binding-status"));
  });

  should("mark customized command titles with the accent class", async () => {
    const customMappings = document.querySelector('textarea[name="keyMappings"]');
    customMappings.value = "map q scrollUp";
    customMappings.dispatchEvent(new window.Event("input"));

    const customized = document.querySelector(
      '[data-command="scrollUp"] .command-description.command-custom',
    );
    assert.isTrue(customized != null);
    assert.equal("Scroll up", customized.textContent);
  });

  should("organize active commands into feature groups", () => {
    const groups = Array.from(document.querySelectorAll(".binding-group"))
      .map((group) => group.dataset.group);
    assert.equal(["navigation", "commandBar", "find", "history", "tabs", "misc"], groups);
  });

  should("filter by command descriptions, names, groups, and keys", () => {
    const search = document.querySelector("#binding-search input");
    search.value = "removetab";
    search.dispatchEvent(new window.Event("input"));

    const visibleRows = Array.from(document.querySelectorAll(".binding-row"))
      .filter((row) => !row.hidden);
    assert.isTrue(visibleRows.length >= 1);
    assert.isTrue(visibleRows.every((row) => row.dataset.command === "removeTab"));
    assert.isTrue(
      document.querySelector("#binding-count").textContent.includes(
        `${visibleRows.length} command`,
      ),
    );
  });

  should("preview and save custom mappings", async () => {
    document.querySelector("#toggle-editor").click();
    const customMappings = document.querySelector('textarea[name="keyMappings"]');
    customMappings.value = "map q scrollUp";
    customMappings.dispatchEvent(new window.Event("input"));

    assert.isFalse(document.querySelector("#custom-mappings-editor").hidden);
    assert.isFalse(document.querySelector("#save-mappings").disabled);
    assert.isTrue(await keybindingsPage.saveMappings());
    assert.equal("map q scrollUp", Settings.get("keyMappings"));
  });

  should("reject invalid custom mappings", async () => {
    const customMappings = document.querySelector('textarea[name="keyMappings"]');
    customMappings.value = "invalid-mapping-statement";
    customMappings.dispatchEvent(new window.Event("input"));

    assert.isFalse(await keybindingsPage.saveMappings());
    assert.isFalse(document.querySelector("#mapping-validation").hidden);
    assert.equal(Settings.defaultOptions.keyMappings, Settings.get("keyMappings"));
  });
});
