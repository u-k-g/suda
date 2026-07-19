// This is the order they will be shown in the help dialog.
//
// Properties:
// - advanced: advanced commands are not shown in the help dialog by default.
// - background: whether this command has to be run by the background page.
// - desc: shown in the help dialog and command listing page.
// - details: extra help information that will only be shown on the command listing page.
// - group: commands are displayed in groups in the help dialog and command listing.
// - noRepeat: whether this command can be used with a count key prefix.
// - repeatLimit: the number of allowed repetitions of this command before the user is prompted for
//   confirmation.
// - topFrame: whether this command must be run only in the top frame of a page.
//
const allCommands = [
  //
  // Navigation
  //

  {
    name: "scrollDown",
    desc: "Scroll down",
    group: "navigation",
  },

  {
    name: "scrollUp",
    desc: "Scroll up",
    group: "navigation",
  },

  {
    name: "scrollFastDown",
    desc: "Scroll down by the fast scroll step",
    group: "navigation",
  },

  {
    name: "scrollFastUp",
    desc: "Scroll up by the fast scroll step",
    group: "navigation",
  },

  {
    name: "scrollToTop",
    desc: "Scroll to the top of the page",
    group: "navigation",
    noRepeat: true,
  },

  {
    name: "scrollToBottom",
    desc: "Scroll to the bottom of the page",
    group: "navigation",
    noRepeat: true,
  },

  {
    name: "scrollPageDown",
    desc: "Scroll a half page down",
    group: "navigation",
  },

  {
    name: "scrollPageUp",
    desc: "Scroll a half page up",
    group: "navigation",
  },

  {
    name: "scrollFullPageDown",
    desc: "Scroll a full page down",
    group: "navigation",
  },

  {
    name: "scrollFullPageUp",
    desc: "Scroll a full page up",
    group: "navigation",
  },

  {
    name: "scrollLeft",
    desc: "Scroll left",
    group: "navigation",
  },

  {
    name: "scrollRight",
    desc: "Scroll right",
    group: "navigation",
    advanced: true,
  },

  {
    name: "scrollToLeft",
    desc: "Scroll all the way to the left",
    group: "navigation",
    advanced: true,
    noRepeat: true,
  },

  {
    name: "scrollToRight",
    desc: "Scroll all the way to the right",
    group: "navigation",
    advanced: true,
    noRepeat: true,
  },

  {
    name: "reload",
    desc: "Reload the page",
    group: "navigation",
    background: true,
    options: {
      hard: "Perform a hard reload, forcing the browser to bypass its cache.",
    },
    noRepeat: true,
  },

  {
    name: "copyCurrentUrl",
    desc: "Copy the current URL to the clipboard",
    group: "navigation",
    noRepeat: true,
  },

  {
    name: "openCopiedUrlInCurrentTab",
    desc: "Open the clipboard's URL in the current tab",
    group: "navigation",
    noRepeat: true,
  },

  {
    name: "openCopiedUrlInNewTab",
    desc: "Open the clipboard's URL in a new tab",
    group: "navigation",
    noRepeat: true,
    options: {
      position: "Where to place the tab in the tab bar. " +
        "One of `start`, `before`, `after`, `end`. `after` is the default.",
    },
  },

  {
    name: "goUp",
    desc: "Go up the URL hierarchy",
    group: "navigation",
    advanced: true,
  },

  {
    name: "goToRoot",
    desc: "Go to the root of current URL hierarchy",
    group: "navigation",
    advanced: true,
    noRepeat: true,
  },

  {
    name: "enterInsertMode",
    desc: "Enter insert mode",
    group: "navigation",
    noRepeat: true,
  },

  {
    name: "enterVisualMode",
    desc: "Enter visual mode",
    group: "navigation",
    noRepeat: true,
  },

  {
    name: "enterSelectMode",
    desc: "Enter Helix-style select mode",
    group: "navigation",
    noRepeat: true,
  },

  {
    name: "enterCaretMode",
    desc: "Enter Helix-style caret mode",
    group: "navigation",
    noRepeat: true,
  },

  {
    name: "enterVisualLineMode",
    desc: "Enter visual line mode",
    group: "navigation",
    advanced: true,
    noRepeat: true,
  },

  {
    name: "selectLine",
    desc: "Select the current line",
    group: "navigation",
    noRepeat: true,
  },

  {
    name: "passNextKey",
    desc: "Pass the next key to the page",
    options: {
      normal: "Optional. Enter Suda's normal mode, and ignore any defined pass keys.",
    },
    group: "navigation",
    advanced: true,
  },

  {
    name: "focusInput",
    desc: "Focus the first text input on the page",
    group: "navigation",
    noRepeat: true,
  },

  {
    name: "LinkHints.activateMode",
    desc: "Select links, then choose an action",
    group: "navigation",
    noRepeat: true,
  },

  {
    name: "goPrevious",
    desc: "Follow the link labeled previous or <",
    group: "navigation",
    advanced: true,
    noRepeat: true,
  },

  {
    name: "goNext",
    desc: "Follow the link labeled next or >",
    group: "navigation",
    advanced: true,
    noRepeat: true,
  },

  {
    name: "nextFrame",
    desc: "Select the next frame on the page",
    group: "navigation",
    background: true,
  },

  {
    name: "mainFrame",
    desc: "Select the page's main/top frame",
    group: "navigation",
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "Marks.activateCreateMode",
    desc: "Create a new mark",
    details: "Do this by typing the key bound to this command, and then a letter. " +
      "This will set a mark bound to that letter. Lowercase letters are local marks and uppercase " +
      "letters are global marks.",
    options: {
      swap: "Swap global and local marks. This option exists because in a browser, global marks " +
        "are generally more useful than local marks, and so it may be desirable to make lowercase " +
        "letters represent global marks rather than local marks.",
    },
    group: "navigation",
    advanced: true,
    noRepeat: true,
  },

  {
    name: "Marks.activateGotoMode",
    desc: "Jump to a mark",
    options: {
      swap: "Swap global and local marks. This option exists because in a browser, global marks " +
        "are generally more useful than local marks, and so it may be desirable to make lowercase " +
        "letters represent global marks rather than local marks.",
    },
    group: "navigation",
    advanced: true,
    noRepeat: true,
  },

  //
  // CommandBar
  //

  {
    name: "CommandBar.activateModeSelection",
    desc: "Open the command-bar mode selector",
    group: "commandBar",
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activateAll",
    desc: "Open the modeless command bar",
    group: "commandBar",
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activateFind",
    desc: "Find text using the command bar",
    group: "commandBar",
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activateHistory",
    desc: "Search history using the command bar",
    group: "commandBar",
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activateMarks",
    desc: "Jump to a page mark using the command bar",
    group: "commandBar",
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activate",
    desc: "Open URL, bookmark or history entry",
    options: {
      query: "The text to prefill the CommandBar with.",
      keyword: 'The keyword of a search engine defined in the "Custom search engines" ' +
        "section of the Suda Options page. The CommandBar will be scoped to use that search engine.",
    },
    group: "commandBar",
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activateInNewTab",
    desc: "Open URL, bookmark or history entry in a new tab",
    group: "commandBar",
    options: {
      query: "The text to prefill the CommandBar with.",
      keyword: 'The keyword of a search engine defined in the "Custom search engines" ' +
        "section of the Suda Options page. The CommandBar will be scoped to use that search engine.",
    },
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activateBookmarks",
    desc: "Open a bookmark",
    group: "commandBar",
    options: {
      query: "The text to prefill the CommandBar with.",
    },
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activateBookmarksInNewTab",
    desc: "Open a bookmark in a new tab",
    group: "commandBar",
    options: {
      query: "The text to prefill the CommandBar with.",
    },
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activateCommandSelection",
    desc: "Execute a Suda command",
    group: "commandBar",
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activateTabSelection",
    desc: "Search through your open tabs",
    group: "commandBar",
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activateEditUrl",
    desc: "Edit the current URL",
    group: "commandBar",
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activateEditUrlInNewTab",
    desc: "Edit the current URL and open in a new tab",
    group: "commandBar",
    topFrame: true,
    noRepeat: true,
  },

  //
  // Find
  //

  {
    name: "enterFindMode",
    desc: "Enter find mode.",
    group: "find",
    noRepeat: true,
  },

  {
    name: "performFind",
    desc: "Cycle forward to the next find match",
    group: "find",
  },

  {
    name: "performBackwardsFind",
    desc: "Cycle backward to the previous find match",
    group: "find",
  },

  {
    name: "findSelected",
    desc: "Find the selected text",
    group: "find",
    advanced: true,
  },

  {
    name: "findSelectedBackwards",
    desc: "Find the selected text, searching backwards",
    group: "find",
    advanced: true,
  },

  //
  // History
  //

  {
    name: "goBack",
    desc: "Go back in history",
    group: "history",
  },

  {
    name: "goForward",
    desc: "Go forward in history",
    group: "history",
  },

  //
  // Tabs
  //

  {
    name: "createTab",
    desc: "Create new tab",
    options: {
      "(any url)": "Open this URL, rather than the browser's new tab page. " +
        "E.g.: `map X createTab https://example.com`",
      window: "Create the tab in a new window",
      incognito: "Create the tab in an incognito window",
      position: "Where to place the tab in the tab bar. " +
        "One of `start`, `before`, `after`, `end`. `after` is the default.",
    },
    group: "tabs",
    background: true,
    repeatLimit: 20,
  },

  {
    name: "previousTab",
    desc: "Go one tab left",
    group: "tabs",
    background: true,
  },

  {
    name: "nextTab",
    desc: "Go one tab right",
    group: "tabs",
    background: true,
  },

  {
    name: "visitPreviousTab",
    desc: "Go to previously-visited tab",
    group: "tabs",
    background: true,
  },

  {
    name: "cycleRecentTabs",
    desc: "Cycle through the five most recently visited tabs",
    group: "tabs",
    background: true,
    noRepeat: true,
  },

  {
    name: "firstTab",
    desc: "Go to the first tab",
    group: "tabs",
    background: true,
    noRepeat: true,
  },

  {
    name: "lastTab",
    desc: "Go to the last tab",
    group: "tabs",
    background: true,
    noRepeat: true,
  },

  {
    name: "duplicateTab",
    desc: "Duplicate current tab",
    group: "tabs",
    background: true,
    repeatLimit: 20,
  },

  {
    name: "togglePinTab",
    desc: "Pin or unpin current tab",
    group: "tabs",
    background: true,
    noRepeat: true,
  },

  {
    name: "toggleMuteTab",
    desc: "Mute or unmute current tab",
    options: {
      all: "Mute all tabs.",
      other: "Mute every tab except the current one.",
    },
    group: "tabs",
    background: true,
    noRepeat: true,
  },

  {
    name: "removeTab",
    desc: "Close current tab",
    group: "tabs",
    background: true,
    // Don't close (in one command invocation) more than the number of tabs that can be re-opened by
    // the browser.
    repeatLimit: chrome.sessions?.MAX_SESSION_RESULTS || 25,
  },

  {
    name: "restoreTab",
    desc: "Restore closed tab",
    group: "tabs",
    background: true,
    repeatLimit: 20,
  },

  {
    name: "moveTabToNewWindow",
    desc: "Move tab to new window",
    group: "tabs",
    advanced: true,
    background: true,
    noRepeat: true,
  },

  {
    name: "closeTabsOnLeft",
    desc: "Close tabs on the left",
    group: "tabs",
    advanced: true,
    background: true,
  },

  {
    name: "closeTabsOnRight",
    desc: "Close tabs on the right",
    group: "tabs",
    advanced: true,
    background: true,
  },

  {
    name: "closeOtherTabs",
    desc: "Close all other tabs",
    group: "tabs",
    advanced: true,
    background: true,
    noRepeat: true,
  },

  {
    name: "moveTabLeft",
    desc: "Move tab to the left",
    group: "tabs",
    advanced: true,
    background: true,
  },

  {
    name: "moveTabRight",
    desc: "Move tab to the right",
    group: "tabs",
    advanced: true,
    background: true,
  },

  {
    name: "setZoom",
    desc: "Set zoom",
    group: "tabs",
    advanced: true,
    background: true,
    options: {
      level: "The zoom level. This can be a range of [0.25, 5.0]. 1.0 is the default.",
    },
    noRepeat: true,
  },

  {
    name: "zoomIn",
    desc: "Zoom in",
    group: "tabs",
    advanced: true,
    background: true,
  },

  {
    name: "zoomOut",
    desc: "Zoom out",
    group: "tabs",
    advanced: true,
    background: true,
  },

  {
    name: "zoomReset",
    desc: "Reset zoom",
    group: "tabs",
    advanced: true,
    background: true,
    noRepeat: true,
  },

  //
  // Misc
  //

  {
    name: "excludeAllSudaKeys",
    desc: "Exclude all Suda keys on current page",
    group: "misc",
    background: true,
    noRepeat: true,
  },

  {
    name: "toggleViewSource",
    desc: "View page source",
    group: "misc",
    advanced: true,
    noRepeat: true,
  },

  {
    name: "showHelp",
    desc: "Show help",
    group: "misc",
    noRepeat: true,
    topFrame: true,
  },
];

export { allCommands };
