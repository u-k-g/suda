// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import "./test_helper.js";
import "../../lib/settings.js";
import "../../lib/keyboard_utils.js";
import { allCommands } from "../../background_scripts/all_commands.js";
import {
  Commands,
  helixKeyMappings,
  KeyMappingsParser,
  parseLines,
} from "../../background_scripts/commands.js";
import "../../content_scripts/mode.js";
import "../../content_scripts/mode_key_handler.js";
import "../../content_scripts/marks.js";
import "../../content_scripts/link_hints.js";
import "../../content_scripts/command_bar.js";
// Include mode_normal to check that all commands have been implemented.
import "../../content_scripts/mode_normal.js";
import "../../content_scripts/link_hints.js";
import "../../content_scripts/marks.js";
import "../../content_scripts/command_bar.js";

await Commands.init();

context("command palette browser-window positioning", () => {
  should("translate an outer browser axis into viewport coordinates", () => {
    assert.equal(350, CommandBar.browserWindowCenterInViewport(1000, 850));
  });

  should("use the viewport center when browser chrome is absent", () => {
    assert.equal(450, CommandBar.browserWindowCenterInViewport(900, 900));
  });
});

context("KeyMappingsParser", () => {
  const getErrors = (config) => KeyMappingsParser.parse(config).validationErrors;

  should("handle map statements", () => {
    const { keyToRegistryEntry } = KeyMappingsParser.parse("map a scrollDown");
    assert.equal("scrollDown", keyToRegistryEntry["a"]?.command);
  });

  should("ignore mappings for unknown commands", () => {
    assert.equal({}, KeyMappingsParser.parse("map a unknownCommand").keyToRegistryEntry);
  });

  should("handle mapkey statements", () => {
    const { keyToMappedKey } = KeyMappingsParser.parse("mapkey a b");
    assert.equal({ "a": "b" }, keyToMappedKey);
  });

  should("handle unmap statements", () => {
    const input = "mapkey a b \n unmap a";
    const { keyToMappedKey } = KeyMappingsParser.parse(input);
    assert.equal({}, keyToMappedKey);
  });

  should("handle unmapall statements", () => {
    const input = "mapkey a b \n unmapall \n mapkey b c";
    const { keyToMappedKey } = KeyMappingsParser.parse(input);
    assert.equal({ "b": "c" }, keyToMappedKey);
  });

  should("ignore commands with the wrong number of tokens", () => {
    assert.equal({}, KeyMappingsParser.parse("mapkey a b c").keyToMappedKey);
    assert.equal({}, KeyMappingsParser.parse("map a").keyToRegistryEntry);
    assert.equal(
      { "a": "b" },
      KeyMappingsParser.parse("mapkey a b \n unmap a a").keyToMappedKey,
    );
  });

  should("parse option values surrounded by quotes", () => {
    const { keyToRegistryEntry } = KeyMappingsParser.parse(
      'map v CommandPalette.activateBookmarks query="a b"',
    );
    const entry = keyToRegistryEntry["v"];
    assert.equal({ query: "a b" }, entry.options);
  });

  should("parse options using all 3 syntaxes", () => {
    // This test exercises some of the edge cases of the underlying regular expressions.
    const result = KeyMappingsParser.parseCommandOptions('keyA  keyB="a b=c"  keyC=" ');
    assert.equal({ keyA: true, keyB: "a b=c", keyC: '"' }, result);
  });

  should("parse a URL parameter alongside an option value", () => {
    // URLs alongside the "position" option occurs in the createTab command.
    const result = KeyMappingsParser.parseCommandOptions('abc.com/?param=val position="end"');
    assert.equal({ "abc.com/?param=val": true, position: "end" }, result);
  });

  should("return parsing validation errors", () => {
    assert.equal(0, getErrors("map a scrollDown").length);
    // Missing an action (e.g. map).
    assert.equal(1, getErrors("a scrollDown").length);
    // Invalid action.
    assert.equal(1, getErrors("invalidAction a scrollDown").length);
    // Map requires at least two arguments
    assert.equal(0, getErrors("map a scrollDown").length);
    assert.equal(1, getErrors("map a").length);
    // Unmap allows only 1 argument.
    assert.equal(0, getErrors("unmap a").length);
    assert.equal(1, getErrors("unmap a b").length);
    // Mapkey requires 2 arguments.
    assert.equal(0, getErrors("mapkey a b").length);
    assert.equal(1, getErrors("mapkey a").length);
    // Reject unknown modifiers.
    assert.equal(0, getErrors("map <a-f> scrollDown").length);
    assert.equal(1, getErrors("map <b-f> scrollDown").length);
  });

  should("reject unknown commands on map statements", () => {
    // Reject unknown commands.
    assert.equal(1, getErrors("map a example-command").length);
  });

  should("reject unknown options on map statements", () => {
    assert.equal(1, getErrors("map j LinkHints.activateMode action=focus").length);
    assert.equal(1, getErrors("map j LinkHints.activateMode unknownOption=a").length);
    assert.equal(
      0,
      getErrors("map j CommandPalette.activateAll replaceCurrentUrl").length,
    );
  });

  should("reject count option on commands with noRepeat=true", () => {
    assert.equal(0, getErrors("map j scrollLeft count=1").length);
    assert.equal(1, getErrors("map j copyCurrentUrl count=1").length);
  });

  should("allow arbitrary URLs as arguments to commands with (any url) as an option", () => {
    assert.equal(0, getErrors("map j createTab http://example.com").length);
    assert.equal(1, getErrors("map j createTab invalid-url").length);
  });

  context("parseLines", () => {
    should("omit whitespace", () => {
      assert.equal(0, parseLines("    \n    \n   ").length);
    });

    should("omit comments", () => {
      assert.equal(0, parseLines(' # comment   \n " comment   \n   ').length);
    });

    should("join lines", () => {
      assert.equal(1, parseLines("a\\\nb").length);
      assert.equal("ab", parseLines("a\\\nb")[0]);
    });

    should("trim lines", () => {
      assert.equal(2, parseLines("  a  \n  b").length);
      assert.equal("a", parseLines("  a  \n  b")[0]);
      assert.equal("b", parseLines("  a  \n  b")[1]);
    });
  });

  context("parseKeySequence", () => {
    const testKeySequence = (key, expectedKeyText, expectedKeyLength) => {
      const keySequence = KeyMappingsParser.parseKeySequence(key);
      assert.equal(expectedKeyText, keySequence.join("/"));
      assert.equal(expectedKeyLength, keySequence.length);
    };

    should("lowercase keys correctly", () => {
      testKeySequence("a", "a", 1);
      testKeySequence("A", "A", 1);
      testKeySequence("ab", "a/b", 2);
    });

    should("recognise non-alphabetic keys", () => {
      testKeySequence("#", "#", 1);
      testKeySequence(".", ".", 1);
      testKeySequence("##", "#/#", 2);
      testKeySequence("..", "./.", 2);
    });

    should("parse keys with modifiers", () => {
      testKeySequence("<c-a>", "<c-a>", 1);
      testKeySequence("<c-A>", "<c-A>", 1);
      testKeySequence("<C-A>", "<c-A>", 1);
      testKeySequence("<c-a><a-b>", "<c-a>/<a-b>", 2);
      testKeySequence("<m-a>", "<m-a>", 1);
      testKeySequence("z<m-a>", "z/<m-a>", 2);
    });

    should("normalize with modifiers", () => {
      // Modifiers should be in alphabetical order.
      testKeySequence("<m-c-a-A>", "<a-c-m-A>", 1);
    });

    should("parse and normalize named keys", () => {
      testKeySequence("<space>", "<space>", 1);
      testKeySequence("<Space>", "<space>", 1);
      testKeySequence("<C-Space>", "<c-space>", 1);
      testKeySequence("<f12>", "<f12>", 1);
      testKeySequence("<F12>", "<f12>", 1);
    });

    should("handle angle brackets which are part of not modifiers", () => {
      testKeySequence("<", "<", 1);
      testKeySequence(">", ">", 1);

      testKeySequence("<<", "</<", 2);
      testKeySequence(">>", ">/>", 2);

      testKeySequence("<>", "</>", 2);
      testKeySequence("<>", "</>", 2);

      testKeySequence("<<space>", "</<space>", 2);
      testKeySequence("<C->>", "<c->>", 1);

      testKeySequence("<a>", "</a/>", 3);
    });

    should("negative tests", () => {
      // This should not be parsed as modifiers.
      testKeySequence("<c-@@>", "</c/-/@/@/>", 6);
    });
  });
});

context("disabled actions", () => {
  should("install compact descriptions for partial-key hints", async () => {
    await Commands.loadKeyMappings("");
    const mapping =
      (await chrome.storage.session.get("normalModeKeyStateMapping")).normalModeKeyStateMapping;

    assert.equal("Edit URL", mapping["<space>"].e.desc);
    assert.equal("Previous tab", mapping.g.k.desc);
    assert.equal("Top of page", mapping.g.g.desc);
  });

  should(
    "keep inactive shortcut labels available in command-palette-only mode",
    async () => {
      Settings._settings.disabledActions = ["scrollDown"];
      Settings._settings.commandBarOnly = true;
      await Commands.loadKeyMappings("");
      const activeMapping =
        (await chrome.storage.session.get("normalModeKeyStateMapping")).normalModeKeyStateMapping;
      const commandBarOnlyData =
        (await chrome.storage.session.get("commandToOptionsToKeys")).commandToOptionsToKeys;
      const configuredCommand = Commands.keyToRegistryEntry["j"]?.command;

      Settings._settings.commandBarOnly = false;
      await Commands.loadKeyMappings("");
      const normalModeData =
        (await chrome.storage.session.get("commandToOptionsToKeys")).commandToOptionsToKeys;

      Settings._settings.disabledActions = [];
      Settings._settings.commandBarOnly = Settings.defaultOptions.commandBarOnly;
      await Commands.loadKeyMappings("");

      assert.equal("scrollDown", configuredCommand);
      assert.isFalse(Object.hasOwn(activeMapping, "j"));
      assert.equal(["j"], commandBarOnlyData.scrollDown[""]);
      assert.isFalse(Object.hasOwn(normalModeData, "scrollDown"));
    },
  );
});

context("clipboard search", () => {
  should("search copied text instead of treating it as a URL", () => {
    let sentMessage;
    stub(globalThis, "HUD", {
      pasteFromClipboard(callback) {
        callback("https://example.com copied as search text");
      },
    });
    stub(chrome.runtime, "sendMessage", (message) => sentMessage = message);

    NormalModeCommands.searchCopiedTextInNewTab();

    assert.equal({
      handler: "launchSearchQuery",
      query: "https://example.com copied as search text",
      openInNewTab: true,
    }, sentMessage);
  });
});

context("Validate commands and options data structures", () => {
  should("have either noRepeat or repeatLimit, but not both", () => {
    for (const command of allCommands) {
      const validProperties = !(command.noRepeat && command.repeatLimit);
      if (!validProperties) {
        assert.fail(`${command.name} has incorrect noRepeat and/or repeatLimit config.`);
      }
    }
  });

  should("have required properties", () => {
    for (const command of allCommands) {
      const hasRequired = command.desc.length > 0 && command.group.length > 0;
      if (!hasRequired) {
        assert.fail(`${command.name} is missing required properties.`);
      }
    }
  });

  should("have valid commands for each default key mapping", () => {
    const commandsByName = Utils.keyBy(allCommands, "name");
    for (const [key, commandString] of Object.entries(helixKeyMappings)) {
      // The command string might be command name + an option string. Ignore the options.
      const name = commandString.split(" ")[0];
      if (commandsByName[name] == null) {
        assert.fail(`The default mapping for ${key} is bound to non-existent command ${name}.`);
      }
    }
  });

  should("expose command-palette action names without the old CommandBar prefix", () => {
    const commandNames = allCommands.map(({ name }) => name);
    assert.isTrue(commandNames.some((name) => name.startsWith("CommandPalette.")));
    assert.isFalse(commandNames.some((name) => name.startsWith("CommandBar.")));
  });

  should("use Helix as the only built-in key mapping", () => {
    assert.isFalse(Object.hasOwn(Settings.defaultOptions, "keyBindingMode"));
    assert.isTrue(Object.keys(helixKeyMappings).length > 0);
  });

  should("route Helix picker keys through the unified command palette", () => {
    assert.equal("CommandPalette.activateModeSelection", helixKeyMappings[":"]);
    assert.equal("CommandPalette.activateMarks", helixKeyMappings["<space>'"]);
    assert.equal("Marks.activateCreateMode", helixKeyMappings["<space>m"]);
    assert.equal("CommandPalette.activateAll", helixKeyMappings["<space>t"]);
    assert.equal("openOptionsPage", helixKeyMappings["<space>,"]);
    assert.equal("CommandPalette.activateHistory", helixKeyMappings["<space>h"]);
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<c-t>"));
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<c-w>n"));
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<space>/"));
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<space>?"));
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<space>S"));
  });

  should("open Space-t directly without a selected mode", () => {
    let openOptions = null;
    stub(CommandBar, "open", (_sourceFrameId, options) => openOptions = options);

    CommandBar.activateAll(0);

    assert.equal({ completer: "omni", mode: "", draftKey: "all", newTab: true }, openOptions);
  });

  should("optionally replace the current URL from the main command palette", () => {
    let openOptions = null;
    stub(CommandBar, "open", (_sourceFrameId, options) => openOptions = options);

    CommandBar.activateAll(0, { options: { replaceCurrentUrl: true } });
    assert.equal({ completer: "omni", mode: "", draftKey: "all", newTab: false }, openOptions);

    CommandBar.activateAll(0, { options: { replaceCurrentUrl: "false" } });
    assert.equal({ completer: "omni", mode: "", draftKey: "all", newTab: true }, openOptions);
  });

  should("open command selection in actions mode", () => {
    let openOptions = null;
    stub(CommandBar, "open", (_sourceFrameId, options) => openOptions = options);

    CommandBar.activateCommandSelection(0, { options: {} });

    assert.equal({
      completer: "commands",
      mode: "actions",
      draftKey: "actions",
      selectFirst: true,
    }, openOptions);
  });

  should("prefill the replace-current main command palette for activateEditUrl", () => {
    let openOptions = null;
    stub(globalThis, "location", { href: "https://example.com/path" });
    stub(CommandBar, "open", (_sourceFrameId, options) => openOptions = options);

    CommandBar.activateEditUrl(0);

    assert.equal({
      completer: "omni",
      mode: "",
      newTab: false,
      query: "https://example.com/path",
      draftKey: "edit-url",
    }, openOptions);
  });

  should("bind Helix J and K to configurable fast scrolling", () => {
    assert.equal("scrollFastDown", helixKeyMappings["J"]);
    assert.equal("scrollFastUp", helixKeyMappings["K"]);
    assert.equal(800, Settings.defaultOptions.fastScrollStepSize);
  });

  should("bind Helix Shift-R to recent-tab cycling while keeping soft reload under Space", () => {
    assert.equal("cycleRecentTabs", helixKeyMappings["R"]);
    assert.equal("cycleTabSlots", helixKeyMappings["r"]);
    assert.equal("reload", helixKeyMappings["<space>r"]);
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<space>R"));
  });

  should("bind Helix a directly to caret mode", () => {
    assert.equal("enterCaretMode", helixKeyMappings["a"]);
  });

  should("bind gj and gk to the next and previous tabs", () => {
    assert.equal("nextTab", helixKeyMappings["gj"]);
    assert.equal("previousTab", helixKeyMappings["gk"]);
    assert.isFalse(Object.hasOwn(helixKeyMappings, "gh"));
    assert.isFalse(Object.hasOwn(helixKeyMappings, "gl"));
    assert.isFalse(Object.hasOwn(helixKeyMappings, "gn"));
    assert.isFalse(Object.hasOwn(helixKeyMappings, "gp"));
  });

  should("bind numbered tab slots under p and g", () => {
    for (let slot = 1; slot <= 9; slot++) {
      assert.equal(`pinTabToSlot slot=${slot}`, helixKeyMappings[`p${slot}`]);
      assert.equal(`goToTabSlot slot=${slot}`, helixKeyMappings[`g${slot}`]);
    }
  });

  should("use Helix-style forward, reverse, next, and previous search bindings", () => {
    assert.equal("enterFindMode", helixKeyMappings["/"]);
    assert.equal("enterReverseFindMode", helixKeyMappings["?"]);
    assert.isTrue(Settings.defaultOptions.regexFindMode);
    assert.isFalse(Object.hasOwn(helixKeyMappings, "*"));
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<a-*>"));
    const commandNames = allCommands.map(({ name }) => name);
    assert.isFalse(commandNames.includes("findSelected"));
    assert.isFalse(commandNames.includes("findSelectedBackwards"));
  });

  should("leave optional navigation actions unbound by default", () => {
    for (
      const key of [
        "<space>R",
        "p",
        "gu",
        "gU",
        "[[",
        "]]",
        "<c-w>d",
        "<c-w>v",
      ]
    ) {
      assert.isFalse(Object.hasOwn(helixKeyMappings, key));
    }
  });

  should("leave Space-d unbound", () => {
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<space>d"));
  });

  should("leave tab muting unbound", () => {
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<c-w>m"));
  });

  should("remove retired actions entirely", () => {
    const commandNames = allCommands.map(({ name }) => name);
    for (
      const name of [
        "setZoom",
        "toggleViewSource",
        "showHelp",
        "Marks.activateGotoMode",
        "CommandPalette.activateFind",
        "CommandPalette.activateEditUrlInNewTab",
        "CommandPalette.activateBookmarksInNewTab",
        "visitPreviousTab",
        "goUp",
        "openCopiedUrlInCurrentTab",
        "CommandPalette.activate",
        "CommandPalette.activateInNewTab",
      ]
    ) {
      assert.isFalse(commandNames.includes(name));
    }
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<space>v"));
  });

  should("disable the requested optional actions by default", () => {
    assert.equal(
      [
        "duplicateTab",
        "firstTab",
        "lastTab",
        "createTab",
        "scrollToLeft",
        "scrollToRight",
        "passNextKey",
        "goPrevious",
        "goNext",
        "CommandPalette.activateBookmarks",
        "CommandPalette.activateCommandSelection",
        "togglePinTab",
        "nextFrame",
        "mainFrame",
      ],
      Settings.defaultOptions.disabledActions,
    );
  });

  should("keep goToRoot enabled but unbound by default", () => {
    assert.isTrue(
      allCommands.some(({ name }) => name === "goToRoot"),
    );
    assert.isFalse(Settings.defaultOptions.disabledActions.includes("goToRoot"));
    assert.isFalse(
      Object.values(helixKeyMappings).some((mapping) => mapping.split(" ")[0] === "goToRoot"),
    );
  });

  should("use Space-f as the only Helix link-hint binding", () => {
    assert.equal("LinkHints.activateMode", helixKeyMappings["<space>f"]);
    for (const key of ["<space>F", "<space>a", "<space>y"]) {
      assert.isFalse(Object.hasOwn(helixKeyMappings, key));
    }
  });

  should("expose only the selection-first link-hint command", () => {
    assert.equal(
      ["LinkHints.activateMode"],
      allCommands.map(({ name }) => name).filter((name) => name.startsWith("LinkHints.")),
    );
  });

  should("bind u and U to browser history navigation", () => {
    assert.equal("goBack", helixKeyMappings["u"]);
    assert.equal("goForward", helixKeyMappings["U"]);
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<c-o>"));
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<c-i>"));
  });

  should("omit the redundant scroll and Ctrl-W tab navigation bindings", () => {
    for (const key of ["zj", "zk", "<c-w>h", "<c-w>l", "<c-w>w"]) {
      assert.isFalse(Object.hasOwn(helixKeyMappings, key));
    }
  });

  should("leave Ctrl-W o unbound", () => {
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<c-w>o"));
  });

  should("parse the default keybindings without validation errors", () => {
    const config = Object.entries(helixKeyMappings)
      .map(([key, command]) => `map ${key} ${command}`)
      .join("\n");
    assert.equal([], KeyMappingsParser.parse(config).validationErrors);
  });
});
