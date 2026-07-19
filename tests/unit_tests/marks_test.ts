// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import "./test_helper.js";
import * as marks from "../../background_scripts/marks.js";

context("marks", () => {
  const createMark = async (markProperties, tabProperties) => {
    const mark = Object.assign({ scrollX: 0, scrollY: 0 }, markProperties);
    const tab = Object.assign({ url: "http://example.com" }, tabProperties);
    const sender = { tab: tab };
    await marks.create(mark, sender);
  };

  setup(() => {
    chrome.storage.session.clear();
    chrome.storage.session.set({ sudaSecret: "secret" });
  });

  teardown(() => {
    chrome.storage.session.clear();
    chrome.storage.local.clear();
  });

  should("record the suda secret in the mark's info", async () => {
    await createMark({ markName: "a" });
    const key = marks.getLocationKey("a");
    const savedMark = (await chrome.storage.local.get(key))[key];
    assert.equal("secret", savedMark.sudaSecret);
  });

  should("ignore a tab which closes while its scroll position is requested", async () => {
    stub(globalThis.chrome.tabs, "sendMessage", () => {
      throw new Error("No tab with id: 1648448648.");
    });
    await createMark({ markName: "a", scrollX: null, scrollY: null }, { id: 1648448648 });
    const savedMark = await chrome.storage.local.get(marks.getLocationKey("a"));
    assert.equal({}, savedMark);
  });

  should("surface unexpected errors while requesting a mark's scroll position", async () => {
    stub(globalThis.chrome.tabs, "sendMessage", () => {
      throw new Error("Unexpected failure");
    });
    let caughtError = null;
    try {
      await createMark({ markName: "a", scrollX: null, scrollY: null }, { id: 1 });
    } catch (error) {
      caughtError = error;
    }
    assert.equal("Unexpected failure", caughtError?.message);
  });

  should("goto a mark when its tab exists", async () => {
    await createMark({ markName: "A" }, { id: 1 });
    const tab = { url: "http://example.com" };
    stub(globalThis.chrome.tabs, "get", (id) => id == 1 ? tab : null);
    const updatedTabs = [];
    stub(globalThis.chrome.tabs, "update", (id, properties) => updatedTabs[id] = properties);
    let positionMessage;
    stub(globalThis.chrome.tabs, "sendMessage", (_id, message) => positionMessage = message);
    await marks.goto({ markName: "A" });
    assert.isTrue(updatedTabs[1] && updatedTabs[1].active);
    assert.equal(
      {
        handler: "setScrollPosition",
        scrollX: 0,
        scrollY: 0,
        markName: "A",
      },
      positionMessage,
    );
  });

  should("ignore a marked tab which closes immediately before activation", async () => {
    await createMark({ markName: "A" }, { id: 1 });
    stub(globalThis.chrome.tabs, "get", () => ({ id: 1, url: "http://example.com" }));
    stub(globalThis.chrome.tabs, "update", async () => {
      throw new Error("No tab with id: 1.");
    });

    await marks.goto({ markName: "A" });
  });

  should("find a new tab if a mark's tab no longer exists", async () => {
    await createMark({ markName: "A" }, { id: 1 });
    const tab = { url: "http://example.com", id: 2 };
    stub(globalThis.chrome.tabs, "get", (_id) => {
      throw new Error();
    });
    stub(globalThis.chrome.tabs, "query", (_) => [tab]);
    const updatedTabs = [];
    stub(globalThis.chrome.tabs, "update", (id, properties) => updatedTabs[id] = properties);
    await marks.goto({ markName: "A" });
    assert.isTrue(updatedTabs[2] && updatedTabs[2].active);
  });
});
