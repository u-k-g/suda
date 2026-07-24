// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import "./settings_page_dependencies.js";
import { allCommands } from "../background_scripts/all_commands.js";
import { helixKeyMappings, KeyMappingsParser } from "../background_scripts/commands.js";

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

function parseActiveMappings(customMappings) {
  const defaultConfig = Object.entries(helixKeyMappings)
    .map(([key, command]) => `map ${key} ${command}`)
    .join("\n");
  return KeyMappingsParser.parse(`${defaultConfig}\n${customMappings}`);
}

function buildBindingRows(customMappings) {
  const parsed = parseActiveMappings(customMappings);
  const defaultKeyToCommand = { ...helixKeyMappings };
  const bindingsByCommand = {};

  for (const [key, registryEntry] of Object.entries(parsed.keyToRegistryEntry)) {
    const options = formatOptionString(registryEntry.options);
    bindingsByCommand[registryEntry.command] ||= {};
    bindingsByCommand[registryEntry.command][options] ||= [];
    bindingsByCommand[registryEntry.command][options].push(key);
  }

  // Include every registered command, even when the Helix defaults leave it unbound.
  const rows = [];
  for (const command of allCommands) {
    const optionSets = bindingsByCommand[command.name];
    if (optionSets == null) {
      rows.push({
        ...command,
        key: "",
        options: "",
        isCustom: false,
        isUnbound: true,
      });
      continue;
    }
    for (const [options, keys] of Object.entries(optionSets)) {
      for (const key of keys.sort((a, b) => a.localeCompare(b))) {
        const isDefault = defaultKeyToCommand[key] === command.name && options === "";
        rows.push({
          ...command,
          key,
          options,
          isCustom: !isDefault,
          isUnbound: false,
        });
      }
    }
  }

  return { rows, validationErrors: parsed.validationErrors };
}

function currentCustomMappings() {
  return document.querySelector('textarea[name="keyMappings"]').value;
}

function renderBindings() {
  const { rows } = buildBindingRows(currentCustomMappings());
  const groupsContainer = document.querySelector("#binding-groups");
  const groupTemplate = document.querySelector("#binding-group-template").content;
  const rowTemplate = document.querySelector("#binding-row-template").content;
  groupsContainer.textContent = "";

  const rowsByGroup = Object.groupBy(rows, (row) => row.group);
  const groups = Object.entries(rowsByGroup).sort(
    ([a], [b]) => groupMetadata[a].order - groupMetadata[b].order,
  );

  for (const [group, groupRows] of groups) {
    const groupNode = groupTemplate.cloneNode(true);
    const groupElement = groupNode.querySelector(".binding-group");
    groupElement.dataset.group = group;
    const groupLabel = groupMetadata[group]?.label ?? group;
    groupNode.querySelector(".group-name").textContent = groupLabel;
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
        groupLabel,
        row.key,
        row.options,
        row.isUnbound ? "unbound" : "",
      ].filter(Boolean).join(" ").toLowerCase();
      const description = rowNode.querySelector(".command-description");
      description.textContent = row.desc;
      description.classList.toggle("command-custom", row.isCustom);
      if (row.isCustom) {
        description.title = "Custom or remapped binding";
        rowElement.classList.add("is-custom");
      }
      if (row.isUnbound) rowElement.classList.add("is-unbound");
      rowNode.querySelector(".command-name").textContent = row.name;
      const keysContainer = rowNode.querySelector(".binding-keys");
      if (row.key) {
        appendKeySequence(keysContainer, row.key);
      } else {
        const empty = document.createElement("span");
        empty.className = "binding-unbound";
        empty.textContent = "None";
        keysContainer.appendChild(empty);
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

  for (const group of document.querySelectorAll(".binding-group")) {
    let groupVisibleRows = 0;
    for (const row of group.querySelectorAll(".binding-row")) {
      const visible = terms.every((term) => row.dataset.search.includes(term));
      row.hidden = !visible;
      if (visible) {
        groupVisibleRows++;
        visibleRows++;
      }
    }
    group.hidden = groupVisibleRows === 0;
    group.querySelector(".group-count").textContent = `${groupVisibleRows} commands`;
  }

  const suffix = visibleRows === 1 ? "command" : "commands";
  document.querySelector("#binding-count").textContent = `${visibleRows} ${suffix}`;
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
  const root = document.querySelector("#panel-keybindings") ??
    document.querySelector("#bindings-table");
  if (!root) return;

  await Settings.onLoaded();

  // Re-init safely when the document is replaced (unit tests), but don't double-bind on the
  // same DOM when options.init() is called more than once.
  if (root.dataset.keybindingsReady === "true") {
    resetFormFromSettings();
    return;
  }
  root.dataset.keybindingsReady = "true";

  resetFormFromSettings();

  document.querySelector("#binding-search input").addEventListener("input", filterBindings);
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
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      if (!document.querySelector("#panel-keybindings")?.hidden) {
        saveMappings();
      }
    }
  });
}

const testEnv = globalThis.window == null ||
  globalThis.window.location.search.includes("dom_tests=true");
const isStandaloneKeybindingsPage = typeof location !== "undefined" &&
  /keybindings\.html(?:$|\?)/.test(location.pathname + location.search);
if (!testEnv && isStandaloneKeybindingsPage) {
  document.addEventListener("DOMContentLoaded", async () => {
    await Settings.onLoaded();
    DomUtils.injectUserCss();
    await init();
  });
}

export { buildBindingRows, filterBindings, init, renderBindings, saveMappings };
