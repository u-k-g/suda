// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import * as testHelper from "./test_helper.js";
import "../../lib/utils.js";
import "../../lib/dom_utils.js";
import "../../lib/settings.js";
import "../../content_scripts/ui_component.js";

function stubPostMessage(iframeEl, fn) {
  if (!iframeEl || !fn) throw new Error("iframeEl and fn are required.");
  Object.defineProperty(iframeEl, "contentWindow", {
    value: { postMessage: fn },
    writable: false,
    configurable: true,
  });
}

context("UIComponent", () => {
  let c;

  setup(async () => {
    // Which page we load doesn't matter; we just need any DOM.
    await testHelper.jsdomStub("pages/help_dialog_page.html");
    await Settings.onLoaded();
  });

  teardown(() => {
    // MessageChannel ports must be closed, or our test process will never terminate. See
    // https://github.com/facebook/react/issues/26608
    for (const port of c?.messageChannelPorts ?? []) {
      port.close();
    }
  });

  should("focus the frame when showing", async () => {
    c = new UIComponent("testing.html", "example-class");
    await c.load("example.html", "example-class");
    stubPostMessage(c.iframeElement, function () {});
    c.iframeElement.dispatchEvent(new window.Event("load"));
    assert.equal(document.body, document.activeElement);

    // The shadow root element containing the iframe should be focused.
    c.show();
    assert.equal(c.iframeElement.getRootNode().host, document.activeElement);
  });

  should("hide synchronously while showing is still waiting for iframe readiness", async () => {
    c = new UIComponent("testing.html", "example-class");
    await c.load("example.html", "example-class");

    c.show({}, { focus: true, sourceFrameId: 0 });
    assert.isTrue(c.showing);

    c.hide(false);
    assert.isFalse(c.showing);
    assert.isTrue(c.hiding);
    assert.equal("none", c.iframeElement.style.display);
    assert.isTrue(c.iframeElement.classList.contains("suda-ui-component-hidden"));
  });

  should("queue messages immediately while load is still fetching its stylesheet", async () => {
    let resolveCss;
    const originalGet = chrome.storage.session.get.bind(chrome.storage.session);
    stub(chrome.storage.session, "get", (key) => {
      if (key === "sudaCSSInChromeStorage") {
        return new Promise((resolve) => resolveCss = resolve);
      }
      return originalGet(key);
    });

    c = new UIComponent();
    const loading = c.load("example.html?dom_tests=true", "example-class");
    const messaging = c.postMessage({ name: "queued" });

    // load() has reached its first await, but postMessage() must already have a readiness promise
    // to wait on.
    assert.isTrue(c.iframePort instanceof Promise);
    resolveCss({});
    await loading;

    stubPostMessage(c.iframeElement, function () {});
    c.iframeElement.dispatchEvent(new window.Event("load"));
    c.messageChannelPorts[0].onmessage({ data: { name: "uiComponentIsReady" } });
    assert.isTrue(await messaging);
  });

  should(
    "silently abandons messages from a content script with an invalidated context",
    async () => {
      stub(chrome.storage.session, "get", () => {
        throw new Error("Extension context invalidated.");
      });

      c = new UIComponent();
      await c.load("example.html", "example-class");

      assert.isFalse(await c.postMessage({ name: "ignored" }));
      await c.show({ name: "ignored" });
      assert.isFalse(c.showing);
    },
  );
});
