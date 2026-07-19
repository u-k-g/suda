// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
//
// This controls the contents of the CommandBar iframe. We use an iframe to avoid changing the
// selection on the page (useful for bookmarklets), ensure that the CommandBar style is unaffected by
// the page, and simplify key handling in suda_frontend.js
//

import "../lib/types.js";
import "../lib/utils.js";
import "../lib/url_utils.js";
import "../lib/settings.js";
import "../lib/keyboard_utils.js";
import "../lib/dom_utils.js";
import "../lib/handler_stack.js";
import { icon as phosphorIcon } from "../lib/phosphor_icons.js";
import * as UIComponentMessenger from "./ui_component_messenger.js";
import * as userSearchEngines from "../background_scripts/user_search_engines.js";

function formatKeyToken(token) {
  if (!token.startsWith("<")) return token;
  const parts = token.slice(1, -1).split("-");
  const modifierNames = {
    a: "Alt",
    c: "Ctrl",
    m: KeyboardUtils.platform == "Mac" ? "Cmd" : "Meta",
    s: "Shift",
  };
  const modifiers = [];
  while (modifierNames[parts[0]]) modifiers.push(modifierNames[parts.shift()]);
  const keyName = parts.join("-");
  const namedKeys = {
    backspace: "Backspace",
    delete: "Delete",
    down: "Down",
    end: "End",
    enter: "Enter",
    escape: "Escape",
    home: "Home",
    left: "Left",
    pagedown: "PageDown",
    pageup: "PageUp",
    right: "Right",
    space: "Space",
    tab: "Tab",
    up: "Up",
  };
  const displayKey = namedKeys[keyName] ??
    (modifiers.length > 0 && /^[a-z]$/.test(keyName) ? keyName.toUpperCase() : keyName);
  return [...modifiers, displayKey].join("-");
}

function renderKeybindings(keybindings) {
  if (keybindings.length === 0) return "";
  return keybindings.map((binding) =>
    `<span class="mode-keybinding">${
      (binding.match(/<[^>]+>|./g) ?? []).map((key) =>
        `<kbd>${Utils.escapeHtml(formatKeyToken(key))}</kbd>`
      ).join("")
    }</span>`
  ).join("");
}

function renderModeCompletion(mode, keybindings) {
  return {
    commandBarMode: mode.name,
    html: `<div class="completion-row mode-result">
      <span class="result-icon">${phosphorIcon(mode.icon)}</span>
      <span class="completion-copy">
        <span class="mode-name">${Utils.escapeHtml(mode.name)}</span>
        <span class="mode-description">${Utils.escapeHtml(mode.description)}</span>
      </span>
      <span class="completion-end">${renderKeybindings(keybindings)}</span>
    </div>`,
  };
}

function renderLinkActionCompletion(action, selectionCount) {
  const plural = selectionCount === 1 ? "" : "s";
  return {
    commandBarAction: action.name,
    html: `<div class="completion-row mode-result">
      <span class="result-icon">${phosphorIcon(action.icon)}</span>
      <span class="completion-copy">
        <span class="mode-name">${Utils.escapeHtml(action.label(selectionCount))}</span>
        <span class="mode-description">${Utils.escapeHtml(action.description + plural)}</span>
      </span>
    </div>`,
  };
}

const modeSelector = {
  name: "modes",
  description: "Choose a command-bar mode",
  aliases: "mode selector scopes",
  icon: "tornado",
  bindingCommands: ["CommandBar.activateModeSelection"],
};

const commandBarModes = [
  {
    name: "find",
    description: "Find text on the current page",
    aliases: "page search",
    action: true,
    icon: "magnifying-glass",
    bindingCommands: ["CommandBar.activateFind"],
  },
  {
    name: "search",
    description: "Search the web or open a URL in a new tab",
    aliases: "navigate url new tab",
    completer: "omni",
    newTab: true,
    icon: "globe",
    bindingCommands: ["CommandBar.activateInNewTab", "CommandBar.activate"],
  },
  {
    name: "history",
    description: "Search browsing history",
    aliases: "recent pages",
    completer: "history",
    selectFirst: true,
    icon: "clock-counter-clockwise",
    bindingCommands: ["CommandBar.activateHistory"],
  },
  {
    name: "tabs",
    description: "Fuzzy-search open tabs",
    aliases: "active open tab picker buffers",
    completer: "tabs",
    selectFirst: true,
    icon: "tabs",
    bindingCommands: ["CommandBar.activateTabSelection"],
  },
  {
    name: "bookmarks",
    description: "Search bookmarks",
    aliases: "favorites",
    completer: "bookmarks",
    selectFirst: true,
    icon: "folder-open",
    bindingCommands: ["CommandBar.activateBookmarks"],
  },
  {
    name: "url",
    description: "Edit the current URL",
    aliases: "address location current",
    completer: "omni",
    useCurrentUrl: true,
    icon: "pencil-simple",
    bindingCommands: ["CommandBar.activateEditUrl"],
  },
  {
    name: "commands",
    description: "Search and run extension commands",
    aliases: "palette actions",
    completer: "commands",
    selectFirst: true,
    icon: "command",
    bindingCommands: ["CommandBar.activateCommandSelection"],
  },
  {
    name: "marks",
    description: "Show and jump to marks on this page",
    aliases: "goto jump",
    completer: "local",
    selectFirst: true,
    icon: "map-pin",
    bindingCommands: ["CommandBar.activateMarks"],
  },
];

const linkActionMode = {
  name: "link-actions",
  description: "Choose an action for the selected links",
  aliases: "",
  completer: "local",
  selectFirst: true,
  icon: "link",
  bindingCommands: [],
};

const linkActions = [
  {
    name: "link-action:current",
    label: () => "Open in current tab",
    description: "Activate the selected link",
    icon: "link",
    singleOnly: true,
  },
  {
    name: "link-action:new",
    label: (count) => `Open in new tab${count === 1 ? "" : "s"}`,
    description: "Open the selected link",
    icon: "tabs",
  },
  {
    name: "link-action:copy",
    label: (count) => `Copy URL${count === 1 ? "" : "s"}`,
    description: "Copy the selected link URL",
    icon: "link",
  },
];

const commandBarModesByName = Object.fromEntries(
  [...commandBarModes, linkActionMode].map((mode) => [mode.name, mode]),
);

// An instance of CommandBarUI. Exported for use by tests.
export let ui;

// Used for tests.
export function reset() {
  ui = null;
}

export async function activate(options) {
  Utils.assertType(CommandBarShowOptions, options || {});
  await Settings.onLoaded();
  const commandToOptionsToKeys =
    (await chrome.storage.session.get("commandToOptionsToKeys")).commandToOptionsToKeys ?? {};
  userSearchEngines.set(Settings.get("searchEngines"));

  const defaults = {
    completer: "omni",
    query: "",
    newTab: true,
    selectFirst: true,
    keyword: null,
    prefixCount: 1,
    mode: "search",
    currentUrl: "",
    linkSelectionCount: 0,
  };

  options = Object.assign(defaults, options);

  if (ui == null) {
    ui = new CommandBarUI();
  }
  ui.setCommandToOptionsToKeys(commandToOptionsToKeys);
  ui.setShowModeDescriptions(Settings.get("showCommandBarModeDescriptions"));
  ui.currentUrl = options.currentUrl;
  ui.linkSelectionCount = options.linkSelectionCount;
  ui.setPrefixCount(options.prefixCount);
  ui.setMode(options.mode, {
    completer: options.completer,
    newTab: options.newTab,
    query: options.query,
    selectFirst: options.selectFirst,
  });
  ui.setActiveUserSearchEngine(userSearchEngines.keywordToEngine[options.keyword]);
  // Use await here for commandBar_test.js, so that this page doesn't get unloaded while a test is
  // running.
  await ui.update();
}

class CommandBarUI {
  constructor() {
    this.onKeyEvent = this.onKeyEvent.bind(this);
    this.onInput = this.onInput.bind(this);
    this.update = this.update.bind(this);
    this.onHiddenCallback = null;
    this.initDom();
    // The user's custom search engine, if they have prefixed their query with the keyword for one
    // of their search engines.
    this.activeUserSearchEngine = null;
    // Used for synchronizing requests and responses to the background page.
    this.lastRequestId = null;
  }

  setQuery(query) {
    this.input.value = query;
  }
  setActiveUserSearchEngine(userSearchEngine) {
    this.activeUserSearchEngine = userSearchEngine;
  }
  setInitialSelectionValue(initialSelectionValue) {
    this.initialSelectionValue = initialSelectionValue;
  }
  setForceNewTab(forceNewTab) {
    this.forceNewTab = forceNewTab;
  }
  setShowModeDescriptions(showDescriptions) {
    this.box.classList.toggle("show-mode-descriptions", showDescriptions);
  }
  setCommandToOptionsToKeys(commandToOptionsToKeys) {
    this.commandToOptionsToKeys = commandToOptionsToKeys;
  }
  getModeKeybindings(mode) {
    const keys = mode.bindingCommands.flatMap((command) =>
      Object.values(this.commandToOptionsToKeys[command] ?? {}).flat()
    );
    return Array.from(new Set(keys));
  }

  setMode(name, options = {}) {
    const mode = commandBarModesByName[name];
    const isModeless = name.length === 0;
    const isModeSelector = name === modeSelector.name;
    this.mode = name;
    this.setInitialSelectionValue(
      (options.selectFirst ?? mode?.selectFirst ?? true) ? 0 : -1,
    );
    this.setForceNewTab(options.newTab ?? mode?.newTab ?? isModeless);
    this.setCompleterName(
      options.completer ?? mode?.completer ?? (isModeless ? "omni" : "modes"),
    );
    const query = mode?.useCurrentUrl ? this.currentUrl : options.query ?? "";
    this.setQuery(query);

    this.modeIndicator.textContent = name === linkActionMode.name
      ? `links · ${this.linkSelectionCount}`
      : name;
    this.modeIndicator.hidden = isModeless;
    this.statusIndicator.hidden = true;
    this.input.placeholder = isModeless
      ? "Search or enter URL"
      : isModeSelector
      ? "Search command-bar modes"
      : name;
    UIComponentMessenger.postMessage({ name: "commandBarModeChanged", mode: name });
  }

  enterMode(name) {
    if (name === modeSelector.name) {
      this.setMode(name, { completer: "modes" });
      this.update();
      return;
    }
    const mode = commandBarModesByName[name];
    if (!mode) return;
    if (mode.action) {
      UIComponentMessenger.postMessage({ name: "commandBarAction", action: name });
      return;
    }
    this.setMode(name);
    this.refreshCompletions();
    this.update();
  }

  // name: one of [omni, bookmarks, commands, history, tabs, modes, local].
  setCompleterName(name) {
    this.completerName = name;
    const capitalize = (s) => s[0].toUpperCase() + s.slice(1);
    const placeholder = (name == "omni") ? "" : capitalize(name);
    this.input.setAttribute("placeholder", placeholder);
    this.reset();
  }

  setPrefixCount(prefixCount) {
    this.prefixCount = prefixCount;
  }

  // True if the user has entered the keyword of one of their custom search engines.
  isUserSearchEngineActive() {
    return this.activeUserSearchEngine != null;
  }
  isModelessSourceEnabled(source) {
    return this.mode !== "" ||
      !Settings.get("disabledModelessCommandBarSources").includes(source);
  }

  // The sequence of events when the commandBar is hidden:
  // 1. Post a "hide" message to the host page.
  // 2. The host page hides the commandBar.
  // 3. When that page receives the focus, it posts back a "hidden" message.
  // 4. Only once the "hidden" message is received here is onHiddenCallback called.
  //
  // This ensures that the commandBar is actually hidden before any new tab is created, and avoids
  // flicker after opening a link in a new tab then returning to the original tab. See #1485.
  hide(onHiddenCallback = null) {
    this.onHiddenCallback = onHiddenCallback;
    this.input.blur();
    this.reset();
    // Wait until this iframe's DOM has been rendered before hiding the iframe. This is to prevent
    // Chrome caching the previous visual state of the commandBar iframe. See #4708.
    setTimeout(() => {
      UIComponentMessenger.postMessage({ name: "hide" });
    }, 0);
  }

  onHidden() {
    UIComponentMessenger.postMessage({ name: "commandBarFinishMode", commit: false });
    this.onHiddenCallback?.();
    this.onHiddenCallback = null;
    this.reset();
  }

  reset() {
    this.input.value = "";
    this.completions = [];
    this.renderCompletions(this.completions);
    this.previousInputValue = null;
    this.activeUserSearchEngine = null;
    this.selection = this.initialSelectionValue;
    this.seenTabToOpenCompletionList = false;
    this.lastRequestId = null;
    this.marks = [];
  }

  updateSelection() {
    // For suggestions from custom search engines, we copy the suggestion's text into the input when
    // the suggestion is selected, and revert when it is not. This allows the user to select a
    // suggestion and then continue typing.
    const completion = this.completions[this.selection];
    const shouldReplaceInputWithSuggestion = this.selection >= 0 &&
      completion.insertText != null;
    if (shouldReplaceInputWithSuggestion) {
      if (this.previousInputValue == null) {
        this.previousInputValue = this.input.value;
      }
      this.input.value = completion.insertText;
    } else if (this.previousInputValue != null) {
      this.input.value = this.previousInputValue;
      this.previousInputValue = null;
    }

    // Highlight the selected entry.
    for (const [i, el] of Object.entries(this.completionList.children)) {
      el.className = i == this.selection ? "selected" : "";
    }

    // Keep keyboard navigation anchored to something visible. The completion list is its own
    // scroll container, so "nearest" moves it only when the selected row crosses an edge.
    const selectedElement = this.completionList.children[this.selection];
    selectedElement?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }

  // Returns the user's action ("up", "down", "tab", etc, or null) based on their keypress. We
  // support the arrow keys and various other shortcuts, and this function hides the event-decoding
  // complexity.
  actionFromKeyEvent(event) {
    const key = KeyboardUtils.getKeyChar(event);
    // Handle <Enter> on "keypress", and other events on "keydown". This avoids interence with CJK
    // translation (see #2915 and #2934).
    if ((event.type === "keypress") && (key !== "enter")) return null;
    if ((event.type === "keydown") && (key === "enter")) return null;
    if (KeyboardUtils.isEscape(event)) {
      return "dismiss";
    } else if (
      (key === "up") ||
      (event.shiftKey && (event.key === "Tab")) ||
      (event.ctrlKey && ((key === "k") || (key === "p")))
    ) {
      return "up";
    } else if ((event.key === "Tab") && !event.shiftKey) {
      return "tab";
    } else if (
      (key === "down") ||
      (event.ctrlKey && ((key === "j") || (key === "n")))
    ) {
      return "down";
    } else if (event.ctrlKey && (key === "enter")) {
      return "ctrl-enter";
    } else if (event.key === "Enter") {
      return "enter";
    } else if ((event.key === "Delete") && event.shiftKey && !event.ctrlKey && !event.altKey) {
      return "remove";
    } else if (KeyboardUtils.isBackspace(event)) {
      return "delete";
    }

    return null;
  }

  async onKeyEvent(event) {
    if (
      event.type === "keydown" && this.mode === "marks" &&
      event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey
    ) {
      UIComponentMessenger.postMessage({
        name: "commandBarMark",
        key: event.key,
        shiftKey: event.shiftKey,
      });
      event.stopImmediatePropagation();
      event.preventDefault();
      return;
    }

    const action = this.actionFromKeyEvent(event);
    if (!action) {
      return;
    }

    if (action === "dismiss") {
      UIComponentMessenger.postMessage({ name: "commandBarFinishMode", commit: false });
      this.hide();
    } else if (["tab", "down"].includes(action)) {
      if (
        (action === "tab") &&
        (this.completerName === "omni") &&
        !this.seenTabToOpenCompletionList &&
        (this.input.value.trim().length === 0)
      ) {
        this.seenTabToOpenCompletionList = true;
        this.update();
      } else if (this.completions.length > 0) {
        this.selection += 1;
        if (this.selection === this.completions.length) {
          this.selection = this.initialSelectionValue;
        }
        this.updateSelection();
      }
    } else if (action === "up") {
      this.selection -= 1;
      if (this.selection < this.initialSelectionValue) {
        this.selection = this.completions.length - 1;
      }
      this.updateSelection();
    } else if (action === "enter") {
      await this.handleEnterKey(event);
    } else if (action === "ctrl-enter") {
      // Populate the commandBar with the current selection's URL.
      if (
        !this.isUserSearchEngineActive() && this.completerName != "commands" &&
        (this.selection >= 0)
      ) {
        if (this.previousInputValue == null) {
          this.previousInputValue = this.input.value;
        }
        this.input.value = this.completions[this.selection]?.url;
        this.input.scrollLeft = this.input.scrollWidth;
      }
    } else if (action === "delete") {
      if (this.mode !== "" && this.input.value.length === 0) {
        this.setMode("");
        await this.update();
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
      if (this.isUserSearchEngineActive() && (this.input.selectionEnd === 0)) {
        // Normally, with custom search engines, the keyword (e.g. the "w" of "w query terms") is
        // suppressed. If the cursor is at the start of the input, then reinstate the keyword (the
        // "w").
        const keyword = this.activeUserSearchEngine.keyword;
        this.input.value = keyword + this.input.value.trimStart();
        this.input.selectionStart = this.input.selectionEnd = keyword.length;
        this.activeUserSearchEngine = null;
        this.update();
      } else if (this.seenTabToOpenCompletionList && (this.input.value.trim().length === 0)) {
        this.seenTabToOpenCompletionList = false;
        this.update();
      } else {
        return; // Do not suppress event.
      }
    } else if ((action === "remove") && (this.selection >= 0)) {
      const completion = this.completions[this.selection];
      console.log(completion);
    }

    event.stopImmediatePropagation();
    event.preventDefault();
  }

  async handleEnterKey(event) {
    const isPrimarySearchSuggestion = (c) => c?.isPrimarySuggestion && c?.isCustomSearch;
    let query = this.input.value.trim();

    // Note that it's possible that this.completions is empty. This can happen in practice if the
    // user hits enter quickly after loading the commandBar, before the filterCompletions request to
    // the background page finishes.
    const waitingOnCompletions = this.completions.length == 0;
    const completion = this.completions[this.selection];

    // "modes" is the modeless command bar's built-in route to the selector. Handle it from the
    // input itself too, so pressing Enter before asynchronous completions arrive still works.
    if (this.mode === "" && query.toLowerCase() === modeSelector.name) {
      this.enterMode(modeSelector.name);
      return;
    }

    if (completion?.commandBarMode) {
      this.enterMode(completion.commandBarMode);
      return;
    }
    if (this.mode === modeSelector.name) return;

    if (this.mode === "marks" && completion?.mark) {
      UIComponentMessenger.postMessage({
        name: "commandBarMark",
        key: completion.mark.key,
        shiftKey: completion.mark.scope === "global",
        create: false,
      });
      return;
    }

    if (this.mode === linkActionMode.name && completion?.commandBarAction) {
      UIComponentMessenger.postMessage({
        name: "commandBarAction",
        action: completion.commandBarAction,
      });
      return;
    }

    const openInNewTab = this.forceNewTab || event.shiftKey || event.ctrlKey || event.altKey ||
      event.metaKey;

    // If the user types something and hits enter without selecting a completion from the list,
    // then:
    //   - If they've activated a custom search engine in the CommandBar, launch that search using the
    //     typed-in query.
    //   - Otherwise, open the query as a URL or create a default search as appropriate.
    //
    //  When launching a query in a custom search engine, the user may have typed more text than
    //  that which is included in the URL associated with the primary suggestion, because the
    //  suggestions are updated asynchronously. Therefore, to avoid a race condition, we construct
    //  the search URL from the actual contents of the input (query).
    if (waitingOnCompletions || this.selection == -1) {
      // <Enter> on an empty query is a no-op.
      if (query.length == 0) return;

      // If the user typed a custom search engine keyword, use that directly. This handles the race
      // condition where the user hits Enter before the async completions response arrives
      // (waitingOnCompletions).
      if (this.isUserSearchEngineActive()) {
        query = UrlUtils.createSearchUrl(query, this.activeUserSearchEngine.url);
        this.hide(() => this.launchUrl(query, openInNewTab));
        return;
      }

      // <Enter> with no selection on a completer other than "omni" is a no-op.
      if (this.completerName != "omni") return;

      const firstCompletion = this.completions[0];
      const isPrimary = isPrimarySearchSuggestion(firstCompletion);
      if (isPrimary) {
        query = UrlUtils.createSearchUrl(query, firstCompletion.searchUrl);
        await this.launchUrl(query);
      } else {
        // If the query looks like a URL, try to open it directly. Otherwise, pass the query to
        // the user's default search engine.
        // TODO(philc):
        const isUrl = await UrlUtils.isUrl(query);
        if (isUrl) {
          this.hide(() => this.launchUrl(query, openInNewTab));
        } else {
          this.hide(() =>
            chrome.runtime.sendMessage({
              handler: "launchSearchQuery",
              query,
              openInNewTab,
            })
          );
        }
      }
    } else if (isPrimarySearchSuggestion(completion)) {
      query = UrlUtils.createSearchUrl(query, completion.searchUrl);
      this.hide(() => this.launchUrl(query, openInNewTab));
    } else if (completion.verbatimQuery != null) {
      await this.launchVerbatimQuery(completion.verbatimQuery, openInNewTab);
    } else if (completion.command) {
      this.hide(async () => {
        await chrome.runtime.sendMessage({
          handler: "runNormalModeCommand",
          command: completion.command.registryEntry,
          count: this.prefixCount,
        });
      });
    } else {
      this.hide(() => this.openCompletion(completion, openInNewTab));
    }
  }

  async launchVerbatimQuery(query, openInNewTab) {
    if (await UrlUtils.isUrl(query)) {
      this.hide(() => this.launchUrl(query, openInNewTab));
    } else {
      this.hide(() =>
        chrome.runtime.sendMessage({
          handler: "launchSearchQuery",
          query,
          openInNewTab,
        })
      );
    }
  }

  // Return the background-page query corresponding to the current input state. In other words,
  // reinstate any search engine keyword which is currently being suppressed, and strip any prompted
  // text.
  getInputValueAsQuery() {
    const prefix = this.isUserSearchEngineActive() ? this.activeUserSearchEngine.keyword + " " : "";
    return prefix + this.input.value;
  }

  async updateCompletions() {
    if (this.completerName === "modes") {
      const query = this.input.value.trim().toLowerCase();
      const queryTerms = query.split(/\s+/).filter(Boolean);
      const disabledModes = new Set(Settings.get("disabledCommandBarModes"));
      this.completions = commandBarModes.filter((mode) => !disabledModes.has(mode.name)).map(
        (mode, index) => {
          const name = mode.name.toLowerCase();
          const aliases = mode.aliases.toLowerCase();
          const description = mode.description.toLowerCase();
          const haystack = `${name} ${description} ${aliases}`;
          if (!queryTerms.every((term) => haystack.includes(term))) return null;

          let rank = 4;
          if (query === name) rank = 0;
          else if (name.startsWith(query)) rank = 1;
          else if (queryTerms.every((term) => name.includes(term))) rank = 2;
          else if (queryTerms.every((term) => aliases.includes(term))) rank = 3;
          return { mode, index, rank };
        },
      ).filter(Boolean).sort((a, b) => a.rank - b.rank || a.index - b.index).map(({ mode }) =>
        renderModeCompletion(mode, this.getModeKeybindings(mode))
      );
      this.selection = this.completions.length > 0 ? 0 : -1;
      this.renderCompletions(this.completions);
      this.updateSelection();
      return;
    }

    if (this.completerName === "local") {
      if (this.mode === "marks") {
        const query = this.input.value.toLowerCase();
        this.completions = this.marks.filter((mark) =>
          mark.key.toLowerCase().includes(query) || mark.scope.includes(query)
        ).map((mark) => ({
          mark,
          html: `<div class="completion-row mark-result">
            <span class="result-icon">${phosphorIcon("map-pin")}</span>
            <span class="completion-copy">
              <span class="mark-key">${Utils.escapeHtml(mark.key)}</span>
              <span class="mark-scope">${mark.scope} mark</span>
            </span>
          </div>`,
        }));
        this.selection = this.completions.length > 0 ? 0 : -1;
      } else if (this.mode === linkActionMode.name) {
        const query = this.input.value.trim().toLowerCase();
        this.completions = linkActions.filter((action) =>
          !action.singleOnly || this.linkSelectionCount === 1
        ).filter((action) =>
          `${action.label(this.linkSelectionCount)} ${action.description}`.toLowerCase().includes(
            query,
          )
        ).map((action) => renderLinkActionCompletion(action, this.linkSelectionCount));
        this.selection = this.completions.length > 0 ? 0 : -1;
      } else {
        this.completions = [];
        this.selection = -1;
      }
      this.renderCompletions(this.completions);
      this.updateSelection();
      return;
    }

    const requestId = Utils.createUniqueId();
    this.lastRequestId = requestId;
    const query = this.getInputValueAsQuery();
    const queryTerms = query.trim().split(/\s+/).filter((s) => s.length > 0);

    const results = await chrome.runtime.sendMessage({
      handler: "filterCompletions",
      completerName: this.completerName,
      commandBarMode: this.mode,
      queryTerms,
      query,
      seenTabToOpenCompletionList: this.seenTabToOpenCompletionList ||
        this.completerName === "history",
      showAllOnEmpty: this.mode === "" || ["bookmarks", "commands"].includes(this.mode),
      disabledModelessCommandBarSources: this.mode === ""
        ? Settings.get("disabledModelessCommandBarSources")
        : [],
    });

    // Ensure that no new filter requests have gone out while waiting for this result.
    if (this.lastRequestId != requestId) return;

    this.completions = results;
    const verbatimQuery = this.input.value.trim();
    const supportsVerbatimQuery = ["search", "url"].includes(this.mode) ||
      (this.mode === "" && this.isModelessSourceEnabled("search"));
    if (
      supportsVerbatimQuery && verbatimQuery.length > 0 && !this.isUserSearchEngineActive()
    ) {
      const isUrlMode = this.mode === "url";
      const verbatimCompletion = {
        verbatimQuery,
        html: `<div class="completion-row">
          <span class="result-icon">${
          phosphorIcon(
            isUrlMode ? "pencil-simple" : "magnifying-glass",
          )
        }</span>
          <span class="completion-copy">
            <span class="top-half">
              <span class="source">${isUrlMode ? "url" : "search"}</span>
              <span class="title">${Utils.escapeHtml(verbatimQuery)}</span>
            </span>
          </span>
        </div>`,
      };
      const modeSelectorMatches = this.mode === "" &&
        modeSelector.name.includes(verbatimQuery.toLowerCase());
      const modeSelectorCompletion = renderModeCompletion(
        modeSelector,
        this.getModeKeybindings(modeSelector),
      );
      const leadingCompletions = verbatimQuery.toLowerCase() === modeSelector.name &&
          this.mode === ""
        ? [modeSelectorCompletion, verbatimCompletion]
        : modeSelectorMatches
        ? [verbatimCompletion, modeSelectorCompletion]
        : [verbatimCompletion];
      this.completions = [...leadingCompletions, ...this.completions].slice(0, 10);
    }
    this.selection = this.completions[0]?.autoSelect ? 0 : this.initialSelectionValue;
    this.renderCompletions(this.completions);
    this.selection = Math.min(
      this.completions.length - 1,
      Math.max(this.initialSelectionValue, this.selection),
    );
    this.updateSelection();
  }

  renderCompletions(completions) {
    this.completionList.innerHTML = completions.map((c) => `<li>${c.html}</li>`).join("\n");
    this.completionList.style.display = completions.length > 0 ? "block" : "none";
    this.box.classList.toggle("has-completions", completions.length > 0);
  }

  refreshCompletions() {
    if (["modes", "local"].includes(this.completerName)) return;
    chrome.runtime.sendMessage({
      handler: "refreshCompletions",
      completerName: this.completerName,
    });
  }

  cancelCompletions() {
    if (["modes", "local"].includes(this.completerName)) return;
    // Let the background page's completer optionally abandon any pending query, because the user is
    // typing and another query will arrive soon.
    chrome.runtime.sendMessage({
      handler: "cancelCompletions",
      completerName: this.completerName,
    });
  }

  onInput() {
    this.seenTabToOpenCompletionList = false;
    this.cancelCompletions();

    if (["modes", "local"].includes(this.completerName)) {
      this.update();
      return;
    }

    // For custom search engines, we suppress the leading prefix (e.g. the "w" of "w query terms")
    // within the commandBar input.
    if (
      this.isModelessSourceEnabled("search") && !this.isUserSearchEngineActive() &&
      this.getUserSearchEngineForQuery() != null
    ) {
      this.activeUserSearchEngine = this.getUserSearchEngineForQuery();
      const queryTerms = this.input.value.trim().split(/\s+/);
      this.input.value = queryTerms.slice(1).join(" ");
    }

    // If the user types, then don't reset any previous text, and reset the selection.
    if (this.previousInputValue != null) {
      this.previousInputValue = null;
      this.selection = -1;
    }
    this.update();
  }

  // Returns the UserSearchEngine for the given query. Returns null if the query does not begin with
  // a keyword from one of the user's search engines.
  getUserSearchEngineForQuery() {
    // This logic is duplicated from SearchEngineCompleter.getEngineForQueryPrefix
    const parts = this.input.value.trimStart().split(/\s+/);
    // For a keyword "w", we match "w search terms" and "w ", but not "w" on its own.
    const keyword = parts[0];
    if (parts.length <= 1) return null;
    // Don't match queries for built-in properties like "constructor". See #4396.
    if (Object.hasOwn(userSearchEngines.keywordToEngine, keyword)) {
      return userSearchEngines.keywordToEngine[keyword];
    }
    return null;
  }

  async update() {
    await this.updateCompletions();
    this.input.focus();
  }

  openCompletion(completion, openInNewTab) {
    if (completion.description == "tab") {
      chrome.runtime.sendMessage({ handler: "selectSpecificTab", id: completion.tabId });
    } else {
      this.launchUrl(completion.url, openInNewTab);
    }
  }

  async launchUrl(url, openInNewTab) {
    // If the URL is a bookmarklet (so, prefixed with "javascript:"), then always open it in the
    // current tab.
    if (openInNewTab && UrlUtils.hasJavascriptProtocol(url)) {
      openInNewTab = false;
    }
    await chrome.runtime.sendMessage({
      handler: openInNewTab ? "openUrlInNewTab" : "openUrlInCurrentTab",
      url,
    });
  }

  initDom() {
    this.box = document.getElementById("commandBar");

    this.input = this.box.querySelector("input");
    this.modeIndicator = document.getElementById("command-bar-mode");
    this.statusIndicator = document.getElementById("command-bar-status");
    this.input.addEventListener("input", this.onInput);
    this.input.addEventListener("keydown", this.onKeyEvent);
    this.input.addEventListener("keypress", this.onKeyEvent);
    this.completionList = this.box.querySelector("ul");
    this.completionList.style.display = "none";

    window.addEventListener("focus", () => this.input.focus());
    // A click in the commandBar itself refocuses the input.
    this.box.addEventListener("click", (event) => {
      this.input.focus();
      return event.stopImmediatePropagation();
    });
    // A click anywhere else hides the commandBar.
    document.addEventListener("click", () => {
      UIComponentMessenger.postMessage({ name: "commandBarFinishMode", commit: false });
      this.hide();
    });
  }
}

function init() {
  UIComponentMessenger.init();
  UIComponentMessenger.registerHandler(function (event) {
    switch (event.data.name) {
      case "hide":
        ui?.hide();
        break;
      case "hidden":
        ui?.onHidden();
        break;
      case "commandBarMarks":
        if (ui?.mode === "marks") {
          ui.marks = event.data.marks;
          ui.update();
        }
        break;
      case "activate":
        const options = Object.assign({}, event.data);
        delete options.name;
        activate(options);
        break;
      default:
        Utils.assert(false, "Unrecognized message type.", event.data);
    }
  });
}

const testEnv = globalThis.window == null ||
  globalThis.window.location.search.includes("dom_tests=true");
if (!testEnv) {
  document.addEventListener("DOMContentLoaded", async () => {
    await Settings.onLoaded();
    DomUtils.injectUserCss(); // Manually inject custom user styles.
  });
  init();
}
