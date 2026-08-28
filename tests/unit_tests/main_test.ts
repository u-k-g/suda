// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import "./test_helper.js";
import "../../lib/settings.js";
import "../../background_scripts/main.js";
import { RegistryEntry } from "../../background_scripts/commands.js";
import * as bgUtils from "../../background_scripts/bg_utils.js";

context("extension command", () => {
  teardown(() => {
    chrome.runtime.lastError = undefined;
    if (Settings.isLoaded()) {
      Settings._settings.commandBarOnly = Settings.defaultOptions.commandBarOnly;
      Settings._settings.disabledActions = [];
    }
  });

  should("suggest the native new-tab shortcut for the all-mode command palette", () => {
    const command = chrome.runtime.getManifest().commands["open-command-bar"];
    assert.equal("Open Suda's all-mode command palette", command.description);
    assert.equal("Ctrl+T", command.suggested_key.default);
    assert.equal("Command+T", command.suggested_key.mac);
  });

  should("suggest platform shortcuts for searching copied text", () => {
    const command = chrome.runtime.getManifest().commands["search-copied-text-in-new-tab"];
    assert.equal("Search copied text in a new tab", command.description);
    assert.equal("Ctrl+Shift+V", command.suggested_key.default);
    assert.equal("Command+Shift+V", command.suggested_key.mac);
  });

  should("open the command palette over the active tab", async () => {
    let sentMessage;
    let sentOptions;
    stub(chrome.tabs, "sendMessage", async (tabId, message, options) => {
      sentMessage = { tabId, message };
      sentOptions = options;
    });

    await handleExtensionCommand("open-command-bar", { id: 42 });

    assert.equal(42, sentMessage.tabId);
    assert.equal("runInTopFrame", sentMessage.message.handler);
    assert.equal("CommandPalette.activateAll", sentMessage.message.registryEntry.command);
    assert.equal({ frameId: 0 }, sentOptions);
  });

  should("keep the native command palette available in command-palette-only mode", async () => {
    let sentMessage;
    await Settings.onLoaded();
    Settings._settings.commandBarOnly = true;
    stub(chrome.tabs, "sendMessage", async (_tabId, message) => sentMessage = message);

    await handleExtensionCommand("open-command-bar", { id: 42 });

    assert.equal("CommandPalette.activateAll", sentMessage.registryEntry.command);
  });

  should("search copied text globally without messaging the active tab", async () => {
    let offscreenCreateDetails;
    let runtimeMessage;
    let searchDetails;
    let tabWasMessaged = false;
    stub(chrome.runtime, "getURL", (path) => `chrome-extension://suda/${path}`);
    stub(chrome.runtime, "getContexts", async () => []);
    stub(chrome.runtime, "sendMessage", async (message) => {
      runtimeMessage = message;
      return { text: "copied search query" };
    });
    stub(chrome, "offscreen", {
      createDocument: async (details) => offscreenCreateDetails = details,
    });
    stub(chrome.tabs, "sendMessage", () => tabWasMessaged = true);
    stub(chrome.search, "query", async (details) => searchDetails = details);

    await handleExtensionCommand("search-copied-text-in-new-tab", undefined);

    assert.equal("pages/offscreen.html", offscreenCreateDetails.url);
    assert.equal(["CLIPBOARD"], offscreenCreateDetails.reasons);
    assert.equal({ handler: "readClipboardText", target: "offscreen" }, runtimeMessage);
    assert.equal({ disposition: "NEW_TAB", text: "copied search query" }, searchDetails);
    assert.isFalse(tabWasMessaged);
  });

  should("ignore the native command-palette shortcut when its action is disabled", async () => {
    let tabWasMessaged = false;
    await Settings.onLoaded();
    Settings._settings.disabledActions = ["CommandPalette.activateAll"];
    stub(chrome.tabs, "sendMessage", () => tabWasMessaged = true);

    await handleExtensionCommand("open-command-bar", { id: 42 });

    assert.isFalse(tabWasMessaged);
  });

  should(
    "find the active tab when Chrome does not provide it to the command listener",
    async () => {
      let tabsQuery;
      let messagedTabId;
      stub(chrome.tabs, "query", async (query) => {
        tabsQuery = query;
        return [{ id: 42 }];
      });
      stub(chrome.tabs, "sendMessage", async (tabId) => messagedTabId = tabId);

      await handleExtensionCommand("open-command-bar", undefined);

      assert.equal({ active: true, lastFocusedWindow: true }, tabsQuery);
      assert.equal(42, messagedTabId);
    },
  );

  should("repair a pre-extension-reload tab before opening the command palette", async () => {
    let sendCount = 0;
    let executeDetails;
    stub(chrome.tabs, "sendMessage", async () => {
      sendCount += 1;
      if (sendCount === 1) {
        throw new Error("Could not establish connection. Receiving end does not exist.");
      }
    });
    stub(chrome.scripting, "insertCSS", async () => {});
    stub(chrome.scripting, "executeScript", async (details) => executeDetails = details);

    await handleExtensionCommand("open-command-bar", { id: 42 });

    assert.equal(2, sendCount);
    assert.equal({ tabId: 42, frameIds: [0] }, executeDetails.target);
    assert.equal(chrome.runtime.getManifest().content_scripts[0].js, executeDetails.files);
  });

  should("open a command-palette new-tab fallback when the current page is protected", async () => {
    let createdTab;
    stub(chrome.runtime, "getURL", (path) => `chrome-extension://suda/${path}`);
    stub(chrome.tabs, "sendMessage", async () => {
      throw new Error("Could not establish connection. Receiving end does not exist.");
    });
    stub(chrome.scripting, "insertCSS", async () => {
      throw new Error("Cannot access a chrome:// URL");
    });
    stub(chrome.scripting, "executeScript", async () => {
      throw new Error("Cannot access a chrome:// URL");
    });
    stub(chrome.tabs, "create", async (properties) => createdTab = properties);

    await handleExtensionCommand("open-command-bar", { id: 42, index: 3, windowId: 7 });

    assert.equal(true, createdTab.active);
    assert.equal(42, createdTab.openerTabId);
    assert.equal(4, createdTab.index);
    assert.equal(7, createdTab.windowId);
    assert.equal(
      "chrome-extension://suda/pages/new_tab.html?sudaCommandBar=all",
      createdTab.url,
    );
  });
});

context("HintCoordinator", () => {
  should("prepareToActivateLinkHintsMode", async () => {
    let receivedMessages = [];
    const frameIdToHintDescriptors = {
      "0": { frameId: 0, localIndex: 123, linkText: null },
      "1": { frameId: 1, localIndex: 456, linkText: null },
    };

    stub(chrome.webNavigation, "getAllFrames", () => [{ frameId: 0 }, { frameId: 1 }]);

    stub(chrome.tabs, "sendMessage", async (_tabId, message, options) => {
      if (message.messageType == "getHintDescriptors") {
        return frameIdToHintDescriptors[options.frameId];
      } else if (message.messageType == "activateMode") {
        receivedMessages.push(message);
      }
    });

    await HintCoordinator.prepareToActivateLinkHintsMode(0, 0, {
      modeIndex: 0,
      requestedByHelpDialog: false,
    });

    receivedMessages = receivedMessages.map(
      (m) => Utils.pick(m, ["frameId", "frameIdToHintDescriptors"]),
    );

    // Each frame should receive only the hint descriptors from the other frames.
    assert.equal([
      { frameId: 0, frameIdToHintDescriptors: { "1": frameIdToHintDescriptors[1] } },
      { frameId: 1, frameIdToHintDescriptors: { "0": frameIdToHintDescriptors[0] } },
    ], receivedMessages);
  });
});

context("createTab command", () => {
  let tabCreated;
  let requestStub;

  setup(async () => {
    stub(chrome.tabs, "create", (args) => {
      tabCreated = args;
    });
    requestStub = {
      registryEntry: new RegistryEntry({ options: {} }),
      tab: {},
      count: 1,
    };
    await Settings.load();
  });

  should("open the provided URL", async () => {
    requestStub.url = "https://example.com";
    await BackgroundCommands.createTab(requestStub);
    assert.equal("https://example.com", tabCreated.url);
  });

  should("open the suda new tab page", async () => {
    await Settings.set("newTabDestination", Settings.newTabDestinations.sudaNewTabPage);
    await BackgroundCommands.createTab(requestStub);
    assert.equal(Settings.sudaNewTabPageUrl, tabCreated.url);
  });

  should("open the browser's new tab page", async () => {
    await Settings.set("newTabDestination", Settings.newTabDestinations.browserNewTabPage);
    await BackgroundCommands.createTab(requestStub);
    // The URL argument to chrome.tabs.create is omitted when we want to use the browser's NTP.
    assert.isTrue(tabCreated != null);
    assert.equal(undefined, tabCreated.url);
  });

  should("open custom URL", async () => {
    await Settings.set("newTabDestination", Settings.newTabDestinations.customUrl);
    await BackgroundCommands.createTab(requestStub);
    // If a specific custom URL isn't provided, the browser's new tab page will be used.
    // The URL argument to chrome.tabs.create is omitted when we want to use the browser's NTP.
    assert.isTrue(tabCreated != null);
    assert.equal(undefined, tabCreated.url);

    await Settings.set("newTabCustomUrl", "http://example.com");
    await BackgroundCommands.createTab(requestStub);
    assert.equal("http://example.com", tabCreated.url);
  });

  teardown(() => {
    tabCreated = null;
    Settings.clear();
  });
});

context("excludeAllSudaKeys command", () => {
  should("save an all-keys site exclusion and refresh the current tab", async () => {
    await Settings.onLoaded();
    await Settings.set("exclusionRules", []);
    let sentMessage;
    stub(chrome.tabs, "sendMessage", async (tabId, message) => {
      sentMessage = { tabId, message };
    });

    await BackgroundCommands.excludeAllSudaKeys({
      tab: { id: 42, url: "https://example.com/current/page" },
    });

    assert.equal(
      [{ pattern: "https?://example.com/*", passKeys: "" }],
      Settings.get("exclusionRules"),
    );
    assert.equal(
      { tabId: 42, message: { handler: "refreshEnabledState" } },
      sentMessage,
    );
    await Settings.clear();
  });
});

context("openOptionsPage command", () => {
  should("open Suda's options page in the next tab", async () => {
    let tabCreated;
    stub(chrome.runtime, "getURL", (path) => `chrome-extension://suda/${path}`);
    stub(chrome.tabs, "create", (properties) => tabCreated = properties);

    await BackgroundCommands.openOptionsPage({ tab: { index: 3 } });

    assert.equal({
      url: "chrome-extension://suda/pages/options.html#general",
      index: 4,
    }, tabCreated);
  });
});

context("openKeybindingsPage command", () => {
  should("open the keybindings section of the unified settings page", async () => {
    let tabCreated;
    stub(chrome.runtime, "getURL", (path) => `chrome-extension://suda/${path}`);
    stub(chrome.tabs, "create", (properties) => tabCreated = properties);

    await BackgroundCommands.openKeybindingsPage({ tab: { index: 3 } });

    assert.equal({
      url: "chrome-extension://suda/pages/options.html#keybindings",
      index: 4,
    }, tabCreated);
  });
});

context("reload commands", () => {
  should("keep normal and hard reload as distinct browser actions", async () => {
    const reloads = [];
    const tab = { id: 42, index: 0, windowId: 7 };
    stub(chrome.tabs, "query", async () => [tab]);
    stub(chrome.tabs, "reload", async (tabId, options) => reloads.push({ tabId, options }));

    await BackgroundCommands.reload({ count: 1, tab });
    await BackgroundCommands.hardReload({ count: 1, tab });

    assert.equal([
      { tabId: 42, options: { bypassCache: false } },
      { tabId: 42, options: { bypassCache: true } },
    ], reloads);
  });
});

context("selectSpecificTab", () => {
  should(
    "ignore a tab which closed after its command-palette suggestion was rendered",
    async () => {
      stub(chrome.tabs, "get", async () => {
        throw new Error("No tab with id: 123.");
      });

      assert.isFalse(await selectSpecificTab({ id: 123 }));
    },
  );

  should("preserve unexpected tab-selection failures", async () => {
    stub(chrome.tabs, "get", async () => {
      throw new Error("Unexpected failure");
    });
    let caughtError = null;
    try {
      await selectSpecificTab({ id: 123 });
    } catch (error) {
      caughtError = error;
    }

    assert.equal("Unexpected failure", caughtError?.message);
  });
});

context("tab navigation", () => {
  should("ignore a target tab which closes after the tab list is queried", async () => {
    const tabs = [
      { id: 1, index: 0, pinned: false },
      { id: 2, index: 1, pinned: false },
    ];
    stub(chrome.tabs, "query", async () => tabs);
    stub(chrome.tabs, "update", async () => {
      throw new Error("No tab with id: 2.");
    });

    await BackgroundCommands.nextTab({ count: 1, tab: tabs[0] });
  });

  should("skip tabs in collapsed tab groups", async () => {
    const tabs = [
      { id: 1, index: 0, groupId: -1, windowId: 7 },
      { id: 2, index: 1, groupId: 20, windowId: 7 },
      { id: 3, index: 2, groupId: -1, windowId: 7 },
    ];
    let selectedTabId;
    stub(chrome.tabs, "query", async () => tabs);
    stub(chrome.tabGroups, "query", async () => [{ id: 20, collapsed: true }]);
    stub(chrome.tabs, "update", async (id) => selectedTabId = id);

    await BackgroundCommands.nextTab({ count: 1, tab: tabs[0] });

    assert.equal(3, selectedTabId);
  });
});

context("search queries", () => {
  should("open a Shift-Enter search in a background tab after the current tab", async () => {
    let createConfig;
    let searchInfo;
    stub(chrome.tabs, "create", async (config) => {
      createConfig = config;
      return { id: 99 };
    });
    stub(chrome.search, "query", async (info) => searchInfo = info);

    await BackgroundCommands.launchSearchQuery({
      query: "background search",
      openInNewTab: true,
      active: false,
      tab: { id: 42, index: 3, windowId: 7 },
    });

    assert.equal(false, createConfig.active);
    assert.equal(4, createConfig.index);
    assert.equal(7, createConfig.windowId);
    assert.equal(42, createConfig.openerTabId);
    assert.equal("background search", searchInfo.text);
    assert.equal(99, searchInfo.tabId);
  });
});

context("numbered tab slots", () => {
  setup(() => chrome.storage.session.remove("tabSlots"));

  should("assign and visit a numbered tab slot", async () => {
    const tabs = [
      { id: 10, title: "One", windowId: 1 },
      { id: 20, title: "Two", windowId: 1 },
    ];
    let selectedTabId;
    stub(chrome.tabs, "query", async () => tabs);
    stub(chrome.tabs, "get", async (id) => tabs.find((tab) => tab.id === id));
    stub(chrome.tabs, "sendMessage", async () => {});
    stub(chrome.tabs, "update", async (id) => selectedTabId = id);
    stub(chrome.windows, "update", async () => {});

    await BackgroundCommands.pinTabToSlot({
      tab: tabs[1],
      registryEntry: { options: { slot: "3" } },
    });
    await BackgroundCommands.goToTabSlot({ registryEntry: { options: { slot: "3" } } });

    assert.equal({ "3": 20 }, (await chrome.storage.session.get("tabSlots")).tabSlots);
    assert.equal(20, selectedTabId);
  });

  should("cycle only assigned slots in numeric order", async () => {
    const tabs = [
      { id: 10, title: "Unassigned", windowId: 1 },
      { id: 20, title: "Slot two", windowId: 1 },
      { id: 30, title: "Slot five", windowId: 1 },
    ];
    let activeTabId = 10;
    const selectedTabIds = [];
    await chrome.storage.session.set({ tabSlots: { "2": 20, "5": 30 } });
    stub(chrome.tabs, "query", async (queryInfo) => {
      if (queryInfo.active) return [{ id: activeTabId }];
      return tabs;
    });
    stub(chrome.tabs, "get", async (id) => tabs.find((tab) => tab.id === id));
    stub(chrome.tabs, "sendMessage", async () => {});
    stub(chrome.tabs, "update", async (id) => {
      activeTabId = id;
      selectedTabIds.push(id);
    });
    stub(chrome.windows, "update", async () => {});

    await BackgroundCommands.cycleTabSlots({ tab: tabs[0] });
    await BackgroundCommands.cycleTabSlots({ tab: tabs[1] });
    await BackgroundCommands.cycleTabSlots({ tab: tabs[2] });

    assert.equal([20, 30, 20], selectedTabIds);
  });
});

context("cycleRecentTabs command", () => {
  let cycleSize;
  let cycleTimeoutMs;
  let now;
  let recencyOrder;
  let selectedTabIds;
  let activeTabId;

  setup(async () => {
    await chrome.storage.session.remove("tabSlots");
    cycleSize = 5;
    cycleTimeoutMs = 400;
    now = 1000;
    recencyOrder = [1, 2, 3, 4, 5, 6, 7];
    selectedTabIds = [];
    activeTabId = 1;
    resetRecentTabCycle();
    const getSetting = Settings.get.bind(Settings);
    stub(Settings, "get", (key) => {
      if (key === "recentTabCycleSize") return cycleSize;
      if (key === "recentTabCycleTimeoutMs") return cycleTimeoutMs;
      return getSetting(key);
    });
    stub(Date, "now", () => now);
    stub(bgUtils.tabRecency, "init", async () => {});
    stub(bgUtils.tabRecency, "getTabsByRecency", () => recencyOrder);
    stub(
      chrome.tabs,
      "query",
      async (queryInfo) => {
        if (queryInfo.active) return [{ id: activeTabId }];
        return recencyOrder.map((id) => ({ id, lastAccessed: 100 - id }));
      },
    );
    stub(chrome.tabs, "get", async (id) => ({ id, windowId: 1 }));
    stub(chrome.windows, "update", async () => {});
    stub(chrome.tabs, "update", async (id) => {
      activeTabId = id;
      selectedTabIds.push(id);
    });
  });

  should("cycle a fixed list of five total recent tabs within 400ms", async () => {
    await BackgroundCommands.cycleRecentTabs({ tab: { id: 1 } });
    for (const currentTabId of [2, 3, 4, 5, 1]) {
      now += 250;
      await BackgroundCommands.cycleRecentTabs({ tab: { id: currentTabId } });
    }

    assert.equal([2, 3, 4, 5, 1, 2], selectedTabIds);
  });

  should("respect the configured cycle size", async () => {
    cycleSize = 3;
    await BackgroundCommands.cycleRecentTabs({ tab: { id: 1 } });
    for (const currentTabId of [2, 3, 1]) {
      now += 250;
      await BackgroundCommands.cycleRecentTabs({ tab: { id: currentTabId } });
    }

    assert.equal([2, 3, 1, 2], selectedTabIds);
  });

  should("serialize rapid presses without admitting a less-recent tab", async () => {
    await Promise.all(
      Array.from(
        { length: 6 },
        () => BackgroundCommands.cycleRecentTabs({ tab: { id: 1 } }),
      ),
    );

    assert.equal([2, 3, 4, 5, 1, 2], selectedTabIds);
  });

  should("restart from the actual active tab after an external tab switch", async () => {
    await BackgroundCommands.cycleRecentTabs({ tab: { id: 1 } });
    now += 100;
    activeTabId = 6;
    recencyOrder = [6, 2, 1, 5, 4, 3, 7];

    await BackgroundCommands.cycleRecentTabs({ tab: { id: 6 } });

    assert.equal([2, 2], selectedTabIds);
  });

  should("continue the cycle within the configured timeout", async () => {
    cycleTimeoutMs = 1200;
    await BackgroundCommands.cycleRecentTabs({ tab: { id: 1 } });
    now += 1000;
    recencyOrder = [2, 6, 5, 4, 3, 1, 7];
    await BackgroundCommands.cycleRecentTabs({ tab: { id: 2 } });

    assert.equal([2, 3], selectedTabIds);
  });

  should("restart from the most recent non-current tab after the configured timeout", async () => {
    cycleTimeoutMs = 1200;
    await BackgroundCommands.cycleRecentTabs({ tab: { id: 1 } });
    now += 1201;
    recencyOrder = [2, 6, 5, 4, 3, 1, 7];
    await BackgroundCommands.cycleRecentTabs({ tab: { id: 2 } });

    assert.equal([2, 6], selectedTabIds);
  });
});

context("Next zoom level", () => {
  // All these tests use the Chrome zoom levels, which are the default.
  should("Zoom in 0 times", async () => {
    const zoom = await nextZoomLevel(1.00, 0);
    assert.equal(1.00, zoom);
  });

  should("Zoom in 1", async () => {
    const zoom = await nextZoomLevel(1.00, 1);
    assert.equal(1.10, zoom);
  });

  should("Zoom out 1", async () => {
    const zoom = await nextZoomLevel(1.00, -1);
    assert.equal(0.90, zoom);
  });

  should("Zoom in 2", async () => {
    const zoom = await nextZoomLevel(1.00, 2);
    assert.equal(1.25, zoom);
  });

  should("Zoom out 2", async () => {
    const zoom = await nextZoomLevel(1.00, -2);
    assert.equal(0.80, zoom);
  });

  should("Zoom in from between values", async () => {
    const zoom = await nextZoomLevel(1.05, 1);
    assert.equal(1.10, zoom);
  });

  should("Zoom out from between values", async () => {
    const zoom = await nextZoomLevel(1.05, -1);
    assert.equal(1.00, zoom);
  });

  should("Zoom in past the maximum", async () => {
    const zoom = await nextZoomLevel(1.00, 15);
    assert.equal(5.00, zoom);
  });

  should("Zoom out past the minimum", async () => {
    const zoom = await nextZoomLevel(1.00, -15);
    assert.equal(0.25, zoom);
  });

  should("Zoom in from below the minimum", async () => {
    const lowZoom = 0.01; // Lowest non-broken Chrome zoom level
    const zoom = await nextZoomLevel(lowZoom, 1);
    assert.equal(0.25, zoom);
  });

  should("Zoom out from above the maximum", async () => {
    const highZoom = 9.99; // highest non-broken Chrome zoom level
    const zoom = await nextZoomLevel(highZoom, -1);
    assert.equal(5.00, zoom);
  });

  should("Zoom in from above the maximum", async () => {
    const highZoom = 9.99; // highest non-broken Chrome zoom level
    const zoom = await nextZoomLevel(highZoom, 1);
    assert.equal(5.00, zoom);
  });

  should("Zoom out from below the minimum", async () => {
    const lowZoom = 0.01; // lowest non-broken Chrome zoom level
    const zoom = await nextZoomLevel(lowZoom, -1);
    assert.equal(0.25, zoom);
  });

  should("Test Chrome 33% zoom in with float error", async () => {
    const floatZoom = 0.32999999999999996; // The value chrome actually gives for 33%.
    const zoom = await nextZoomLevel(floatZoom, 1);
    assert.equal(0.50, zoom);
  });

  should("Test Chrome 175% zoom in with float error", async () => {
    const floatZoom = 1.7499999999999998; // The value chrome actually gives for 175%.
    const zoom = await nextZoomLevel(floatZoom, 1);
    assert.equal(2.00, zoom);
  });
});

context("Selecting frames", () => {
  should("nextFrame", async () => {
    const focusedFrames = [];
    stub(chrome.webNavigation, "getAllFrames", () => [{ frameId: 1 }, { frameId: 2 }]);
    stub(chrome.tabs, "sendMessage", async (_tabId, message, options) => {
      if (message.handler == "getFocusStatus") {
        return { focused: options.frameId == 2, focusable: true };
      } else if (message.handler == "focusFrame") {
        focusedFrames.push(options.frameId);
      }
    });

    await BackgroundCommands.nextFrame(1, 0);
    assert.equal([1], focusedFrames);
  });
});
