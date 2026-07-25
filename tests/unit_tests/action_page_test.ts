// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import * as testHelper from "./test_helper.js";
import "../../tests/unit_tests/test_chrome_stubs.js";
import { ActionPage } from "../../pages/action.js";

context("action page", () => {
  setup(async () => {
    await testHelper.jsdomStub("pages/action.html");
    await Settings.clear();
    await Settings.onLoaded();
    ActionPage.contentScriptRetryDelays = [0];
  });

  teardown(async () => {
    await Settings.clear();
    await Settings.onLoaded();
  });

  should("leave an already-running content script alone", async () => {
    let injections = 0;
    stub(chrome.tabs, "query", () => [{ id: 42, url: "https://example.com/" }]);
    stub(chrome.tabs, "sendMessage", async () => {});
    stub(chrome.scripting, "executeScript", () => injections++);

    await ActionPage.init();

    assert.equal(0, injections);
    assert.equal("none", document.querySelector("#not-enabled-error").style.display);
    assert.isFalse(document.querySelector("#dialog-body").style.display === "none");
  });

  should("repairs a scriptable page when the toolbar action is invoked", async () => {
    let installed = false;
    let executed;
    stub(chrome.tabs, "query", () => [{
      id: 42,
      index: 3,
      url: "https://example.com/",
      windowId: 7,
    }]);
    stub(chrome.tabs, "sendMessage", async () => {
      if (!installed) throw new Error("Receiving end does not exist.");
    });
    stub(chrome.scripting, "insertCSS", async () => {});
    stub(chrome.scripting, "executeScript", async (details) => {
      executed = details;
      installed = true;
    });

    await ActionPage.init();

    assert.equal({ tabId: 42, frameIds: [0] }, executed.target);
    assert.equal(
      chrome.runtime.getManifest().content_scripts[0].js,
      executed.files,
    );
    assert.equal("none", document.querySelector("#not-enabled-error").style.display);
  });

  should("explains how to enable local-file access", async () => {
    stub(chrome.tabs, "query", () => [{ id: 42, url: "file:///tmp/readme.html" }]);
    stub(chrome.tabs, "sendMessage", async () => {
      throw new Error("Receiving end does not exist.");
    });
    stub(chrome.scripting, "insertCSS", async () => {
      throw new Error("Cannot access contents of url");
    });
    stub(chrome.extension, "isAllowedFileSchemeAccess", async () => false);

    await ActionPage.init();

    assert.equal(
      "Suda needs access to local files.",
      document.querySelector("#not-enabled-title").textContent,
    );
    assert.isFalse(document.querySelector("#manage-extension-access").hidden);
  });

  should("keeps browser-protected pages distinct from recoverable sites", async () => {
    stub(chrome.tabs, "query", () => [{ id: 42, url: "chrome://extensions/" }]);
    stub(chrome.tabs, "sendMessage", async () => {
      throw new Error("Receiving end does not exist.");
    });
    stub(chrome.scripting, "insertCSS", async () => {
      throw new Error("Cannot access a chrome:// URL");
    });

    await ActionPage.init();

    assert.equal(
      "This page is protected by the browser.",
      document.querySelector("#not-enabled-title").textContent,
    );
    assert.isTrue(document.querySelector("#manage-extension-access").hidden);
  });

  should("offers the extension command bar as a protected-page fallback", async () => {
    let created;
    const tab = { id: 42, index: 3, url: "chrome://extensions/", windowId: 7 };
    stub(chrome.tabs, "create", (properties) => created = properties);
    stub(chrome.runtime, "getURL", (path) => `chrome-extension://suda/${path}`);

    await ActionPage.openCommandBarFallback(tab);

    assert.equal(true, created.active);
    assert.equal(4, created.index);
    assert.equal(42, created.openerTabId);
    assert.equal(7, created.windowId);
    assert.isTrue(created.url.endsWith("pages/new_tab.html?sudaCommandBar=all"));
  });
});
