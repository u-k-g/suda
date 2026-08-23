// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import * as testHelper from "./test_helper.js";
import "../../tests/unit_tests/test_chrome_stubs.js";
import * as hudPage from "../../pages/hud_page.js";
import * as UIComponentMessenger from "../../pages/ui_component_messenger.js";

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

context("hud page", () => {
  let ui;
  setup(async () => {
    await testHelper.jsdomStub("pages/hud_page.html");
    // Make Utils.setTimeout synchronous so that the tests easier to deal with.
    stub(Utils, "setTimeout", (timeout, fn) => {
      fn();
    });
  });

  teardown(() => {
    UIComponentMessenger.unregister();
  });

  should("find mode hides when escape is pressed", async () => {
    let message;
    const stubPort = {
      postMessage: (event) => {
        message = event;
      },
    };
    await UIComponentMessenger.registerPortWithOwnerPage({
      data: (await chrome.storage.session.get("sudaSecret")).sudaSecret,
      ports: [stubPort],
    });
    hudPage.handlers.showFindMode();
    await hudPage.onKeyEvent(newKeyEvent({ key: "Escape" }));
    assert.equal("hideFindMode", message.name);
  });

  should("accept the current match and close the find prompt when enter is pressed", async () => {
    let message;
    const stubPort = {
      postMessage: (event) => {
        message = event;
      },
    };
    await UIComponentMessenger.registerPortWithOwnerPage({
      data: (await chrome.storage.session.get("sudaSecret")).sudaSecret,
      ports: [stubPort],
    });
    hudPage.handlers.showFindMode();
    await hudPage.onKeyEvent(newKeyEvent({ type: "keypress", key: "Enter" }));

    assert.equal("hideFindMode", message.name);
    assert.isTrue(message.exitEventIsEnter);
    assert.isFalse(message.exitEventIsEscape);
  });

  should("show the search direction in the prompt", () => {
    hudPage.handlers.showFindMode({ backwards: false });
    assert.equal("/", document.querySelector("#hud-find-input").dataset.prompt);

    hudPage.handlers.showFindMode({ backwards: true });
    assert.equal("?", document.querySelector("#hud-find-input").dataset.prompt);
  });

  should("render partial key sequences and their available continuations", () => {
    hudPage.handlers.showKeyHints({
      prefix: ["<space>"],
      continuations: [
        { key: "f", description: "Select links, then choose an action" },
        { key: ">", description: "Go forward" },
        { key: "1 - 9", description: "Go to tab slot" },
      ],
    });

    assert.equal(
      ["Space", "f", ">", "1 - 9"],
      Array.from(document.querySelectorAll("#hud kbd")).map((element) => element.textContent),
    );
    assert.isTrue(document.querySelector("#hud").textContent.includes("Select links"));
    assert.isTrue(document.querySelector("#hud").classList.contains("hud-key-hints"));
  });

  should("render action confirmations as bottom-bar toasts", () => {
    hudPage.handlers.showToast({ text: "Link copied", detail: "https://example.com/" });

    assert.equal("✓", document.querySelector(".hud-toast-icon").textContent);
    assert.equal("Link copied", document.querySelector(".hud-toast-text").textContent);
    assert.equal("https://example.com/", document.querySelector(".hud-toast-detail").textContent);
    assert.isTrue(document.querySelector("#hud").classList.contains("hud-toast"));
  });
});
