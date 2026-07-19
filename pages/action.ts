// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import "../lib/utils.js";
import "../lib/dom_utils.js";
import "../lib/settings.js";

import { generateDefaultPattern } from "../background_scripts/exclusions.js";
import { ExclusionRulesEditor } from "./exclusion_rules_editor.js";

const ActionPage = {
  async init() {
    // Is it possible for the current tab's URL to change while this action popup is open?
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    this.tabUrl = activeTab.url;

    const hideUI = () => {
      document.querySelector("#dialog-body").style.display = "none";
      document.querySelector("footer").style.display = "none";
    };

    if (!await this.isSudaInstalledInTab(activeTab.id)) {
      hideUI();
      document.querySelector("#not-enabled-error").style.display = "block";
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

document.addEventListener("DOMContentLoaded", async () => {
  await Settings.onLoaded();
  ActionPage.init();
});
