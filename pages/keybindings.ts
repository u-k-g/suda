// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import "./all_content_scripts.js";
import { allCommands } from "../background_scripts/all_commands.js";
import { getDefaultKeyMappings, KeyMappingsParser } from "../background_scripts/commands.js";

const groupMetadata = {
  navigation: { label: "Navigation", order: 0 },
  commandBar: { label: "Command Bar", order: 1 },
  find: { label: "Find", order: 2 },
  history: { label: "History", order: 3 },
  tabs: { label: "Tabs and windows", order: 4 },
  misc: { label: "Miscellaneous", order: 5 },
};

function formatKeyToken(token) {
  if (!token.startsWith("<")) return token;
  const parts = token.slice(1, -1).split("-");
  const modifierNames = {
    a: "Alt",
    c: "Ctrl",
    m: KeyboardUtils.isMacOS ? "Cmd" : "Meta",
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

function appendKeySequence(container, keySequence) {
  const binding = document.createElement("span");
  binding.className = "key-sequence";
  for (const token of keySequence.match(/<[^>]+>|./g) ?? []) {
    const key = document.createElement("kbd");
    key.textContent = formatKeyToken(token);
    binding.appendChild(key);
  }
  container.appendChild(binding);
}

function formatOptionString(options) {
  return Object.entries(options ?? {}).map(([name, value]) =>
    value === true ? name : `${name}=${value}`
  ).join(" ");
}

function parseActiveMappings(profile, customMappings) {
  const defaults = getDefaultKeyMappings(profile);
  const defaultConfig = Object.entries(defaults)
    .map(([key, command]) => `map ${key} ${command}`)
    .join("\n");
  return KeyMappingsParser.parse(`${defaultConfig}\n${customMappings}`);
}

function buildBindingRows(profile, customMappings) {
  const parsed = parseActiveMappings(profile, customMappings);
  const bindingsByCommand = {};

  for (const [key, registryEntry] of Object.entries(parsed.keyToRegistryEntry)) {
    const options = formatOptionString(registryEntry.options);
    bindingsByCommand[registryEntry.command] ||= {};
    bindingsByCommand[registryEntry.command][options] ||= [];
    bindingsByCommand[registryEntry.command][options].push(key);
  }

  const rows = allCommands
    .filter((command) => bindingsByCommand[command.name] != null)
    .map((command) => ({
      ...command,
      bindingSets: Object.entries(bindingsByCommand[command.name])
        .map(([options, keys]) => ({ options, keys: keys.sort((a, b) => a.localeCompare(b)) })),
    }));

  return { rows, validationErrors: parsed.validationErrors };
}

function currentProfile() {
  return document.querySelector('input[name="keyBindingMode"]:checked').value;
}

function currentCustomMappings() {
  return document.querySelector('textarea[name="keyMappings"]').value;
}

function renderBindings() {
  const { rows } = buildBindingRows(currentProfile(), currentCustomMappings());
  const groupsContainer = document.querySelector("#binding-groups");
  const groupTemplate = document.querySelector("#binding-group-template").content;
  const rowTemplate = document.querySelector("#binding-row-template").content;
  const bindingSetTemplate = document.querySelector("#binding-set-template").content;
  groupsContainer.textContent = "";

  const rowsByGroup = Object.groupBy(rows, (row) => row.group);
  const groups = Object.entries(rowsByGroup).sort(
    ([a], [b]) => groupMetadata[a].order - groupMetadata[b].order,
  );

  for (const [group, groupRows] of groups) {
    const groupNode = groupTemplate.cloneNode(true);
    const groupElement = groupNode.querySelector(".binding-group");
    groupElement.dataset.group = group;
    groupNode.querySelector(".group-name").textContent = groupMetadata[group].label;
    groupNode.querySelector(".group-count").textContent = `${groupRows.length} commands`;

    const rowsContainer = groupNode.querySelector(".group-rows");
    for (const row of groupRows) {
      const rowNode = rowTemplate.cloneNode(true);
      const rowElement = rowNode.querySelector(".binding-row");
      rowElement.dataset.command = row.name;
      rowElement.dataset.search = [
        row.name,
        row.desc,
        row.details,
        groupMetadata[group].label,
        ...row.bindingSets.flatMap(({ keys, options }) => [...keys, options]),
      ].filter(Boolean).join(" ").toLowerCase();
      rowNode.querySelector(".command-description").textContent = row.desc;
      rowNode.querySelector(".command-name").textContent = row.name;

      const bindingSets = rowNode.querySelector(".binding-sets");
      for (const { keys, options } of row.bindingSets) {
        const bindingSetNode = bindingSetTemplate.cloneNode(true);
        const keysContainer = bindingSetNode.querySelector(".binding-keys");
        for (const key of keys) appendKeySequence(keysContainer, key);
        const optionsElement = bindingSetNode.querySelector(".binding-options");
        if (options) {
          optionsElement.textContent = options;
        } else {
          optionsElement.remove();
        }
        bindingSets.appendChild(bindingSetNode);
      }
      rowsContainer.appendChild(rowNode);
    }
    groupsContainer.appendChild(groupNode);
  }

  filterBindings();
}

function filterBindings() {
  const query = document.querySelector("#binding-search input").value.trim().toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  let visibleRows = 0;
  let visibleBindings = 0;

  for (const group of document.querySelectorAll(".binding-group")) {
    let groupVisibleRows = 0;
    for (const row of group.querySelectorAll(".binding-row")) {
      const visible = terms.every((term) => row.dataset.search.includes(term));
      row.hidden = !visible;
      if (visible) {
        groupVisibleRows++;
        visibleRows++;
        visibleBindings += row.querySelectorAll(".key-sequence").length;
      }
    }
    group.hidden = groupVisibleRows === 0;
    group.querySelector(".group-count").textContent = `${groupVisibleRows} commands`;
  }

  const suffix = visibleRows === 1 ? "command" : "commands";
  document.querySelector("#binding-count").textContent =
    `${visibleBindings} bindings · ${visibleRows} ${suffix}`;
  document.querySelector("#empty-bindings").hidden = visibleRows !== 0;
}

function setEditorOpen(open) {
  const editor = document.querySelector("#custom-mappings-editor");
  editor.hidden = !open;
  document.querySelector("#toggle-editor").setAttribute("aria-expanded", String(open));
  if (open) document.querySelector('textarea[name="keyMappings"]').focus();
}

function markDirty() {
  const saveButton = document.querySelector("#save-mappings");
  saveButton.disabled = false;
  saveButton.textContent = "Save changes";
  document.querySelector("#mapping-validation").hidden = true;
  renderBindings();
}

function resetFormFromSettings() {
  const profile = Settings.get("keyBindingMode");
  document.querySelector(`input[name="keyBindingMode"][value="${profile}"]`).checked = true;
  document.querySelector('textarea[name="keyMappings"]').value = Settings.get("keyMappings");
  const saveButton = document.querySelector("#save-mappings");
  saveButton.disabled = true;
  saveButton.textContent = "No changes";
  document.querySelector("#mapping-validation").hidden = true;
  renderBindings();
}

async function saveMappings() {
  const customMappings = currentCustomMappings().trim();
  const parsed = KeyMappingsParser.parse(customMappings);
  const validation = document.querySelector("#mapping-validation");
  if (parsed.validationErrors.length > 0) {
    validation.textContent = parsed.validationErrors.join("\n");
    validation.hidden = false;
    return false;
  }

  const settings = Settings.getSettings();
  settings.keyBindingMode = currentProfile();
  settings.keyMappings = customMappings;
  await Settings.setSettings(settings);
  validation.hidden = true;
  const saveButton = document.querySelector("#save-mappings");
  saveButton.disabled = true;
  saveButton.textContent = "Saved";
  renderBindings();
  return true;
}

async function init() {
  await Settings.onLoaded();
  resetFormFromSettings();

  document.querySelector("#binding-search input").addEventListener("input", filterBindings);
  for (const input of document.querySelectorAll('input[name="keyBindingMode"]')) {
    input.addEventListener("input", () => {
      setEditorOpen(true);
      markDirty();
    });
  }
  document.querySelector('textarea[name="keyMappings"]').addEventListener("input", markDirty);
  document.querySelector("#toggle-editor").addEventListener(
    "click",
    () => setEditorOpen(document.querySelector("#custom-mappings-editor").hidden),
  );
  document.querySelector("#close-editor").addEventListener("click", () => setEditorOpen(false));
  document.querySelector("#discard-mappings").addEventListener("click", () => {
    resetFormFromSettings();
    setEditorOpen(false);
  });
  document.querySelector("#save-mappings").addEventListener("click", saveMappings);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) saveMappings();
  });
}

const testEnv = globalThis.window == null ||
  globalThis.window.location.search.includes("dom_tests=true");
if (!testEnv) {
  document.addEventListener("DOMContentLoaded", async () => {
    await Settings.onLoaded();
    DomUtils.injectUserCss();
    await init();
  });
}

export { buildBindingRows, filterBindings, init, renderBindings, saveMappings };
