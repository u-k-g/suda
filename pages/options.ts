// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import "./settings_page_dependencies.js";
import { ExclusionRulesEditor } from "./exclusion_rules_editor.js";
import { Commands } from "../background_scripts/commands.js";
import * as userSearchEngines from "../background_scripts/user_search_engines.js";
import * as keybindingsPage from "./keybindings.js";

const options = {
  accentColor: "string",
  commandBarCenter: "option",
  disabledCommandBarModes: "inverted-set",
  disabledModelessCommandBarSources: "inverted-set",
  fastScrollStepSize: "number",
  filterLinkHints: "boolean",
  grabBackFocus: "boolean",
  hideHud: "boolean",
  ignoreKeyboardLayout: "boolean",
  linkHintCharacters: "string",
  linkHintNumbers: "string",
  newTabCustomUrl: "string",
  newTabDestination: "option",
  nextPatterns: "string",
  openCommandBarOnNewTabPage: "boolean",
  previousPatterns: "string",
  regexFindMode: "boolean",
  scrollStepSize: "number",
  searchEngines: "string",
  settingsVersion: "string", // This is a hidden field.
  showCommandBarModeDescriptions: "boolean",
  smoothScroll: "boolean",
  theme: "string",
  userDefinedLinkHintCss: "string",
  waitForEnterForFilteredHints: "boolean",
};

const settingsSections = ["general", "keybindings"];
const settingsSectionLabels = {
  general: "General",
  keybindings: "Keybindings",
};

function sectionFromLocation() {
  try {
    const hash = String(globalThis.location?.hash || "").replace(/^#/, "").toLowerCase();
    if (settingsSections.includes(hash)) return hash;
    const params = new URLSearchParams(String(globalThis.location?.search || ""));
    const querySection = (params.get("section") || "").toLowerCase();
    if (settingsSections.includes(querySection)) return querySection;
  } catch {
    // jsdom / non-browser hosts may not expose a full Location.
  }
  return "general";
}

function setSectionMenuOpen(open) {
  const button = document.querySelector("#settings-section-button");
  const menu = document.querySelector("#settings-section-menu");
  if (!button || !menu) return;
  menu.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
}

export function showSettingsSection(section) {
  const next = settingsSections.includes(section) ? section : "general";
  document.body.dataset.activeSection = next;

  for (const panel of document.querySelectorAll("[data-section-panel]")) {
    panel.hidden = panel.dataset.sectionPanel !== next;
  }

  const label = document.querySelector("#settings-section-label");
  if (label) label.textContent = settingsSectionLabels[next] ?? "General";

  for (const option of document.querySelectorAll(".settings-section-option")) {
    option.setAttribute("aria-selected", String(option.dataset.section === next));
  }

  setSectionMenuOpen(false);

  try {
    const desiredHash = `#${next}`;
    if (globalThis.location && globalThis.location.hash !== desiredHash) {
      const path = globalThis.location.pathname || "";
      const search = globalThis.location.search || "";
      globalThis.history?.replaceState?.(null, "", `${path}${search}${desiredHash}`);
    }
  } catch {
    // Ignore history updates when Location is incomplete (unit tests).
  }

  document.title = next === "keybindings" ? "Suda Keybindings" : "Suda Settings";
}

function initSettingsNavigation() {
  const button = document.querySelector("#settings-section-button");
  const menu = document.querySelector("#settings-section-menu");
  if (!button || !menu) {
    showSettingsSection(sectionFromLocation());
    return;
  }

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    setSectionMenuOpen(menu.hidden);
  });

  for (const option of document.querySelectorAll(".settings-section-option")) {
    option.addEventListener("click", () => showSettingsSection(option.dataset.section));
  }

  document.addEventListener("click", (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !button.contains(event.target)) {
      setSectionMenuOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setSectionMenuOpen(false);
  });

  globalThis.addEventListener?.("hashchange", () => showSettingsSection(sectionFromLocation()));
  showSettingsSection(sectionFromLocation());
}

export async function init() {
  await Settings.onLoaded();
  structureSettingsLayout();
  enhanceSettingsControls();
  initSettingsNavigation();
  await keybindingsPage.init();

  const themeSelect = getOptionEl("theme");
  if (globalThis.ThemeManager) {
    themeSelect.textContent = "";
    for (const theme of ThemeManager.themes) {
      const option = document.createElement("option");
      option.value = theme.id;
      option.textContent = theme.name;
      themeSelect.appendChild(option);
    }
  }
  themeSelect.addEventListener("input", () => {
    maintainAccentView();
    applyThemePreview();
  });
  getOptionEl("accentColor").addEventListener("input", () => applyThemePreview());
  // Theme options are filled above; wrap every select after its options exist.
  enhanceSelectDropdowns();

  const shortcutLabel = document.querySelector("#shortcut-to-save-all");
  shortcutLabel.textContent = `${KeyboardUtils.primaryModifierLabel}-Enter`;

  const saveButton = document.querySelector("#save");

  const onUpdated = () => {
    maintainNewTabUrlView();
    saveButton.disabled = false;
    saveButton.textContent = "Save changes";
  };

  for (const el of document.querySelectorAll("input, textarea, select")) {
    // We want to immediately enable the save button when a setting is changed, so we want to use
    // the HTML element's "input" event here rather than the "change" event.
    el.addEventListener("input", () => onUpdated());
    el.addEventListener("blur", () => {
      showValidationErrors();
    });
  }

  saveButton.addEventListener("click", () => saveOptions());

  getOptionEl("filterLinkHints").addEventListener(
    "click",
    () => maintainLinkHintsView(),
  );

  document.querySelector("#download-backup").addEventListener(
    "mousedown",
    () => onDownloadBackupClicked(),
    true,
  );
  document.querySelector("#upload-backup").addEventListener(
    "change",
    () => onUploadBackupClicked(),
  );

  for (const el of document.querySelectorAll(".reset-link a")) {
    el.addEventListener("click", (event) => {
      resetInputValue(event);
      showValidationErrors();
      onUpdated();
    });
  }

  globalThis.onbeforeunload = () => {
    if (!saveButton.disabled) {
      return "You have unsaved changes to options.";
    }
  };

  document.addEventListener("keydown", (event) => {
    // Support both Ctrl-Enter and Cmd-Enter for saving options.
    const isCtrlEnter = event.ctrlKey && event.keyCode === 13;
    const isCmdEnter = event.metaKey && event.keyCode === 13;
    if ((isCtrlEnter || isCmdEnter) && document.body.dataset.activeSection !== "keybindings") {
      saveOptions();
    }
  });

  ExclusionRulesEditor.init();
  ExclusionRulesEditor.addEventListener("input", onUpdated);

  const settings = Settings.getSettings();
  setFormFromSettings(settings);
}

function enhanceSettingsControls() {
  const enhanceRadioGroup = (container, label) => {
    if (!container || container.classList.contains("enhanced-radio-group")) return;
    const radios = Array.from(container.querySelectorAll(':scope > input[type="radio"]'));
    const select = document.createElement("select");
    select.className = "setting-enum-select";
    select.setAttribute("aria-label", label);
    for (const radio of radios) {
      const radioLabel = container.querySelector(`label[for="${radio.id}"]`);
      radio.classList.add("enhanced-radio-input");
      radioLabel?.classList.add("enhanced-radio-label");
      const option = document.createElement("option");
      option.value = radio.value;
      option.textContent = radioLabel?.textContent.trim() ?? radio.value;
      select.append(option);
    }
    select.addEventListener("input", () => {
      const selected = radios.find((radio) => radio.value === select.value);
      if (selected) selected.checked = true;
    });
    container.classList.add("enhanced-radio-group");
    container.prepend(select);
  };

  enhanceRadioGroup(document.querySelector("#new-tab-url-container"), "New tab destination");
  enhanceRadioGroup(
    document.querySelector("#command-bar-center-container"),
    "Command bar centering",
  );

  const createEditorDisclosure = (target, label) => {
    if (!target) return;
    const row = target.closest(".setting-row");
    const control = row?.querySelector(".setting-control");
    if (!row || !control || row.querySelector(".setting-editor-toggle")) return;

    const panel = document.createElement("div");
    const toggle = document.createElement("button");
    const panelId = `setting-editor-${target.id || target.name}`;
    panel.className = "setting-editor-panel";
    panel.id = panelId;
    panel.hidden = true;
    toggle.className = "setting-editor-toggle";
    toggle.type = "button";
    toggle.textContent = label;
    toggle.setAttribute("aria-controls", panelId);
    toggle.setAttribute("aria-expanded", "false");

    const editor = target.parentElement === control ? target : target.parentElement;
    panel.append(editor);
    control.append(toggle);
    row.append(panel);

    toggle.addEventListener("click", () => {
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      if (open) panel.querySelector("input, textarea")?.focus();
    });
  };

  createEditorDisclosure(document.querySelector("#exclusion-scroll-box"), "Edit exclusions");
  createEditorDisclosure(getOptionEl("searchEngines"), "Edit search engines");
  createEditorDisclosure(getOptionEl("userDefinedLinkHintCss"), "Edit interface CSS");
}

function closeAllSettingDropdowns(except = null) {
  for (const dropdown of document.querySelectorAll(".setting-dropdown")) {
    if (dropdown === except) continue;
    const trigger = dropdown.querySelector(".setting-dropdown-trigger");
    const menu = dropdown.querySelector(".setting-dropdown-menu");
    if (!trigger || !menu) continue;
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }
}

function enhanceSelectDropdown(select) {
  if (!select || select.dataset.dropdownReady === "true") return;
  select.dataset.dropdownReady = "true";
  select.classList.add("setting-dropdown-native");

  const dropdown = document.createElement("div");
  dropdown.className = "setting-dropdown";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "setting-dropdown-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  if (select.getAttribute("aria-label")) {
    trigger.setAttribute("aria-label", select.getAttribute("aria-label"));
  } else if (select.name) {
    trigger.setAttribute("aria-label", select.name);
  }

  const label = document.createElement("span");
  label.className = "setting-dropdown-label";
  const chevron = document.createElement("span");
  chevron.className = "setting-dropdown-chevron";
  chevron.setAttribute("aria-hidden", "true");
  trigger.append(label, chevron);

  const menu = document.createElement("div");
  menu.className = "setting-dropdown-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;

  const setOpen = (open) => {
    if (open) closeAllSettingDropdowns(dropdown);
    menu.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
  };

  const syncFromSelect = () => {
    const selected = select.selectedOptions[0];
    label.textContent = selected?.textContent?.trim() || "";
    for (const item of menu.querySelectorAll(".setting-dropdown-option")) {
      item.setAttribute("aria-selected", String(item.dataset.value === select.value));
    }
  };

  const rebuildOptions = () => {
    menu.textContent = "";
    for (const option of select.options) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "setting-dropdown-option";
      item.setAttribute("role", "option");
      item.dataset.value = option.value;
      item.textContent = option.textContent;
      item.disabled = option.disabled;
      item.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (select.value !== option.value) {
          select.value = option.value;
          select.dispatchEvent(new Event("input", { bubbles: true }));
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        syncFromSelect();
        setOpen(false);
      });
      menu.append(item);
    }
    syncFromSelect();
  };

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(menu.hidden);
  });

  select.addEventListener("input", syncFromSelect);
  select.addEventListener("change", syncFromSelect);

  select.parentNode.insertBefore(dropdown, select);
  dropdown.append(select, trigger, menu);
  rebuildOptions();

  select._rebuildDropdown = rebuildOptions;
  select._syncDropdown = syncFromSelect;
}

function enhanceSelectDropdowns() {
  for (const select of document.querySelectorAll("#settings-grid-container select")) {
    enhanceSelectDropdown(select);
  }

  if (document.documentElement.dataset.settingDropdownOutsideClose === "true") return;
  document.documentElement.dataset.settingDropdownOutsideClose = "true";
  document.addEventListener("click", (event) => {
    if (event.target.closest(".setting-dropdown")) return;
    closeAllSettingDropdowns();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllSettingDropdowns();
  });
}

function syncEnhancedControls() {
  for (const select of document.querySelectorAll(".setting-enum-select")) {
    const group = select.closest(".enhanced-radio-group");
    const checked = group.querySelector(':scope > input[type="radio"]:checked');
    if (checked) select.value = checked.value;
  }
  for (const select of document.querySelectorAll("select[data-dropdown-ready='true']")) {
    select._syncDropdown?.();
  }
}

// Settings markup is authored as left-copy / right-control rows. Keep this hook so tests and
// callers can still re-run init without double-enhancing controls.
function structureSettingsLayout() {
  const container = document.querySelector("#settings-grid-container");
  container.dataset.layoutReady = "true";
}

export function getOptionEl(optionName) {
  return document.querySelector(`*[name="${optionName}"]`);
}

// Invoked when the user clicks the "reset" button next to an option's text field.
function resetInputValue(event) {
  const parentDiv = event.target.parentNode.parentNode;
  console.assert(parentDiv?.tagName == "DIV", "Expected parent to be a div", event.target);
  const input = parentDiv.querySelector("input") || parentDiv.querySelector("textarea");
  const optionName = input.name;
  const defaultValue = Settings.defaultOptions[optionName];
  input.value = defaultValue;
  event.preventDefault();
}

function setFormFromSettings(settings) {
  for (const [optionName, optionType] of Object.entries(options)) {
    const el = getOptionEl(optionName);
    const value = settings[optionName];
    switch (optionType) {
      case "boolean":
        el.checked = value;
        break;
      case "number":
        el.value = value;
        break;
      case "string":
        el.value = value;
        break;
      case "option":
        const optionEl = document.querySelector(`input[name="${optionName}"][value="${value}"]`);
        optionEl.checked = true;
        break;
      case "inverted-set":
        for (const optionEl of document.querySelectorAll(`input[name="${optionName}"]`)) {
          optionEl.checked = !value.includes(optionEl.value);
        }
        break;
      default:
        throw new Error(`Unrecognized option type ${optionType}`);
    }
  }

  ExclusionRulesEditor.setForm(settings["exclusionRules"]);

  document.querySelector("#upload-backup").value = "";
  maintainAccentView();
  applyThemePreview();
  maintainLinkHintsView();
  maintainNewTabUrlView();
  syncEnhancedControls();
}

function getSettingsFromForm() {
  // Preserve settings which live on dedicated pages, such as keyBindingMode and keyMappings.
  const settings = Settings.getSettings();
  for (const [optionName, optionType] of Object.entries(options)) {
    const el = getOptionEl(optionName);
    let value;
    switch (optionType) {
      case "boolean":
        value = el.checked;
        break;
      case "number":
        value = parseFloat(el.value);
        break;
      case "string":
        value = el.value.trim();
        break;
      case "option":
        const optionEl = document.querySelector(`input[name="${optionName}"]:checked`);
        value = optionEl.value;
        break;
      case "inverted-set":
        value = Array.from(document.querySelectorAll(`input[name="${optionName}"]`))
          .filter((optionEl) => !optionEl.checked)
          .map((optionEl) => optionEl.value);
        break;
      default:
        throw new Error(`Unrecognized option type ${optionType}`);
    }
    if (value !== null) {
      settings[optionName] = value;
    }
  }
  if (settings["linkHintCharacters"] != null) {
    settings["linkHintCharacters"] = settings["linkHintCharacters"].toLowerCase();
  }
  const normalizedAccent = globalThis.ThemeManager?.normalizeHexColor(
    settings["accentColor"],
  );
  if (normalizedAccent) settings["accentColor"] = normalizedAccent.toUpperCase();
  settings["exclusionRules"] = ExclusionRulesEditor.getRules();
  return settings;
}

function isCustomAccentThemeSelected() {
  return globalThis.ThemeManager?.isAccentCustomizable(getOptionEl("theme").value) ?? false;
}

// Keep the control out of the way for themes whose accent is fixed by their palette.
function maintainAccentView() {
  const visible = isCustomAccentThemeSelected();
  showElement(document.querySelector("#accent-row"), visible);
}

// Live-preview both the chosen theme and a valid custom accent.
function applyThemePreview() {
  const accentInput = getOptionEl("accentColor");
  const normalizedAccent = globalThis.ThemeManager?.normalizeHexColor(accentInput.value);
  globalThis.ThemeManager?.apply(
    getOptionEl("theme").value,
    document.documentElement,
    normalizedAccent,
  );
  document.querySelector("#accent-swatch").style.backgroundColor = normalizedAccent ??
    "transparent";
}

function getValidationErrors() {
  const results = {};
  let text, parsed;

  // searchEngines field.
  text = getOptionEl("searchEngines").value.trim();
  parsed = userSearchEngines.parseConfig(text);
  if (parsed.validationErrors.length > 0) {
    results["searchEngines"] = parsed.validationErrors.join("\n");
  }

  // linkHintCharacters field.
  text = getOptionEl("linkHintCharacters").value.trim();
  if (text != removeDuplicateChars(text)) {
    results["linkHintCharacters"] = "This cannot contain duplicate characters.";
  } else if (text.length <= 1) {
    results["linkHintCharacters"] = "This must be at least two characters long.";
  }

  // linkHintNumbers field.
  text = getOptionEl("linkHintNumbers").value.trim();
  if (text != removeDuplicateChars(text)) {
    results["linkHintNumbers"] = "This cannot contain duplicate characters.";
  } else if (text.length <= 1) {
    results["linkHintNumbers"] = "This must be at least two characters long.";
  }

  // Hidden theme-specific controls must not block saving another theme.
  text = getOptionEl("accentColor").value.trim();
  if (isCustomAccentThemeSelected() && !globalThis.ThemeManager?.normalizeHexColor(text)) {
    results["accentColor"] = "Enter a six-digit hex color, for example #6CED96.";
  }

  return results;
}

function addValidationMessage(el, message) {
  el.classList.add("validation-error");
  const exampleEl = el.closest("#accent-container") ?? el.nextElementSibling ?? el;
  const messageEl = document.createElement("div");
  messageEl.classList.add("validation-message");
  messageEl.textContent = message;
  exampleEl.after(messageEl);
}

// Returns true if there are errors, false otherwise.
function showValidationErrors() {
  // Remove all previous validation errors.
  let els = document.querySelectorAll(".validation-error");
  for (const el of els) {
    el.classList.remove("validation-error");
  }
  els = document.querySelectorAll(".validation-message");
  for (const el of els) {
    el.remove();
  }

  const errors = getValidationErrors();
  for (const [optionName, message] of Object.entries(errors)) {
    const el = getOptionEl(optionName);
    addValidationMessage(el, message);
    const panel = el.closest(".setting-editor-panel");
    if (panel) {
      panel.hidden = false;
      document.querySelector(`[aria-controls="${panel.id}"]`)?.setAttribute(
        "aria-expanded",
        "true",
      );
    }
  }
  // Some options can be hidden in the UI. If they have validation errors, force them to be shown.
  if (errors["linkHintCharacters"]) {
    showElement(document.querySelector("#link-hint-characters-container"), true);
  }
  if (errors["linkHintNumbers"]) {
    showElement(document.querySelector("#link-hint-numbers-container"), true);
  }
  const hasErrors = Object.keys(errors).length > 0;
  return hasErrors;
}

function removeDuplicateChars(str) {
  const seen = new Set();
  let result = "";
  for (let char of str) {
    if (!seen.has(char)) {
      result += char;
      seen.add(char);
    }
  }
  return result;
}

export async function saveOptions() {
  const hasErrors = showValidationErrors();
  if (hasErrors) {
    // TODO(philc): If no fields with validation errors are in view, scroll one of them into view
    // so it's clear what the issue is.
    return;
  }

  await Settings.setSettings(getSettingsFromForm());
  const el = document.querySelector("#save");
  el.disabled = true;
  el.textContent = "Saved";
}

function showElement(el, visible) {
  el.style.display = visible ? null : "none";
}

// Hide or show extra form elements depending on which radio button is selected for
// newTabDestination.
function maintainNewTabUrlView() {
  const destination = document.querySelector("[name=newTabDestination]:checked").value;
  showElement(
    document.querySelector("#openCommandBarContainer"),
    destination == Settings.newTabDestinations.sudaNewTabPage,
  );
  showElement(
    document.querySelector("[name=newTabCustomUrl]"),
    destination == Settings.newTabDestinations.customUrl,
  );
}

// Display the UI for link hint numbers vs. characters, depending upon the value of
// "filterLinkHints".
function maintainLinkHintsView() {
  const errors = getValidationErrors();
  const isFilteredLinkhints = getOptionEl("filterLinkHints").checked;
  showElement(
    document.querySelector("#link-hint-characters-container"),
    !isFilteredLinkhints || errors["linkHintCharacters"],
  );
  showElement(
    document.querySelector("#link-hint-numbers-container"),
    isFilteredLinkhints || errors["linkHintNumbers"],
  );
  showElement(
    document.querySelector("#wait-for-enter"),
    isFilteredLinkhints,
  );
}

export function prepareBackupSettings() {
  const settings = Settings.pruneOutDefaultValues(getSettingsFromForm());
  // Serialize the JSON keys in order, so that they're stable across backups. See #4764.
  const keys = Object.keys(settings).sort();
  const sortedSettings = Object.fromEntries(keys.map((k) => [k, settings[k]]));
  // Don't use an array replacer in JSON.stringify; it filters nested object keys too, which would
  // drop nested fields inside exclusionRules (e.g. `pattern`, `passKeys`). See #4853.
  return JSON.stringify(sortedSettings, null, 2) + "\n";
}

function onDownloadBackupClicked() {
  const settings = prepareBackupSettings();
  const blob = new Blob([settings]);
  document.querySelector("#download-backup").href = URL.createObjectURL(blob);
}

function onUploadBackupClicked() {
  if (document.activeElement) {
    document.activeElement.blur();
  }

  const files = event.target.files;
  if (files.length === 1) {
    const file = files[0];
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = async () => {
      let backup;
      try {
        backup = JSON.parse(reader.result);
      } catch (error) {
        console.log("parsing error:", error);
        alert("Failed to parse Suda backup: " + error);
        return;
      }

      await Settings.setSettings(backup);
      setFormFromSettings(Settings.getSettings());
      const saveButton = document.querySelector("#save");
      saveButton.disabled = true;
      saveButton.textContent = "Saved";
      alert("Settings have been restored from the backup.");
    };
  }
}

const testEnv = globalThis.window == null ||
  globalThis.window.location.search.includes("dom_tests=true");
if (!testEnv) {
  document.addEventListener("DOMContentLoaded", async () => {
    await Settings.onLoaded();
    DomUtils.injectUserCss();
    await Commands.init();
    await init();
  });
}
