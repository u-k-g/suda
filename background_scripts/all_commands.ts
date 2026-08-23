// This is the order they will be shown in the help dialog.
//
// Properties:
// - advanced: advanced commands are not shown in the help dialog by default.
// - background: whether this command has to be run by the background page.
// - desc: shown in the help dialog and command listing page.
// - details: extra help information that will only be shown on the command listing page.
// - group: commands are displayed in groups in the help dialog and command listing.
// - shortDesc: compact label used for partial-key hints in the bottom HUD.
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
    shortDesc: "Top of page",
    group: "navigation",
    noRepeat: true,
  },

  {
    name: "scrollToBottom",
    desc: "Scroll to the bottom of the page",
    shortDesc: "Bottom of page",
    group: "navigation",
    noRepeat: true,
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
    shortDesc: "Reload page",
    group: "navigation",
    background: true,
    noRepeat: true,
  },

  {
    name: "hardReload",
    desc: "Hard reload the page",
    details: "Reload the page while forcing the browser to bypass its cache.",
    group: "navigation",
    background: true,
    advanced: true,
    noRepeat: true,
  },

  {
    name: "copyCurrentUrl",
    desc: "Copy the current URL to the clipboard",
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
    name: "enterSelectMode",
    desc: "Enter select mode",
    group: "navigation",
    noRepeat: true,
  },

  {
    name: "enterCaretMode",
    desc: "Enter caret mode",
    group: "navigation",
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
    shortDesc: "Focus text input",
    group: "navigation",
    noRepeat: true,
  },

  {
    name: "LinkHints.activateMode",
    desc: "Select links, then choose an action",
    shortDesc: "Select links",
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
    shortDesc: "Create mark",
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
    desc: "Open the command bar",
    shortDesc: "Search or open URL",
    options: {
      replaceCurrentUrl: "Replace the current tab's URL with the selected destination instead of " +
        "opening it in a new tab. False by default.",
    },
    group: "commandBar",
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activateHistory",
    desc: "Search history using the command bar",
    shortDesc: "Search history",
    group: "commandBar",
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activateMarks",
    desc: "Jump to a page mark using the command bar",
    shortDesc: "Jump to mark",
    group: "commandBar",
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activateBookmarks",
    desc: "Open a bookmark",
    shortDesc: "Search bookmarks",
    group: "commandBar",
    options: {
      query: "The text to prefill the CommandBar with.",
    },
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activateCommandSelection",
    desc: "Execute a Suda action",
    group: "commandBar",
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activateTabSelection",
    desc: "Search through your open tabs",
    shortDesc: "Search tabs",
    group: "commandBar",
    topFrame: true,
    noRepeat: true,
  },

  {
    name: "CommandBar.activateEditUrl",
    desc: "Open the command bar and replace the current URL",
    shortDesc: "Edit URL",
    group: "commandBar",
    topFrame: true,
    noRepeat: true,
  },

  //
  // Find
  //

  {
    name: "enterFindMode",
    desc: "Search forward for a regular expression",
    group: "find",
    noRepeat: true,
  },

  {
    name: "enterReverseFindMode",
    desc: "Search backward for a regular expression",
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
    shortDesc: "Previous tab",
    group: "tabs",
    background: true,
  },

  {
    name: "nextTab",
    desc: "Go one tab right",
    shortDesc: "Next tab",
    group: "tabs",
    background: true,
  },

  {
    name: "cycleRecentTabs",
    desc: "Cycle through recently visited tabs",
    group: "tabs",
    background: true,
    noRepeat: true,
  },

  {
    name: "cycleTabSlots",
    desc: "Cycle through numbered Suda tab slots",
    shortDesc: "Cycle tab slots",
    group: "tabs",
    background: true,
    noRepeat: true,
  },

  {
    name: "pinTabToSlot",
    desc: "Pin the current tab to a numbered Suda slot",
    shortDesc: "Pin tab to slot",
    options: {
      slot: "The numbered slot (1-9) to assign to the current tab.",
    },
    group: "tabs",
    background: true,
    noRepeat: true,
  },

  {
    name: "goToTabSlot",
    desc: "Go to a tab in a numbered Suda slot",
    shortDesc: "Go to tab slot",
    options: {
      slot: "The numbered slot (1-9) to open.",
    },
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
    shortDesc: "Pin or unpin tab",
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
    shortDesc: "Close tab",
    group: "tabs",
    background: true,
    // Don't close (in one command invocation) more than the number of tabs that can be re-opened by
    // the browser.
    repeatLimit: chrome.sessions?.MAX_SESSION_RESULTS || 25,
  },

  {
    name: "restoreTab",
    desc: "Restore closed tab",
    shortDesc: "Restore tab",
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
    shortDesc: "Move tab left",
    group: "tabs",
    advanced: true,
    background: true,
  },

  {
    name: "moveTabRight",
    desc: "Move tab to the right",
    shortDesc: "Move tab right",
    group: "tabs",
    advanced: true,
    background: true,
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
    name: "openOptionsPage",
    desc: "Edit options",
    shortDesc: "Open settings",
    group: "misc",
    background: true,
    noRepeat: true,
  },

  {
    name: "openKeybindingsPage",
    desc: "Edit keybindings",
    group: "misc",
    background: true,
    noRepeat: true,
  },
];

export { allCommands };
