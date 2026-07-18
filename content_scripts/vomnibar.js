//
// This wraps the vomnibar iframe, which we inject into the page to provide the vomnibar.
//
const Vomnibar = {
  vomnibarUI: null,
  findMode: null,
  markRegistryEntry: null,

  // sourceFrameId here (and below) is the ID of the frame from which this request originates, which
  // may be different from the current frame.

  activate(sourceFrameId, registryEntry) {
    const options = Object.assign({}, registryEntry.options, {
      completer: "omni",
      mode: "search",
      newTab: true,
    });
    this.open(sourceFrameId, options);
  },

  activateInNewTab(sourceFrameId, registryEntry) {
    const options = Object.assign({}, registryEntry.options, {
      completer: "omni",
      mode: "search",
      newTab: true,
    });
    this.open(sourceFrameId, options);
  },

  // Cmd/Ctrl-T has already created the destination tab. Open URL mode against that tab with an
  // empty query so submitting replaces the local new-tab page instead of creating another tab.
  activateNewTab(sourceFrameId) {
    this.open(sourceFrameId, {
      completer: "omni",
      mode: "url",
      newTab: false,
      currentUrl: "",
    });
  },

  activateModeSelection(sourceFrameId, registryEntry) {
    this.markRegistryEntry = { options: {} };
    this.open(sourceFrameId, {
      completer: "modes",
      mode: "",
      prefixCount: registryEntry?.options?.prefixCount ?? 1,
    });
  },

  activateAll(sourceFrameId) {
    this.open(sourceFrameId, {
      completer: "omni",
      mode: "all",
      newTab: true,
    });
  },

  activateFind(sourceFrameId) {
    this.open(sourceFrameId, { completer: "local", mode: "find" });
  },

  activateHistory(sourceFrameId) {
    this.open(sourceFrameId, { completer: "history", mode: "history", selectFirst: true });
  },

  activateMarks(sourceFrameId, registryEntry) {
    this.markRegistryEntry = registryEntry;
    this.open(sourceFrameId, { completer: "local", mode: "marks", selectFirst: true });
  },

  activateKeybindings(sourceFrameId, registryEntry) {
    this.open(sourceFrameId, {
      completer: "commands",
      mode: "keybindings",
      selectFirst: true,
      prefixCount: registryEntry?.options?.prefixCount ?? 1,
    });
  },

  activateTabSelection(sourceFrameId) {
    this.open(sourceFrameId, {
      completer: "tabs",
      mode: "tabs",
      selectFirst: true,
    });
  },

  activateBookmarks(sourceFrameId, registryEntry) {
    const options = Object.assign({}, registryEntry.options, {
      completer: "bookmarks",
      mode: "bookmarks",
      selectFirst: true,
    });
    this.open(sourceFrameId, options);
  },

  activateCommandSelection(sourceFrameId, registryEntry) {
    const options = Object.assign({}, registryEntry.options, {
      completer: "commands",
      mode: "commands",
      selectFirst: true,
    });
    this.open(sourceFrameId, options);
  },

  activateBookmarksInNewTab(sourceFrameId, registryEntry) {
    const options = Object.assign({}, registryEntry.options, {
      completer: "bookmarks",
      mode: "bookmarks",
      selectFirst: true,
      newTab: true,
    });
    this.open(sourceFrameId, options);
  },

  activateEditUrl(sourceFrameId) {
    this.open(sourceFrameId, {
      completer: "omni",
      mode: "url",
      selectFirst: false,
      query: globalThis.location.href,
    });
  },

  activateEditUrlInNewTab(sourceFrameId) {
    this.open(sourceFrameId, {
      completer: "omni",
      mode: "url",
      selectFirst: false,
      query: globalThis.location.href,
      newTab: false,
    });
  },

  init() {
    if (!this.vomnibarUI) {
      this.vomnibarUI = new UIComponent();
      this.vomnibarUI.load(
        "pages/vomnibar_page.html",
        "vomnibar-frame",
        this.handleMessage.bind(this),
      );
    }
  },

  async handleMessage({ data }) {
    switch (data.name) {
      case "commandBarModeChanged":
        return await this.prepareMode(data.mode);
      case "commandBarFindQuery":
        return this.updateFind(data.query);
      case "commandBarFindNext":
        return this.findNext();
      case "commandBarFinishMode":
        return this.finishMode(data.commit);
      case "commandBarMark":
        this.finishMode(false);
        await this.vomnibarUI.hide();
        return Utils.nextTick(() => {
          Marks.currentRegistryEntry = this.markRegistryEntry || { options: {} };
          Marks.gotoMark(data.key, data.shiftKey);
        });
      case "commandBarAction":
        this.finishMode(false);
        await this.vomnibarUI.hide();
        return Utils.nextTick(() => this.runAction(data.action));
    }
  },

  async prepareMode(mode) {
    this.finishMode(false);
    if (mode === "find") {
      Marks.setPreviousPosition();
      this.findMode = new FindMode({ commandBar: true });
    } else if (mode === "marks") {
      const marks = await Marks.getMarksForCurrentPage();
      this.vomnibarUI.postMessage({ name: "commandBarMarks", marks });
    }
  },

  updateFind(query) {
    if (!this.findMode) return;
    this.findMode.findInPlace(query, {
      postFindFocus: this.vomnibarUI.iframeElement.contentWindow,
    });
    const matchCount = FindMode.query.parsedQuery.length > 0 ? FindMode.query.matchCount : 0;
    this.vomnibarUI.postMessage({ name: "commandBarFindMatches", matchCount });
  },

  findNext() {
    if (!this.findMode) return;
    FindMode.findNext(false, {
      postFindFocus: this.vomnibarUI.iframeElement.contentWindow,
    });
    const matchCount = FindMode.query.parsedQuery.length > 0 ? FindMode.query.matchCount : 0;
    this.vomnibarUI.postMessage({ name: "commandBarFindMatches", matchCount });
  },

  finishMode(commit) {
    if (!this.findMode) return;
    this.findMode.checkReturnToViewPort();
    globalThis.focus();
    if (commit) {
      FindMode.handleEnter();
    }
    this.findMode.exit();
    if (!commit) {
      FindMode.handleEscape();
    } else if (FindMode.query.hasResults) {
      newPostFindMode();
    }
    this.findMode = null;
  },

  runAction(action) {
    const actions = {
      "link:current": () => LinkHints.activateMode(1, {}),
      "link:new": () => LinkHints.activateModeToOpenInNewTab(1),
      "link:multi": () => LinkHints.activateModeWithQueue(),
      "link:download": () => LinkHints.activateModeToDownloadLink(1),
      "link:copy": () => LinkHints.activateModeToCopyLinkUrl(1),
    };
    actions[action]?.();
  },

  // Opens the vomnibar.
  // - vomnibarShowOptions:
  //     completer: The name of the completer to fetch results from.
  //     query: Optional. Text to prefill the Vomnibar with.
  //     selectFirst: Optional. Whether to select the first entry.
  //     newTab: Optional. Whether to open the result in a new tab.
  //     keyword: A keyword which will scope the search to a UserSearchEngine.
  open(sourceFrameId, vomnibarShowOptions) {
    this.init();
    // The Vomnibar cannot coexist with the help dialog (it causes focus issues).
    HelpDialog.abort();
    Utils.assertType(VomnibarShowOptions, vomnibarShowOptions);
    const options = Object.assign({
      completer: "omni",
      mode: "search",
      currentUrl: globalThis.location.href,
    }, vomnibarShowOptions);
    this.vomnibarUI.show(
      Object.assign(options, { name: "activate" }),
      { sourceFrameId, focus: true },
    );
  },
};

globalThis.Vomnibar = Vomnibar;
