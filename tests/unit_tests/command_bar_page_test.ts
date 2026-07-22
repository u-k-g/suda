// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import * as testHelper from "./test_helper.js";
import "../../tests/unit_tests/test_chrome_stubs.js";
import {
  CommandCompleter,
  MultiCompleter,
  Suggestion,
} from "../../background_scripts/completion/completers.js";
import * as commandBarPage from "../../pages/command_bar_page.js";
import * as userSearchEngines from "../../background_scripts/user_search_engines.js";
import { allCommands } from "../../background_scripts/all_commands.js";
import { Commands, RegistryEntry } from "../../background_scripts/commands.js";
import { filterCompleter } from "./completion/completers_test.js";

function newKeyEvent(properties) {
  return Object.assign(
    {
      type: "keydown",
      key: "a",
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      stopImmediatePropagation: function () {},
      preventDefault: function () {},
    },
    properties,
  );
}

context("commandBar page", () => {
  let ui;
  setup(async () => {
    await testHelper.jsdomStub("pages/command_bar_page.html");
    stub(chrome.runtime, "sendMessage", async (message) => {
      if (message.handler == "filterCompletions") {
        return [];
      }
    });
    commandBarPage.reset();
    await commandBarPage.activate();
    ui = commandBarPage.ui;
  });

  teardown(() => {
    if (!Settings.isLoaded()) return;
    Settings._settings.disabledCommandBarModes = structuredClone(
      Settings.defaultOptions.disabledCommandBarModes,
    );
    Settings._settings.disabledModelessCommandBarSources = structuredClone(
      Settings.defaultOptions.disabledModelessCommandBarSources,
    );
  });

  should("hide when escape is pressed", async () => {
    ui.setQuery("www.example.com");
    // Here we assert that the dialog has been reset when esc is pressed, which happens as part of
    // hiding the dialog. It would be better to check more directly that the dialog was hidden, but
    // jacking into the channels for this are not worthwhile for this test.
    await ui.onKeyEvent(newKeyEvent({ key: "Escape" }));
    assert.equal("", ui.input.value);
  });

  should("hide when the command bar window loses focus", () => {
    ui.setQuery("www.example.com");
    window.dispatchEvent(new window.Event("blur"));
    assert.equal("", ui.input.value);
  });

  should("preserve a pending completion callback while hiding", () => {
    let callbackWasCalled = false;
    ui.hide(() => callbackWasCalled = true);
    window.dispatchEvent(new window.Event("blur"));
    ui.onHidden();
    assert.isTrue(callbackWasCalled);
  });

  should("recover from an interrupted hide when reactivated", async () => {
    ui.hide();
    assert.isTrue(ui.isHiding);

    await commandBarPage.activate();
    assert.isFalse(ui.isHiding);

    ui.setQuery("www.example.com");
    await ui.onKeyEvent(newKeyEvent({ key: "Escape" }));
    assert.equal("", ui.input.value);
    assert.isTrue(ui.isHiding);
  });

  should("use the bold command-bar search icon", () => {
    const searchIcon = document.querySelector(".command-bar-search-icon");
    assert.equal("bold", searchIcon.dataset.phosphorWeight);
    assert.isTrue(searchIcon.classList.contains("ph-icon-bold"));
  });

  should("open without an active mode as the combined command bar", async () => {
    await commandBarPage.activate({ mode: "", completer: "omni", newTab: true });

    assert.equal("", ui.mode);
    assert.isTrue(ui.modeIndicator.hidden);
    assert.equal("omni", ui.completerName);
    assert.equal("Search or enter URL", ui.input.placeholder);
    assert.isTrue(ui.forceNewTab);
  });

  should("exclude legacy link-action modes from the mode selector", async () => {
    await commandBarPage.activate({ mode: "modes", completer: "modes" });
    ui.setQuery("copy link");
    await ui.update();

    assert.equal("modes", ui.mode);
    assert.isFalse(ui.modeIndicator.hidden);
    assert.equal([], ui.completions);
  });

  should("exclude the removed keybindings mode from the mode selector", async () => {
    await commandBarPage.activate({ mode: "modes", completer: "modes" });
    ui.setQuery("keybindings");
    await ui.update();

    assert.equal([], ui.completions);
  });

  should("show link actions for one selected link", async () => {
    await commandBarPage.activate({
      mode: "link-actions",
      completer: "local",
      linkSelectionCount: 1,
    });

    assert.equal("links · 1", ui.modeIndicator.textContent);
    assert.equal(
      ["link-action:current", "link-action:new", "link-action:copy"],
      ui.completions.map((completion) => completion.commandBarAction),
    );
    assert.equal(0, ui.selection);
  });

  should("omit current-tab activation for multiple selected links", async () => {
    await commandBarPage.activate({
      mode: "link-actions",
      completer: "local",
      linkSelectionCount: 2,
    });

    assert.equal("links · 2", ui.modeIndicator.textContent);
    assert.equal(
      ["link-action:new", "link-action:copy"],
      ui.completions.map((completion) => completion.commandBarAction),
    );
    assert.equal(0, ui.selection);
  });

  should("hide user-disabled modes from the mode selector", async () => {
    Settings._settings.disabledCommandBarModes = ["tabs"];
    await commandBarPage.activate({ mode: "modes", completer: "modes" });
    ui.setQuery("tabs");
    await ui.update();

    assert.isFalse(ui.completions.some((completion) => completion.commandBarMode === "tabs"));
  });

  should("render mode shortcuts from the live key mappings", async () => {
    await chrome.storage.session.set({
      commandToOptionsToKeys: {
        "CommandBar.activateTabSelection": { "": ["<space>b"] },
      },
    });
    await commandBarPage.activate({ mode: "modes", completer: "modes" });
    ui.setQuery("tabs");
    await ui.update();
    assert.equal(
      ["Space", "b"],
      Array.from(ui.completionList.firstElementChild.querySelectorAll("kbd")).map((element) =>
        element.textContent
      ),
    );
    await chrome.storage.session.remove("commandToOptionsToKeys");
  });

  should("hide mode descriptions by default and allow enabling them", async () => {
    await commandBarPage.activate({ mode: "modes", completer: "modes" });
    assert.isFalse(ui.box.classList.contains("show-mode-descriptions"));

    await Settings.set("showCommandBarModeDescriptions", true);
    await commandBarPage.activate({ mode: "modes", completer: "modes" });
    assert.isTrue(ui.box.classList.contains("show-mode-descriptions"));
    await Settings.set("showCommandBarModeDescriptions", false);
  });

  should("launch find as an action instead of opening a second centered input", async () => {
    await commandBarPage.activate({ mode: "modes", completer: "modes" });
    ui.setQuery("find");
    await ui.update();
    await ui.onKeyEvent(newKeyEvent({ type: "keypress", key: "Enter" }));

    assert.equal("modes", ui.mode);
    assert.equal("modes", ui.completerName);
  });

  should("enter the mode selector by searching for modes while modeless", async () => {
    await commandBarPage.activate({ mode: "", completer: "omni", newTab: true });
    ui.setQuery("modes");
    await ui.update();

    assert.equal("modes", ui.completions[0].commandBarMode);
    await ui.onKeyEvent(newKeyEvent({ type: "keypress", key: "Enter" }));

    assert.equal("modes", ui.mode);
    assert.equal("modes", ui.completerName);
  });

  should("enter the mode selector before modeless completions finish", async () => {
    await commandBarPage.activate({ mode: "", completer: "omni", newTab: true });
    ui.setQuery("modes");
    ui.completions = [];

    await ui.onKeyEvent(newKeyEvent({ type: "keypress", key: "Enter" }));

    assert.equal("modes", ui.mode);
    assert.equal("modes", ui.completerName);
  });

  should("put the exact typed query first for nonempty modeless queries", async () => {
    let launchedSearch = null;
    stub(chrome.runtime, "sendMessage", async (message) => {
      if (message.handler === "filterCompletions") return [];
      if (message.handler === "launchSearchQuery") launchedSearch = message;
    });
    await commandBarPage.activate({ mode: "", completer: "omni", newTab: true });
    ui.setQuery("what is");
    await ui.update();

    assert.equal("what is", ui.completions[0].verbatimQuery);
    assert.equal(0, ui.selection);
    assert.equal("what is", ui.completionList.querySelector(".title").textContent);

    await ui.onKeyEvent(newKeyEvent({ type: "keypress", key: "Enter" }));
    ui.onHidden();
    assert.equal("what is", launchedSearch.query);
    assert.isTrue(launchedSearch.openInNewTab);
  });

  should("put the exact typed query first in search and URL modes", async () => {
    stub(chrome.runtime, "sendMessage", async (message) => {
      if (message.handler === "filterCompletions") {
        return [{
          kind: "history",
          source: "history",
          title: "Suggestion",
          titleMatches: [],
          url: "https://suggestion.example",
          displayUrl: "suggestion.example",
          urlMatches: [],
        }];
      }
    });

    for (const mode of ["search", "url"]) {
      await commandBarPage.activate({
        mode,
        completer: "omni",
        currentUrl: "",
        newTab: mode === "search",
      });
      ui.setQuery("exactly what I typed");
      await ui.update();

      assert.equal("exactly what I typed", ui.completions[0].verbatimQuery);
      assert.equal("exactly what I typed", ui.completionList.querySelector(".title").textContent);
      assert.equal(0, ui.selection);
    }
  });

  should("omit disabled sources only from the modeless command bar", async () => {
    let modelessRequest = null;
    stub(chrome.runtime, "sendMessage", async (message) => {
      if (message.handler === "filterCompletions") {
        modelessRequest = message;
        return [];
      }
    });
    Settings._settings.disabledModelessCommandBarSources = ["search", "history"];
    await commandBarPage.activate({ mode: "", completer: "omni", newTab: true });
    ui.setQuery("needle");
    await ui.update();

    assert.equal(["search", "history"], modelessRequest.disabledModelessCommandBarSources);
    assert.equal([], ui.completions);

    await commandBarPage.activate({ mode: "search", completer: "omni", newTab: true });
    ui.setQuery("needle");
    await ui.update();
    assert.equal("needle", ui.completions[0].verbatimQuery);
  });

  should("return from a mode to modeless search with backspace on an empty query", async () => {
    await commandBarPage.activate({ mode: "find", completer: "local" });
    await ui.onKeyEvent(newKeyEvent({ key: "Backspace" }));

    assert.equal("", ui.mode);
    assert.equal("omni", ui.completerName);
  });

  should("scroll the selected completion into view", () => {
    ui.renderCompletions([
      { kind: "verbatim", title: "first", titleMatches: [] },
      { kind: "verbatim", title: "second", titleMatches: [] },
    ]);
    let scrollOptions = null;
    ui.completionList.children[1].scrollIntoView = (options) => scrollOptions = options;
    ui.completions = [{}, {}];
    ui.selection = 1;

    ui.updateSelection();

    assert.equal("selected", ui.completionList.children[1].className);
    assert.equal({ block: "nearest", inline: "nearest" }, scrollOptions);
  });

  should("edit a completion's URL when ctrl-enter is pressed", async () => {
    stub(chrome.runtime, "sendMessage", async (message) => {
      if (message.handler == "filterCompletions") {
        const s = new Suggestion({ url: "http://hello.com" });
        return [s.toCompletion()];
      }
    });
    await ui.update();
    await ui.onKeyEvent(newKeyEvent({ type: "keydown", key: "up" }));
    // TODO(philc): Why does this need to be lowercase enter?
    await ui.onKeyEvent(newKeyEvent({ type: "keypress", ctrlKey: true, key: "enter" }));
    assert.equal("http://hello.com", ui.input.value);
  });

  should("open a URL-like search-mode query in a new tab", async () => {
    ui.setQuery("www.example.com");
    let handler = null;
    let url = null;
    stub(chrome.runtime, "sendMessage", async (message) => {
      if (message.handler === "filterCompletions") return [];
      handler = message.handler;
      url = message.url;
    });
    await ui.update();
    assert.equal("www.example.com", ui.completions[0].verbatimQuery);
    await ui.onKeyEvent(newKeyEvent({ type: "keypress", key: "Enter" }));
    ui.onHidden();
    assert.equal("openUrlInNewTab", handler);
    assert.equal("www.example.com", url);
  });

  should("open a URL from new-tab URL mode in the current tab", async () => {
    await commandBarPage.activate({
      mode: "url",
      completer: "omni",
      currentUrl: "",
      newTab: false,
    });
    assert.equal("url", ui.mode);
    assert.equal("", ui.input.value);

    ui.setQuery("www.example.com");
    let handler = null;
    stub(chrome.runtime, "sendMessage", async (message) => {
      if (message.handler === "filterCompletions") return [];
      handler = message.handler;
    });
    await ui.update();
    assert.equal("www.example.com", ui.completions[0].verbatimQuery);
    await ui.onKeyEvent(newKeyEvent({ type: "keypress", key: "Enter" }));
    ui.onHidden();

    assert.equal("openUrlInCurrentTab", handler);
  });

  should("search for a non-URL query when enter is pressed", async () => {
    ui.setQuery("example");
    let handler = null;
    let query = null;
    stub(chrome.runtime, "sendMessage", async (message) => {
      handler = message.handler;
      query = message.query;
    });
    await ui.onKeyEvent(newKeyEvent({ type: "keypress", key: "Enter" }));
    ui.onHidden();
    assert.equal("launchSearchQuery", handler);
    assert.equal("example", query);
  });

  // This test covers #4396.
  should("not treat javascript keywords as user-defined search engines", async () => {
    ui.setQuery("constructor "); // "constructor" is a built-in JS property
    ui.onInput();
    // The query should not be treated as a user search engine.
    assert.equal("constructor ", ui.input.value);
  });

  should("use custom search engine when enter is pressed before completions arrive", async () => {
    userSearchEngines.set("e: https://www.example.com/search?q=%s Example");

    let capturedUrl = null;
    stub(chrome.runtime, "sendMessage", async (message) => {
      // Return a never-resolving promise for filterCompletions to simulate the race condition where
      // the user hits Enter before the background page responds with completions.
      if (message.handler === "filterCompletions") return new Promise(() => {});
      if (message.handler === "openUrlInNewTab") capturedUrl = message.url;
    });

    ui.setQuery("e hello");
    ui.onInput();
    // completions is empty because the filterCompletions stub, above, is unresolved.
    assert.equal(0, ui.completions.length);

    await ui.onKeyEvent(newKeyEvent({ type: "keypress", key: "Enter" }));
    ui.onHidden();

    assert.equal("https://www.example.com/search?q=hello", capturedUrl);
  });

  should("offer only one search mode and one URL-edit mode", async () => {
    Settings._settings.disabledCommandBarModes = [];
    await commandBarPage.activate({ mode: "modes", completer: "modes" });
    ui.setQuery("url");
    await ui.update();
    const urlModes = ui.completions.map((completion) => completion.commandBarMode)
      .filter((mode) => ["url", "search"].includes(mode));
    assert.equal(["url", "search"], urlModes);
  });

  should("rank an exact mode-name match above matches in another mode's aliases", async () => {
    await commandBarPage.activate({ mode: "modes", completer: "modes" });
    ui.setQuery("tabs");
    await ui.update();

    assert.equal("tabs", ui.completions[0].commandBarMode);
    assert.equal(0, ui.selection);
  });

  should("collapse to the input row when there are no completions", () => {
    ui.renderCompletions([]);

    assert.equal("none", ui.completionList.style.display);
    assert.isFalse(ui.box.classList.contains("has-completions"));
  });

  should("render structured completions without interpreting result text as HTML", () => {
    ui.renderCompletions([{
      kind: "tab",
      source: "tab",
      title: "Title <img src=x>",
      titleMatches: [],
      url: "https://example.com",
      displayUrl: "example.com",
      urlMatches: [],
    }]);

    assert.equal("Title <img src=x>", ui.completionList.querySelector(".title").textContent);
    assert.equal(1, ui.completionList.querySelectorAll("img").length);
    assert.isTrue(
      ui.completionList.querySelector(".completion-row").classList.contains(
        "tab-completion",
      ),
    );
    assert.isTrue(ui.completionList.querySelector(".tab-action") != null);
  });

  should("keep direct mark creation out of the mode selector", async () => {
    await commandBarPage.activate({ mode: "modes", completer: "modes" });
    ui.setQuery("mark");
    await ui.update();

    assert.isFalse(
      ui.completions.some((completion) => completion.commandBarMode === "mark:create"),
    );
  });

  should("create command suggestions with correct HTML for key bindings", async () => {
    await Commands.loadKeyMappings("");
    const multiCompleter = new MultiCompleter([new CommandCompleter()]);
    const suggestions = await filterCompleter(multiCompleter, ["go", "tab", "right"]);
    stub(chrome.runtime, "sendMessage", async () => suggestions);
    await ui.updateCompletions();
    assert.equal(1, ui.completionList.childNodes.length);
    const keys = Array.from(ui.completionList.querySelectorAll(".key")).map((x) => x.textContent);
    assert.equal(["gn", "<c-w>w", "<c-w>l"], keys);
  });
});
