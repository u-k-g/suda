// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import "./test_helper.js";
import "../../lib/settings.js";
import "../../background_scripts/main.js";
import { RegistryEntry } from "../../background_scripts/commands.js";
import * as bgUtils from "../../background_scripts/bg_utils.js";

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

context("selectSpecificTab", () => {
  should("ignore a tab which closed after its command-bar suggestion was rendered", async () => {
    stub(chrome.tabs, "get", async () => {
      throw new Error("No tab with id: 123.");
    });

    assert.isFalse(await selectSpecificTab({ id: 123 }));
  });

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
});

context("cycleRecentTabs command", () => {
  let now;
  let recencyOrder;
  let selectedTabIds;

  setup(() => {
    now = 1000;
    recencyOrder = [1, 2, 3, 4, 5, 6, 7];
    selectedTabIds = [];
    resetRecentTabCycle();
    stub(Date, "now", () => now);
    stub(bgUtils.tabRecency, "init", async () => {});
    stub(bgUtils.tabRecency, "getTabsByRecency", () => recencyOrder);
    stub(
      chrome.tabs,
      "query",
      async () => recencyOrder.map((id) => ({ id, lastAccessed: 100 - id })),
    );
    stub(chrome.tabs, "get", async (id) => ({ id, windowId: 1 }));
    stub(chrome.windows, "update", async () => {});
    stub(chrome.tabs, "update", async (id) => selectedTabIds.push(id));
  });

  should("cycle a fixed list of five recent tabs within 800ms", async () => {
    await BackgroundCommands.cycleRecentTabs({ tab: { id: 1 } });
    for (const currentTabId of [2, 3, 4, 5, 6]) {
      now += 500;
      await BackgroundCommands.cycleRecentTabs({ tab: { id: currentTabId } });
    }

    assert.equal([2, 3, 4, 5, 6, 2], selectedTabIds);
  });

  should("restart from the most recent non-current tab after 800ms", async () => {
    await BackgroundCommands.cycleRecentTabs({ tab: { id: 1 } });
    now += 801;
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
