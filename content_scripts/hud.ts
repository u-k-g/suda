// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
//
// A heads-up-display (HUD) for showing Suda page operations.
// Note: you cannot interact with the HUD until document.body is available.
//
const HUD = {
  tween: null,
  hudUI: null,
  findMode: null,
  abandon() {
    if (this.hudUI) {
      this.hudUI.hide(false);
    }
  },

  // Set by @pasteFromClipboard to handle the value returned by pasteResponse
  pasteListener: null,

  // The HUD is rendered in an isolated extension frame so page styles cannot affect it.

  handleUIComponentMessage({ data }) {
    const handlers = {
      hideFindMode: this.hideFindMode,
      findNext: this.findNext,
      search: this.search,
      unfocusIfFocused: this.unfocusIfFocused,
      pasteResponse: this.pasteResponse,
      showClipboardUnavailableMessage: this.showClipboardUnavailableMessage,
    };
    const handler = handlers[data.name];
    if (handler) {
      return handler.bind(this)(data);
    }
  },

  async init(focusable) {
    await Settings.onLoaded();
    if (focusable == null) {
      focusable = true;
    }
    if (this.hudUI == null) {
      const queryString = globalThis.sudaDomTestsAreRunning ? "?dom_tests=true" : "";
      this.hudUI = new UIComponent();
      this.hudUI.load(
        `pages/hud_page.html${queryString}`,
        "suda-hud-frame",
        this.handleUIComponentMessage.bind(this),
      );
    }
    // this[data.name]? data
    if (this.tween == null) {
      this.tween = new Tween(
        "iframe.suda-hud-frame.suda-ui-component-visible",
        this.hudUI.shadowDOM,
      );
    }
    const classList = this.hudUI.iframeElement.classList;
    if (focusable) {
      classList.remove("suda-non-clickable");
      classList.add("suda-clickable");
      // Note(gdh1995): Chrome 74 only acknowledges text selection when a frame has been visible.
      // See more in #3277.
      // Show the HUD frame before interacting with its selection.
      this.hudUI.setIframeVisible(true);
      // Force the re-computation of styles, so Chrome sends a visibility change message to the
      // child frame. See https://github.com/u-k-g/suda/pull/3277#issuecomment-487363284
      getComputedStyle(this.hudUI.iframeElement).display;
    } else {
      classList.add("suda-non-clickable");
      classList.remove("suda-clickable");
    }
  },

  // duration - if omitted, the message will show until dismissed.
  async show(text, duration) {
    await DomUtils.documentComplete();
    clearTimeout(this._showForDurationTimerId);
    // @hudUI.activate will take charge of making it visible
    await this.init(false);
    this.hudUI.show({ name: "show", text });
    this.tween.fade(1.0, 150);

    if (duration != null) {
      this._showForDurationTimerId = setTimeout(() => this.hide(), duration);
    }
  },

  async showFindMode(findMode = null) {
    this.findMode = findMode;
    await DomUtils.documentComplete();
    await this.init();
    this.hudUI.show({ name: "showFindMode" });
    this.tween.fade(1.0, 150);
  },

  search(data) {
    // Keep focus in the HUD so the user can continue typing after a search.
    this.findMode.findInPlace(data.query, {
      "postFindFocus": this.hudUI.iframeElement.contentWindow,
    });

    // Show the number of matches in the HUD UI.
    const matchCount = FindMode.query.parsedQuery.length > 0 ? FindMode.query.matchCount : 0;
    const showMatchText = FindMode.query.rawQuery.length > 0;
    this.hudUI.postMessage({ name: "updateMatchesCount", matchCount, showMatchText });
  },

  findNext({ backwards = false }) {
    if (!this.findMode || !FindMode.query.rawQuery) return;

    const nextQuery = FindMode.getNextQueryFromRegexMatches(backwards);
    if (nextQuery) {
      Marks.setPreviousPosition();
      FindMode.query.hasResults = FindMode.execute(nextQuery, {
        backwards,
        postFindFocus: this.hudUI.iframeElement.contentWindow,
      });
      FindMode.saveQuery();
    }

    const matchCount = FindMode.query.parsedQuery.length > 0 ? FindMode.query.matchCount : 0;
    this.hudUI.postMessage({
      name: "updateMatchesCount",
      matchCount,
      showMatchText: FindMode.query.rawQuery.length > 0,
    });
  },

  // Hide the HUD.
  // If :immediate is falsy, then the HUD is faded out smoothly (otherwise it is hidden
  // immediately).
  // If :updateIndicator is truthy, then we also refresh the mode indicator. The only time we don't
  // update the mode indicator, is when hide() is called for the mode indicator itself.
  hide(immediate, updateIndicator) {
    if (immediate == null) {
      immediate = false;
    }
    if (updateIndicator == null) {
      updateIndicator = true;
    }
    if ((this.hudUI != null) && (this.tween != null)) {
      clearTimeout(this._showForDurationTimerId);
      this.tween.stop();
      if (immediate) {
        if (updateIndicator) {
          Mode.setIndicator();
        } else {
          this.hudUI.hide();
        }
      } else {
        this.tween.fade(0, 150, () => this.hide(true, updateIndicator));
      }
    }
  },

  // These parameters describe the reason find mode is exiting, and come from the HUD UI component.
  hideFindMode({ exitEventIsEnter, exitEventIsEscape }) {
    let postExit;
    this.findMode.checkReturnToViewPort();

    // An element won't receive a focus event if the search landed on it while we were in the HUD
    // iframe. To end up with the correct modes active, we create a focus/blur event manually after
    // refocusing this window.
    globalThis.focus();

    const focusNode = DomUtils.getSelectionFocusElement();
    if (document.activeElement != null) {
      document.activeElement.blur();
    }

    if (focusNode && focusNode.focus) {
      focusNode.focus();
    }

    if (exitEventIsEnter) {
      FindMode.handleEnter();
      if (FindMode.query.hasResults) {
        postExit = () => newPostFindMode();
      }
    } else if (exitEventIsEscape) {
      // We don't want FindMode to handle the click events that FindMode.handleEscape can generate,
      // so we wait until the mode is closed before running it.
      postExit = FindMode.handleEscape;
    }

    this.findMode.exit();
    if (postExit) {
      postExit();
    }
  },

  // These commands manage copying and pasting from the clipboard in the HUD frame without
  // disrupting focus in the page.
  async copyToClipboard(text) {
    await DomUtils.documentComplete();
    await this.init();
    this.hudUI.postMessage({ name: "copyToClipboard", data: text });
  },

  async pasteFromClipboard(pasteListener) {
    this.pasteListener = pasteListener;
    await DomUtils.documentComplete();
    await this.init();
    this.tween.fade(0, 0);
    this.hudUI.postMessage({ name: "pasteFromClipboard" });
  },

  pasteResponse({ data }) {
    // Hide the HUD frame again.
    this.hudUI.setIframeVisible(false);
    this.unfocusIfFocused();
    this.pasteListener(data);
  },

  unfocusIfFocused() {
    // Return keyboard focus to the page before the HUD iframe disappears.
    if (this.hudUI && this.hudUI.showing) {
      this.hudUI.iframeElement.blur();
      globalThis.focus();
    }
  },

  // Navigator.clipboard is only available in secure contexts. Show a warning when clipboard actions
  // fail on non-HTTPS sites. See #4572.
  async showClipboardUnavailableMessage() {
    await DomUtils.documentComplete();
    await this.init();
    // Since the message is long and surprising, show it for longer to allow more time to reading.
    this.show("Clipboard actions available only on HTTPS sites", 4000);
  },
};

class Tween {
  constructor(cssSelector, insertionPoint) {
    this.opacity = 0;
    this.intervalId = -1;
    this.styleElement = null;
    this.cssSelector = cssSelector;
    if (insertionPoint == null) insertionPoint = document.documentElement;
    this.styleElement = DomUtils.createElement("style");

    if (!this.styleElement.style) {
      // We're in an XML document, so we shouldn't inject any elements. See the comment in
      // UIComponent.
      Tween.prototype.fade = Tween.prototype.stop = Tween.prototype.updateStyle = function () {};
      return;
    }

    this.styleElement.type = "text/css";
    this.styleElement.innerHTML = "";
    insertionPoint.appendChild(this.styleElement);
  }

  fade(toAlpha, duration, onComplete) {
    clearInterval(this.intervalId);
    const startTime = (new Date()).getTime();
    const fromAlpha = this.opacity;
    const alphaStep = toAlpha - fromAlpha;

    const performStep = () => {
      const elapsed = (new Date()).getTime() - startTime;
      if (elapsed >= duration) {
        clearInterval(this.intervalId);
        this.updateStyle(toAlpha);
        if (onComplete) {
          onComplete();
        }
      } else {
        const value = ((elapsed / duration) * alphaStep) + fromAlpha;
        this.updateStyle(value);
      }
    };

    this.updateStyle(this.opacity);
    this.intervalId = setInterval(performStep, 50);
  }

  stop() {
    clearInterval(this.intervalId);
  }

  updateStyle(opacity) {
    this.opacity = opacity;
    this.styleElement.innerHTML = `\
${this.cssSelector} {
  opacity: ${this.opacity};
}\
`;
  }
}

globalThis.HUD = HUD;
