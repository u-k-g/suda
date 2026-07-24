// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import * as testHelper from "./test_helper.js";
import "../../tests/unit_tests/test_chrome_stubs.js";
import * as keybindingsPage from "../../pages/keybindings.js";
import * as optionsPage from "../../pages/options.js";

const waitForBindingSave = () => new Promise((resolve) => setTimeout(resolve, 50));

async function recordShortcut(command, currentKey, keyEvents) {
  const row = document.querySelector(
    `.binding-row[data-command="${command}"][data-key="${currentKey}"]`,
  );
  const editor = row.querySelector(".binding-editor");
  editor.click();
  for (const event of keyEvents) {
    editor.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        bubbles: true,
        altKey: event.altKey,
        code: event.code,
        ctrlKey: event.ctrlKey,
        key: event.key,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      }),
    );
  }
  editor.blur();
  await waitForBindingSave();
}

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
    assert.equal(null, document.querySelector("#toggle-editor"));
    assert.equal(null, document.querySelector("#custom-mappings-editor"));
    assert.equal(null, document.querySelector('textarea[name="keyMappings"]'));
    assert.isTrue(document.querySelector(".binding-editor") != null);
  });

  should("distinguish reload and hard-reload defaults without marking them custom", () => {
    const soft = document.querySelector(
      '.binding-row[data-command="reload"][data-key="<space>r"]',
    );
    const hard = document.querySelector(
      '.binding-row[data-command="hardReload"][data-key="<space>R"]',
    );

    assert.isTrue(soft != null);
    assert.isTrue(hard != null);
    assert.equal("Reload the page", soft.querySelector(".command-description").textContent);
    assert.equal("Hard reload the page", hard.querySelector(".command-description").textContent);
    assert.isFalse(soft.classList.contains("is-custom"));
    assert.isFalse(hard.classList.contains("is-custom"));
    assert.isTrue(soft.querySelector(".revert-binding").hidden);
    assert.isTrue(hard.querySelector(".revert-binding").hidden);
    assert.isFalse(soft.querySelector(".command-description").classList.contains("command-custom"));
    assert.isFalse(hard.querySelector(".command-description").classList.contains("command-custom"));
  });

  should("omit the removed alternate navigation and tab bindings", () => {
    for (
      const key of [
        "zj",
        "zk",
        "<c-o>",
        "<c-i>",
        "<c-w>h",
        "<c-w>l",
        "<c-w>w",
      ]
    ) {
      assert.equal(null, document.querySelector(`.binding-row[data-key="${key}"]`));
    }
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
    await Settings.set("keyMappings", "map q scrollUp");
    keybindingsPage.renderBindings();

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

  should("record and automatically save a key sequence from the binding cell", async () => {
    await recordShortcut("scrollDown", "j", [
      { code: "KeyQ", key: "q" },
      { code: "KeyQ", key: "q" },
    ]);

    const customMappings = Settings.get("keyMappings");
    assert.isTrue(customMappings.includes("unmap j"));
    assert.isTrue(customMappings.includes("map qq scrollDown"));
    assert.equal(customMappings, (await chrome.storage.sync.get("keyMappings")).keyMappings);

    const rebound = document.querySelector(
      '.binding-row[data-command="scrollDown"][data-key="qq"]',
    );
    assert.equal(
      ["q", "q"],
      Array.from(rebound.querySelectorAll("kbd")).map((key) => key.textContent),
    );
  });

  should("record modifier shortcuts", async () => {
    await recordShortcut("scrollDown", "j", [
      { code: "KeyD", ctrlKey: true, key: "d" },
    ]);

    assert.isTrue(Settings.get("keyMappings").includes("map <c-d> scrollDown"));
    const rebound = document.querySelector(
      '.binding-row[data-command="scrollDown"][data-key="<c-d>"]',
    );
    assert.equal(
      ["Ctrl", "d"],
      Array.from(rebound.querySelectorAll("kbd")).map((key) => key.textContent),
    );
    assert.equal("+", rebound.querySelector(".key-chord-joiner").textContent);
  });

  should("record a Ctrl chord followed by another key as a sequence", async () => {
    await recordShortcut("scrollDown", "j", [
      { code: "KeyW", ctrlKey: true, key: "w" },
      { code: "KeyL", key: "l" },
    ]);

    assert.isTrue(Settings.get("keyMappings").includes("map <c-w>l scrollDown"));
    const rebound = document.querySelector(
      '.binding-row[data-command="scrollDown"][data-key="<c-w>l"]',
    );
    assert.equal(
      ["Ctrl", "w", "l"],
      Array.from(rebound.querySelectorAll("kbd")).map((key) => key.textContent),
    );
    assert.equal("+", rebound.querySelector(".key-chord-joiner").textContent);
    assert.equal("›", rebound.querySelector(".key-sequence-separator").textContent);
  });

  should("record Space followed by another key as a sequence", async () => {
    await recordShortcut("scrollDown", "j", [
      { code: "Space", key: " " },
      { code: "KeyT", key: "t" },
    ]);

    assert.isTrue(Settings.get("keyMappings").includes("map <space>t scrollDown"));
    const rebound = document.querySelector(
      '.binding-row[data-command="scrollDown"][data-key="<space>t"]',
    );
    assert.equal(
      ["Space", "t"],
      Array.from(rebound.querySelectorAll("kbd")).map((key) => key.textContent),
    );
    assert.equal("›", rebound.querySelector(".key-sequence-separator").textContent);
  });

  should("move a shortcut away from a conflicting command", async () => {
    await recordShortcut("scrollDown", "j", [{ code: "KeyK", key: "k" }]);

    assert.equal(
      null,
      document.querySelector('.binding-row[data-command="scrollUp"][data-key="k"]'),
    );
    assert.isTrue(
      document.querySelector('.binding-row[data-command="scrollDown"][data-key="k"]') != null,
    );

    // The command that lost its default key should still get a restore control.
    const displaced = document.querySelector(
      '.binding-row[data-command="scrollUp"][data-key=""][data-revert-key="k"]',
    );
    assert.isTrue(displaced != null);
    assert.isFalse(displaced.querySelector(".revert-binding").hidden);
    assert.isTrue(displaced.classList.contains("is-custom"));
  });

  should("remove a binding with Escape while capturing", async () => {
    const row = document.querySelector('.binding-row[data-command="scrollDown"][data-key="j"]');
    const editor = row.querySelector(".binding-editor");
    assert.equal(null, row.querySelector(".clear-binding"));
    assert.equal(
      editor,
      row.querySelector(".revert-binding")?.nextElementSibling ??
        row.querySelector(".binding-editor"),
    );

    editor.click();
    editor.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        bubbles: true,
        code: "Escape",
        key: "Escape",
      }),
    );
    await waitForBindingSave();

    assert.isTrue(Settings.get("keyMappings").includes("unmap j"));
    assert.equal(
      null,
      document.querySelector('.binding-row[data-command="scrollDown"][data-key="j"]'),
    );
    const removedDefault = document.querySelector(
      '.binding-row[data-command="scrollDown"][data-key=""][data-revert-key="j"]',
    );
    assert.isTrue(removedDefault.classList.contains("is-custom"));
    assert.isFalse(removedDefault.querySelector(".revert-binding").hidden);
    // Revert control stays immediately left of the keybinding editor.
    assert.equal(
      removedDefault.querySelector(".binding-editor"),
      removedDefault.querySelector(".revert-binding").nextElementSibling,
    );
  });

  should("revert a changed binding to its default", async () => {
    await recordShortcut("scrollDown", "j", [{ code: "KeyX", key: "x" }]);

    const changed = document.querySelector(
      '.binding-row[data-command="scrollDown"][data-key="x"]',
    );
    assert.isFalse(changed.querySelector(".revert-binding").hidden);
    assert.equal(
      changed.querySelector(".binding-editor"),
      changed.querySelector(".revert-binding").nextElementSibling,
    );
    changed.querySelector(".revert-binding").click();
    await waitForBindingSave();

    assert.equal(
      null,
      document.querySelector('.binding-row[data-command="scrollDown"][data-key="x"]'),
    );
    const restored = document.querySelector(
      '.binding-row[data-command="scrollDown"][data-key="j"]',
    );
    assert.isTrue(restored != null);
    assert.isTrue(restored.querySelector(".revert-binding").hidden);
    assert.isTrue(Settings.get("keyMappings").includes("map j scrollDown"));
  });

  should("revert a removed default binding", async () => {
    const original = document.querySelector(
      '.binding-row[data-command="scrollDown"][data-key="j"]',
    );
    const editor = original.querySelector(".binding-editor");
    editor.click();
    editor.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        bubbles: true,
        code: "Escape",
        key: "Escape",
      }),
    );
    await waitForBindingSave();

    const removedDefault = document.querySelector(
      '.binding-row[data-command="scrollDown"][data-key=""][data-revert-key="j"]',
    );
    removedDefault.querySelector(".revert-binding").click();
    await waitForBindingSave();

    assert.isTrue(
      document.querySelector('.binding-row[data-command="scrollDown"][data-key="j"]') != null,
    );
    assert.equal(
      null,
      document.querySelector(
        '.binding-row[data-command="scrollDown"][data-key=""][data-revert-key="j"]',
      ),
    );
  });
});
