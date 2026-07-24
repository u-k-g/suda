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

const captureCommitDelay = 1000;
let activeCapture = null;

function formatKeyTokenParts(token) {
  // Preserve letter case as stored in the mapping (e.g. "j" stays "j"). Only named keys
  // like Space / Enter get title-case labels.
  if (!token.startsWith("<")) {
    return [token];
  }
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
  const displayKey = namedKeys[keyName] ?? keyName;
  return [...modifiers, displayKey];
}

function appendKeyStep(container, token) {
  const formattedParts = formatKeyTokenParts(token);
  formattedParts.forEach((part, index) => {
    if (index > 0) {
      const joiner = document.createElement("span");
      joiner.className = "key-chord-joiner";
      joiner.textContent = "+";
      container.appendChild(joiner);
    }
    const key = document.createElement("kbd");
    key.textContent = part;
    container.appendChild(key);
  });
}

function appendKeySequence(container, keySequence) {
  const binding = document.createElement("span");
  binding.className = "key-sequence";
  const tokens = keySequence.match(/<[^>]+>|./g) ?? [];
  tokens.forEach((token, index) => {
    if (index > 0) {
      const separator = document.createElement("span");
      separator.className = "key-sequence-separator";
      separator.textContent = "›";
      separator.setAttribute("aria-label", "then");
      binding.appendChild(separator);
    }
    appendKeyStep(binding, token);
  });
  container.appendChild(binding);
}

function renderBindingValue(container, keySequence) {
  container.textContent = "";
  if (keySequence) {
    appendKeySequence(container, keySequence);
  } else {
    const empty = document.createElement("span");
    empty.className = "binding-unbound";
    empty.textContent = "None";
    container.appendChild(empty);
  }
}

function formatOptionString(options) {
  return Object.entries(options ?? {}).map(([name, value]) => {
    if (value === true) return name;
    const formattedValue = /\s/.test(String(value)) ? `"${value}"` : value;
    return `${name}=${formattedValue}`;
  }).join(" ");
}

// helixKeyMappings values may include options, e.g. "reload hard" → command reload + hard flag.
function parseDefaultBindingSpec(spec) {
  const parsed = KeyMappingsParser.parse(`map __default__ ${spec}`);
  const entry = parsed.keyToRegistryEntry["__default__"];
  if (!entry) return { command: spec, options: "" };
  return {
    command: entry.command,
    options: formatOptionString(entry.options),
  };
}

const defaultBindingsByKey = Object.fromEntries(
  Object.entries(helixKeyMappings).map(([key, spec]) => [key, parseDefaultBindingSpec(spec)]),
);

function matchesDefaultBinding(key, commandName, optionString) {
  const def = defaultBindingsByKey[key];
  return def != null && def.command === commandName && def.options === optionString;
}

function commandTitle(command, optionString) {
  if (!optionString) return command.desc;
  // Single boolean flag with a documented meaning → use a short distinct title.
  if (optionString === "hard" && command.name === "reload") {
    return "Hard reload the page";
  }
  return `${command.desc} (${optionString})`;
}

function parseActiveMappings(customMappings) {
  const defaultConfig = Object.entries(helixKeyMappings)
    .map(([key, command]) => `map ${key} ${command}`)
    .join("\n");
  return KeyMappingsParser.parse(`${defaultConfig}\n${customMappings}`);
}

function buildBindingRows(customMappings) {
  const parsed = parseActiveMappings(customMappings);
  const activeBindings = Object.entries(parsed.keyToRegistryEntry).map(([key, registryEntry]) => ({
    command: registryEntry.command,
    key,
    options: formatOptionString(registryEntry.options),
  }));
  const bindingsByCommand = Object.groupBy(activeBindings, (binding) => binding.command);
  const missingDefaultKeys = new Set(
    Object.entries(defaultBindingsByKey)
      .filter(([key, def]) => {
        const active = parsed.keyToRegistryEntry[key];
        if (active == null) return true;
        return active.command !== def.command ||
          formatOptionString(active.options) !== def.options;
      })
      .map(([key]) => key),
  );
  const revertKeysByActiveKey = {};
  const claimedDefaultKeys = new Set();

  // A default key assigned to another command/options set can restore that default mapping.
  for (const binding of activeBindings) {
    const def = defaultBindingsByKey[binding.key];
    if (!def) continue;
    if (def.command !== binding.command || def.options !== binding.options) {
      revertKeysByActiveKey[binding.key] = [binding.key];
      claimedDefaultKeys.add(binding.key);
    }
  }

  // Pair a replacement key with a missing default for the same command. This lets a row changed
  // from "j" to "x" restore "j", while an additional custom shortcut simply removes itself.
  for (const binding of activeBindings) {
    const replacedDefault = [...missingDefaultKeys].find((key) => {
      return !claimedDefaultKeys.has(key) && defaultBindingsByKey[key]?.command === binding.command;
    });
    const defForActive = defaultBindingsByKey[binding.key];
    const activeIsForeignDefault = defForActive != null &&
      (defForActive.command !== binding.command || defForActive.options !== binding.options);
    if (replacedDefault != null && (defForActive == null || activeIsForeignDefault)) {
      revertKeysByActiveKey[binding.key] ||= [];
      revertKeysByActiveKey[binding.key].push(replacedDefault);
      claimedDefaultKeys.add(replacedDefault);
    }
  }

  // Include every registered command, even when the Helix defaults leave it unbound.
  const rows = [];
  for (const command of allCommands) {
    const bindings = (bindingsByCommand[command.name] ?? [])
      .sort((a, b) => a.key.localeCompare(b.key));
    for (const binding of bindings) {
      const isDefault = matchesDefaultBinding(binding.key, command.name, binding.options);
      const revertKeys = revertKeysByActiveKey[binding.key] ?? [];
      const revertKey = revertKeys.find((key) => {
        return defaultBindingsByKey[key]?.command === command.name;
      }) ?? revertKeys[0] ?? "";
      rows.push({
        ...command,
        desc: commandTitle(command, binding.options),
        key: binding.key,
        options: binding.options,
        isCustom: !isDefault,
        isUnbound: false,
        revertKey,
        revertKeys,
      });
    }

    // Lost defaults for this command: show a revertible empty row unless an active row for
    // *this* command already reverts that key (e.g. j→x still restores j from the x row).
    // Keys stolen by another command stay claimed above but still need a victim row here.
    const removedDefaults = [...missingDefaultKeys].filter((key) => {
      if (defaultBindingsByKey[key]?.command !== command.name) return false;
      const coveredByActiveRow = bindings.some((binding) =>
        (revertKeysByActiveKey[binding.key] ?? []).includes(key)
      );
      return !coveredByActiveRow;
    });
    for (const revertKey of removedDefaults) {
      const def = defaultBindingsByKey[revertKey];
      rows.push({
        ...command,
        desc: commandTitle(command, def.options),
        key: "",
        options: def.options,
        isCustom: true,
        isUnbound: true,
        revertKey,
        revertKeys: [revertKey],
      });
    }

    if (bindings.length === 0 && removedDefaults.length === 0) {
      rows.push({
        ...command,
        key: "",
        options: "",
        isCustom: false,
        isUnbound: true,
        revertKey: "",
        revertKeys: [],
      });
    }
  }

  return { rows, validationErrors: parsed.validationErrors };
}

function currentCustomMappings() {
  return Settings.get("keyMappings");
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
      rowElement.dataset.key = row.key;
      rowElement.dataset.options = row.options;
      rowElement.dataset.revertKey = row.revertKey;
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
      const editor = rowNode.querySelector(".binding-editor");
      const keysContainer = editor.querySelector(".binding-keys");
      renderBindingValue(keysContainer, row.key);
      editor.setAttribute(
        "aria-label",
        `${row.desc}: ${
          row.key ? `currently ${row.key}` : "currently unbound"
        }. Click to change keybinding. Escape while capturing removes the binding.`,
      );
      editor.addEventListener("click", () => beginShortcutCapture(editor, row));
      editor.addEventListener("keydown", onCaptureKeydown);
      editor.addEventListener("blur", () => finishCaptureOnBlur(editor));

      const revertButton = rowNode.querySelector(".revert-binding");
      revertButton.hidden = !row.isCustom;
      revertButton.setAttribute(
        "aria-label",
        row.revertKey
          ? `Restore the default ${row.revertKey} binding`
          : `Remove the custom ${row.key} binding`,
      );
      revertButton.addEventListener("click", () => void revertBinding(row));
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

function eventToKeyToken(event) {
  let keyChar = KeyboardUtils.getKeyChar(event);
  if (!keyChar) return "";
  const modifiers = [];
  if (event.shiftKey && keyChar.length === 1) keyChar = keyChar.toUpperCase();
  if (event.altKey) modifiers.push("a");
  if (event.ctrlKey) modifiers.push("c");
  if (event.metaKey) modifiers.push("m");
  if (event.shiftKey && keyChar.length > 1) modifiers.push("s");
  const token = [...modifiers, keyChar].join("-");
  return token.length > 1 ? `<${token}>` : token;
}

function showCaptureValue(capture) {
  const keysContainer = capture.editor.querySelector(".binding-keys");
  keysContainer.textContent = "";
  if (capture.tokens.length > 0) {
    appendKeySequence(keysContainer, capture.tokens.join(""));
  } else {
    const prompt = document.createElement("span");
    prompt.className = "binding-capture-prompt";
    prompt.textContent = "Press shortcut…";
    keysContainer.appendChild(prompt);
  }
}

function endCaptureUi(editor) {
  editor.classList.remove("is-recording");
  editor.removeAttribute("aria-live");
}

function cancelShortcutCapture() {
  if (activeCapture == null) return;
  clearTimeout(activeCapture.timer);
  const { editor, row } = activeCapture;
  activeCapture = null;
  endCaptureUi(editor);
  renderBindingValue(editor.querySelector(".binding-keys"), row.key);
}

function beginShortcutCapture(editor, row) {
  if (activeCapture?.editor === editor) return;
  cancelShortcutCapture();
  activeCapture = { editor, row, tokens: [], timer: null };
  editor.classList.add("is-recording");
  editor.setAttribute("aria-live", "polite");
  showCaptureValue(activeCapture);
  editor.focus();
}

function onCaptureKeydown(event) {
  if (activeCapture?.editor !== event.currentTarget) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.key === "Escape") {
    void clearBindingFromCapture();
    return;
  }
  if (event.repeat || KeyboardUtils.isModifier(event)) return;

  const token = eventToKeyToken(event);
  if (!token) return;
  activeCapture.tokens.push(token);
  showCaptureValue(activeCapture);
  clearTimeout(activeCapture.timer);
  activeCapture.timer = setTimeout(() => void commitShortcutCapture(), captureCommitDelay);
}

function finishCaptureOnBlur(editor) {
  queueMicrotask(() => {
    if (activeCapture?.editor !== editor) return;
    if (activeCapture.tokens.length > 0) {
      void commitShortcutCapture();
    } else {
      cancelShortcutCapture();
    }
  });
}

async function clearBindingFromCapture() {
  if (activeCapture == null) return;
  clearTimeout(activeCapture.timer);
  const { editor, row } = activeCapture;
  activeCapture = null;
  endCaptureUi(editor);
  if (row.key) {
    await updateBinding(row, "");
  } else {
    renderBindingValue(editor.querySelector(".binding-keys"), "");
  }
}

async function commitShortcutCapture() {
  if (activeCapture == null || activeCapture.tokens.length === 0) return;
  clearTimeout(activeCapture.timer);
  const { editor, row, tokens } = activeCapture;
  activeCapture = null;
  endCaptureUi(editor);
  await updateBinding(row, tokens.join(""));
}

function appendMappingStatements(customMappings, statements) {
  const current = customMappings.trimEnd();
  return `${current}${current ? "\n" : ""}${statements.join("\n")}`;
}

async function updateBinding(row, nextKey) {
  if (nextKey === row.key) {
    renderBindings();
    return true;
  }

  const statements = [];
  if (row.key) statements.push(`unmap ${row.key}`);
  if (nextKey) {
    const options = row.options ? ` ${row.options}` : "";
    statements.push(`map ${nextKey} ${row.name}${options}`);
  }
  const customMappings = appendMappingStatements(currentCustomMappings(), statements);
  const parsed = KeyMappingsParser.parse(customMappings);
  const validation = document.querySelector("#mapping-validation");
  if (parsed.validationErrors.length > 0) {
    validation.textContent = parsed.validationErrors.join("\n");
    validation.hidden = false;
    renderBindings();
    return false;
  }

  const settings = Settings.getSettings();
  settings.keyMappings = customMappings;
  await Settings.setSettings(settings);
  validation.hidden = true;
  renderBindings();
  return true;
}

async function revertBinding(row) {
  const statements = [];
  if (row.key) statements.push(`unmap ${row.key}`);
  for (const revertKey of row.revertKeys) {
    statements.push(`map ${revertKey} ${helixKeyMappings[revertKey]}`);
  }
  const customMappings = appendMappingStatements(currentCustomMappings(), statements);
  const settings = Settings.getSettings();
  settings.keyMappings = customMappings;
  await Settings.setSettings(settings);
  document.querySelector("#mapping-validation").hidden = true;
  renderBindings();
}

function resetFromSettings() {
  cancelShortcutCapture();
  document.querySelector("#mapping-validation").hidden = true;
  renderBindings();
}

async function init() {
  const root = document.querySelector("#panel-keybindings") ??
    document.querySelector("#bindings-table");
  if (!root) return;

  await Settings.onLoaded();

  // Re-init safely when the document is replaced (unit tests), but don't double-bind on the
  // same DOM when options.init() is called more than once.
  if (root.dataset.keybindingsReady === "true") {
    resetFromSettings();
    return;
  }
  root.dataset.keybindingsReady = "true";

  resetFromSettings();

  document.querySelector("#binding-search input").addEventListener("input", filterBindings);
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

export { buildBindingRows, filterBindings, init, renderBindings, revertBinding, updateBinding };
