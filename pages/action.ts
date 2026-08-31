// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import "../lib/utils.js";
import "../lib/dom_utils.js";
import "../lib/settings.js";

import * as bgUtils from "../background_scripts/bg_utils.js";
import { generateDefaultPattern } from "../background_scripts/exclusions.js";
import { ExclusionRulesEditor } from "./exclusion_rules_editor.js";

const ActionPage = {
  contentScriptRetryDelays: [0, 25, 50, 100],

  async init() {
    // Is it possible for the current tab's URL to change while this action popup is open?
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (!activeTab?.id) return;
    this.tabUrl = activeTab.url;

    const hideUI = () => {
      document.querySelector("#dialog-body").style.display = "none";
      document.querySelector("footer").style.display = "none";
    };

    const availability = await this.ensureSudaInstalledInTab(activeTab);
    if (!availability.installed) {
      hideUI();
      await this.showUnavailablePage(activeTab, availability.error);
      return;
    }

    document.querySelector("#optionsLink").href = chrome.runtime.getURL("pages/options.html");

    const saveButton = document.querySelector("#save");
    saveButton.addEventListener("click", (e) => this.onSave());

    document.querySelector("#cancel").addEventListener("click", () => globalThis.close());

    const onUpdated = () => {
      saveButton.disabled = false;
      saveButton.textContent = "Save changes";
      this.syncEnabledKeysCaption();
      this.showValidationErrors();
    };

    const defaultPatternForNewRules = this.generateDefaultPattern(this.tabUrl);

    document.querySelector("#add-first-rule").addEventListener(
      "click",
      () => {
        ExclusionRulesEditor.addRow(defaultPatternForNewRules);
        this.showExclusionRulesEditor();
        onUpdated();
      },
    );

    ExclusionRulesEditor.defaultPatternForNewRules = defaultPatternForNewRules;
    ExclusionRulesEditor.init();
    ExclusionRulesEditor.addEventListener("input", onUpdated);
    const rules = Settings.get("exclusionRules").filter((r) =>
      this.tabUrl.match(this.getPatternRegExp(r.pattern))
    );
    ExclusionRulesEditor.setForm(rules);
    this.syncEnabledKeysCaption();

    if (rules.length > 0) this.showExclusionRulesEditor();
  },

  async isSudaInstalledInTab(tabId) {
    try {
      // There is no handler in our content script for this message, but that's OK. We just want to
      // see if sending any message triggers an error.
      await chrome.tabs.sendMessage(tabId, { handler: "isSudaInstalledInTab" });
      return true;
    } catch {
      // If there's no content script running in the activeTab, we'll get a connection error.
      return false;
    }
  },

  async ensureSudaInstalledInTab(tab) {
    if (await this.isSudaInstalledInTab(tab.id)) return { installed: true };

    // A normal web page can be missing Suda after an extension reload, because site access was
    // limited, or because the content script was still starting when the popup opened. Invoking
    // the toolbar action grants activeTab access, so use it to repair the current top frame.
    if (await bgUtils.topFrameHasSudaIsolatedWorld(tab.id)) {
      return { installed: false };
    }

    let error;
    try {
      const contentScriptConfig = chrome.runtime.getManifest().content_scripts[0];
      const target = { tabId: tab.id, frameIds: [0] };

      await Promise.allSettled([
        chrome.scripting.insertCSS({
          files: contentScriptConfig.css,
          target,
        }),
        chrome.scripting.insertCSS({
          css: Settings.get("userDefinedLinkHintCss"),
          target,
        }),
      ]);
      await chrome.scripting.executeScript({
        files: contentScriptConfig.js,
        target,
      });

      for (const delay of this.contentScriptRetryDelays) {
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
        if (await this.isSudaInstalledInTab(tab.id)) return { installed: true };
      }
    } catch (caughtError) {
      error = caughtError;
    }
    return { installed: false, error };
  },

  async showUnavailablePage(tab, injectionError) {
    const error = document.querySelector("#not-enabled-error");
    const title = error.querySelector("#not-enabled-title");
    const message = error.querySelector("#not-enabled-message");
    const manageAccess = error.querySelector("#manage-extension-access");
    const fallback = error.querySelector("#open-command-bar-fallback");
    const url = tab.url || "";
    const isFileUrl = url.startsWith("file:");
    const isWebUrl = /^(?:https?|file):/.test(url);
    const isExtensionStore =
      /^https:\/\/(?:chromewebstore\.google\.com\/|chrome\.google\.com\/webstore)/i
        .test(url);
    const fileAccessAllowed = !isFileUrl ||
      await chrome.extension.isAllowedFileSchemeAccess();

    if (isFileUrl && !fileAccessAllowed) {
      title.textContent = "Suda needs access to local files.";
      message.textContent =
        'Enable "Allow access to file URLs" in Suda’s extension settings, then reload this tab.';
      manageAccess.hidden = false;
    } else if (isWebUrl && !isExtensionStore) {
      title.textContent = "Suda could not start on this site.";
      message.textContent =
        "Chrome may be limiting Suda’s site access. Allow Suda on this site, then reload the page.";
      manageAccess.hidden = false;
    } else {
      title.textContent = "This page is protected by the browser.";
      message.textContent =
        "Chrome does not allow extensions to control browser pages, extension stores, PDF viewer " +
        "pages, or pages belonging to another extension.";
    }

    manageAccess.addEventListener("click", () => this.openExtensionSettings());
    fallback.addEventListener("click", () => this.openCommandBarFallback(tab));
    if (injectionError) {
      error.title = injectionError.message || String(injectionError);
    }
    error.style.display = "block";
  },

  openExtensionSettings() {
    return chrome.tabs.create({
      url: `chrome://extensions/?id=${chrome.runtime.id}`,
    });
  },

  openCommandBarFallback(tab) {
    const createProperties = {
      active: true,
      openerTabId: tab.id,
      url: chrome.runtime.getURL("pages/new_tab.html?sudaCommandBar=all"),
    };
    if (Number.isInteger(tab.index)) createProperties.index = tab.index + 1;
    if (Number.isInteger(tab.windowId)) createProperties.windowId = tab.windowId;
    return chrome.tabs.create(createProperties);
  },

  showValidationErrors() {
    const rows = document.querySelectorAll(".rule");
    for (const row of rows) {
      const pattern = row.querySelector("input[name=pattern]").value;
      const regExp = this.getPatternRegExp(pattern);
      const validationEl = row.querySelector(".validationMessage");
      const patternMatchesUrl = this.tabUrl.match(regExp);
      if (patternMatchesUrl) {
        row.classList.remove("validationError");
        validationEl.textContent = "";
      } else {
        row.classList.add("validationError");
        validationEl.textContent = "Pattern does not match the current URL";
      }
    }
  },

  showExclusionRulesEditor() {
    document.querySelector("#exclusions-container").style.display = "block";
    document.querySelector("#add-first-rule-container").style.display = "none";
  },

  syncEnabledKeysCaption() {
    let caption = "All";
    const rules = ExclusionRulesEditor.getRules();
    if (rules.length > 0) {
      const hasBlankPassKeysRule = rules.find((r) => r.passKeys.length == 0);
      caption = hasBlankPassKeysRule ? "No" : "Some";
    }
    document.querySelector("#how-many-enabled").textContent = caption;
  },

  async onSave() {
    let rules = await Settings.get("exclusionRules");
    // Remove any rules which match the current URL, and replace them with the contents of this dialog.
    rules = rules.filter((r) => !this.tabUrl.match(this.getPatternRegExp(r.pattern)));
    rules = rules.concat(ExclusionRulesEditor.getRules());
    Settings.set("exclusionRules", rules);
    const el = document.querySelector("#save");
    el.disabled = true;
    el.textContent = "Saved";
  },

  getPatternRegExp(patternStr) {
    return new RegExp("^" + patternStr.replace(/\*/g, ".*") + "$");
  },

  // Returns an exclusion pattern which matches the domain of the given URL.
  // This is used as the default starter pattern when the "Add rule" button is clicked.
  generateDefaultPattern(url) {
    return generateDefaultPattern(url);
  },
};

const testEnv = globalThis.window == null;
if (!testEnv) {
  document.addEventListener("DOMContentLoaded", async () => {
    await Settings.onLoaded();
    ActionPage.init();
  });
}

export { ActionPage };
