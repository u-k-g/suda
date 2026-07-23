// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import * as testHelper from "./test_helper.js";
import "../../tests/unit_tests/test_chrome_stubs.js";
import * as keybindingsPage from "../../pages/keybindings.js";

context("keybindings page", () => {
  setup(async () => {
    await testHelper.jsdomStub("pages/keybindings.html");
    await keybindingsPage.init();
  });

  teardown(async () => {
    await Settings.clear();
  });

  should("show the Helix profile and its active bindings by default", () => {
    assert.isTrue(document.querySelector('input[value="helix"]').checked);
    assert.isFalse(document.querySelector('input[value="vim"]').checked);

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

  should("organize active commands into feature groups", () => {
    const groups = Array.from(document.querySelectorAll(".binding-group"))
      .map((group) => group.dataset.group);
    assert.equal(["navigation", "commandBar", "find", "history", "tabs", "misc"], groups);
  });

  should("filter by command descriptions, names, groups, and keys", () => {
    const search = document.querySelector("#binding-search input");
    search.value = "remove tab";
    search.dispatchEvent(new window.Event("input"));

    const visibleRows = Array.from(document.querySelectorAll(".binding-row"))
      .filter((row) => !row.hidden);
    assert.equal(1, visibleRows.length);
    assert.equal("removeTab", visibleRows[0].dataset.command);
    assert.isTrue(document.querySelector("#binding-count").textContent.includes("1 command"));
  });

  should("preview and save a different profile with custom mappings", async () => {
    const classic = document.querySelector('input[value="vim"]');
    classic.checked = true;
    classic.dispatchEvent(new window.Event("input"));

    const customMappings = document.querySelector('textarea[name="keyMappings"]');
    customMappings.value = "map q scrollUp";
    customMappings.dispatchEvent(new window.Event("input"));

    assert.isFalse(document.querySelector("#custom-mappings-editor").hidden);
    assert.isFalse(document.querySelector("#save-mappings").disabled);
    assert.isTrue(await keybindingsPage.saveMappings());
    assert.equal("vim", Settings.get("keyBindingMode"));
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
