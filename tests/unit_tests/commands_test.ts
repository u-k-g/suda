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

context("CommandBar browser-window positioning", () => {
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
    const { keyToRegistryEntry } = KeyMappingsParser.parse('map v CommandBar.activate query="a b"');
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

  should("use Helix as the only built-in key mapping", () => {
    assert.isFalse(Object.hasOwn(Settings.defaultOptions, "keyBindingMode"));
    assert.isTrue(Object.keys(helixKeyMappings).length > 0);
  });

  should("route Helix picker keys through the unified command bar", () => {
    assert.equal("CommandBar.activateModeSelection", helixKeyMappings[":"]);
    assert.equal("CommandBar.activateFind", helixKeyMappings["<space>/"]);
    assert.equal("CommandBar.activateMarks", helixKeyMappings["<space>'"]);
    assert.equal("Marks.activateCreateMode", helixKeyMappings["<space>m"]);
    assert.equal("CommandBar.activateAll", helixKeyMappings["<space>t"]);
    assert.equal("openOptionsPage", helixKeyMappings["<space>,"]);
    assert.equal("CommandBar.activateInNewTab", helixKeyMappings["<c-w>n"]);
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<c-t>"));
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<space>h"));
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<space>?"));
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<space>S"));
  });

  should("open Space-t directly without a selected mode", () => {
    let openOptions = null;
    stub(CommandBar, "open", (_sourceFrameId, options) => openOptions = options);

    CommandBar.activateAll(0);

    assert.equal({ completer: "omni", mode: "", newTab: true }, openOptions);
  });

  should("reuse the protected-page fallback tab for its selected result", () => {
    let openOptions = null;
    stub(CommandBar, "open", (_sourceFrameId, options) => openOptions = options);

    CommandBar.activateAllInCurrentTab(0);

    assert.equal({ completer: "omni", mode: "", newTab: false }, openOptions);
  });

  should("open Ctrl-W n directly in search mode", () => {
    let openOptions = null;
    stub(CommandBar, "open", (_sourceFrameId, options) => openOptions = options);

    CommandBar.activateInNewTab(0, { options: {} });

    assert.equal({ completer: "omni", mode: "search", newTab: true }, openOptions);
  });

  should("bind Helix J and K to configurable fast scrolling", () => {
    assert.equal("scrollFastDown", helixKeyMappings["J"]);
    assert.equal("scrollFastUp", helixKeyMappings["K"]);
    assert.equal(800, Settings.defaultOptions.fastScrollStepSize);
  });

  should("bind Helix r to recent-tab cycling while keeping reload under Space", () => {
    assert.equal("cycleRecentTabs", helixKeyMappings["r"]);
    assert.equal("reload", helixKeyMappings["<space>r"]);
  });

  should("bind Helix a directly to caret mode", () => {
    assert.equal("enterCaretMode", helixKeyMappings["a"]);
  });

  should("leave Space-d unbound", () => {
    assert.isFalse(Object.hasOwn(helixKeyMappings, "<space>d"));
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
