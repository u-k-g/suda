// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
//
// This wraps the commandBar iframe, which we inject into the page to provide the commandBar.
//
const CommandBar = {
  commandBarUI: null,
  markRegistryEntry: null,
  linkSelectionActive: false,
  zoomFactor: 1,

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
      mode: "modes",
      prefixCount: registryEntry?.options?.prefixCount ?? 1,
    });
  },

  activateAll(sourceFrameId) {
    this.open(sourceFrameId, {
      completer: "omni",
      mode: "",
      newTab: true,
    });
  },

  activateAllInCurrentTab(sourceFrameId) {
    this.open(sourceFrameId, {
      completer: "omni",
      mode: "",
      newTab: false,
    });
  },

  activateFind(_sourceFrameId) {
    Marks.setPreviousPosition();
    return new FindMode();
  },

  activateHistory(sourceFrameId) {
    this.open(sourceFrameId, { completer: "history", mode: "history", selectFirst: true });
  },

  activateMarks(sourceFrameId, registryEntry) {
    this.markRegistryEntry = registryEntry;
    this.open(sourceFrameId, { completer: "local", mode: "marks", selectFirst: true });
  },

  activateLinkActions(sourceFrameId, linkSelectionCount) {
    this.linkSelectionActive = true;
    this.open(sourceFrameId, {
      completer: "local",
      mode: "link-actions",
      selectFirst: true,
      linkSelectionCount,
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
      selectFirst: true,
      query: globalThis.location.href,
    });
  },

  activateEditUrlInNewTab(sourceFrameId) {
    this.open(sourceFrameId, {
      completer: "omni",
      mode: "url",
      selectFirst: true,
      query: globalThis.location.href,
      newTab: false,
    });
  },

  init() {
    if (!this.commandBarUI) {
      this.commandBarUI = new UIComponent();
      this.commandBarUI.load(
        "pages/command_bar_page.html",
        "commandBar-frame",
        this.handleMessage.bind(this),
      );
      globalThis.addEventListener("resize", () => this.refreshPositionInBrowserWindow());
      globalThis.addEventListener(
        "pointerdown",
        forTrusted((event) => {
          if (!this.commandBarUI?.showing) return true;
          const eventPath = event.composedPath?.() ?? [];
          if (!eventPath.includes(this.commandBarUI.iframeElement)) {
            this.commandBarUI.postMessage({ name: "hide" });
          }
          return true;
        }),
        true,
      );
    }
  },

  browserWindowCenterInViewport(outerSize, innerSize) {
    const browserChromeSize = Math.max(0, outerSize - innerSize);
    return Math.max(0, Math.min(innerSize, (outerSize / 2) - browserChromeSize));
  },

  async refreshPositionInBrowserWindow() {
    try {
      const zoomFactor = await chrome.runtime.sendMessage({ handler: "getCurrentZoom" });
      if (Number.isFinite(zoomFactor) && zoomFactor > 0) this.zoomFactor = zoomFactor;
    } catch (_error) {
      // The extension may have been reloaded while this content script was still attached. Keep
      // the last known zoom rather than creating an unhandled rejection from a resize event.
    }
    this.positionInBrowserWindow();
  },

  calculateFrameGeometry(windowDimensions, zoomFactor) {
    const viewportWidth = windowDimensions.innerWidth * zoomFactor;
    const viewportHeight = windowDimensions.innerHeight * zoomFactor;
    const centerY = this.browserWindowCenterInViewport(
      windowDimensions.outerHeight,
      viewportHeight,
    );
    const desiredCenterX = this.browserWindowCenterInViewport(
      windowDimensions.outerWidth,
      viewportWidth,
    );
    const commandBarWidth = Math.min(780, Math.max(340, viewportWidth - 44));
    const centerX = Math.max(
      commandBarWidth / 2,
      Math.min(viewportWidth - (commandBarWidth / 2), desiredCenterX),
    );
    const top = Math.max(16, centerY - 170);
    return {
      height: Math.max(0, viewportHeight - top + 8),
      left: (centerX - (commandBarWidth / 2)) / zoomFactor,
      scale: 1 / zoomFactor,
      top: (top - 8) / zoomFactor,
      width: commandBarWidth,
    };
  },

  positionInBrowserWindow() {
    const geometry = this.calculateFrameGeometry({
      innerHeight: globalThis.innerHeight,
      innerWidth: globalThis.innerWidth,
      outerHeight: globalThis.outerHeight,
      outerWidth: globalThis.outerWidth,
    }, this.zoomFactor);
    const style = this.commandBarUI?.iframeElement?.style;
    style?.setProperty("--suda-command-bar-width", `${geometry.width}px`);
    style?.setProperty("--suda-command-bar-height", `${geometry.height}px`);
    style?.setProperty("--suda-command-bar-left", `${geometry.left}px`);
    style?.setProperty("--suda-command-bar-top", `${geometry.top}px`);
    style?.setProperty("--suda-command-bar-scale", `${geometry.scale}`);
  },

  async handleMessage({ data }) {
    switch (data.name) {
      case "commandBarModeChanged":
        return await this.prepareMode(data.mode);
      case "commandBarFinishMode":
        return this.finishMode(data.commit);
      case "commandBarMark":
        this.finishMode(false);
        await this.commandBarUI.hide();
        return Utils.nextTick(() => {
          Marks.currentRegistryEntry = this.markRegistryEntry || { options: {} };
          Marks.gotoMark(data.key, data.shiftKey);
        });
      case "commandBarAction":
        this.finishMode(data.action.startsWith("link-action:"));
        await this.commandBarUI.hide();
        return Utils.nextTick(() => this.runAction(data.action));
    }
  },

  async prepareMode(mode) {
    if (mode === "marks") {
      const marks = await Marks.getMarksForCurrentPage();
      this.commandBarUI.postMessage({ name: "commandBarMarks", marks });
    }
  },

  finishMode(commit) {
    if (!this.linkSelectionActive) return;
    this.linkSelectionActive = false;
    if (!commit) LinkHints.cancelSelectedLinks();
  },

  runAction(action) {
    const actions = {
      "find": () => {
        Marks.setPreviousPosition();
        return new FindMode();
      },
    };
    if (action.startsWith("link-action:")) {
      LinkHints.performSelectedAction(action);
    } else {
      actions[action]?.();
    }
  },

  // Opens the commandBar.
  // - commandBarShowOptions:
  //     completer: The name of the completer to fetch results from.
  //     query: Optional. Text to prefill the CommandBar with.
  //     selectFirst: Optional. Whether to select the first entry.
  //     newTab: Optional. Whether to open the result in a new tab.
  //     keyword: A keyword which will scope the search to a UserSearchEngine.
  async open(sourceFrameId, commandBarShowOptions) {
    this.init();
    await this.refreshPositionInBrowserWindow();
    // The CommandBar cannot coexist with the help dialog (it causes focus issues).
    HelpDialog.abort();
    Utils.assertType(CommandBarShowOptions, commandBarShowOptions);
    const options = Object.assign({
      completer: "omni",
      mode: "search",
      currentUrl: globalThis.location.href,
    }, commandBarShowOptions);
    this.commandBarUI.show(
      Object.assign(options, { name: "activate" }),
      { sourceFrameId, focus: true },
    );
  },
};

globalThis.CommandBar = CommandBar;
