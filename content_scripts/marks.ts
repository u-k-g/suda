// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
const Marks = {
  previousPositionRegisters: ["`", "'"],
  localRegisters: {},
  currentRegistryEntry: null,
  mode: null,
  jumpHighlightElements: [],
  jumpHighlightGeneration: 0,

  clearJumpHighlight() {
    this.jumpHighlightGeneration += 1;
    for (const element of this.jumpHighlightElements) element.remove();
    this.jumpHighlightElements = [];
  },

  showJumpHighlight(keyChar) {
    this.clearJumpHighlight();

    const viewportX = Math.max(0, Math.floor(globalThis.innerWidth / 2));
    const viewportY = Math.max(0, Math.floor(globalThis.innerHeight / 2));
    const elementsAtPoint = document.elementsFromPoint?.(viewportX, viewportY) ??
      [document.elementFromPoint?.(viewportX, viewportY)];
    const target = elementsAtPoint.find((element) =>
      element &&
      element !== document.documentElement &&
      element !== document.body &&
      !element.closest?.(".vimium-reset, iframe.vomnibar-frame, iframe.vimium-hud-frame")
    );

    let rects = target == null
      ? []
      : Array.from(target.getClientRects()).filter((rect) =>
        rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 &&
        rect.left < globalThis.innerWidth && rect.top < globalThis.innerHeight
      );

    // A page can return a full-viewport wrapper at the center point. A compact locator is more
    // useful than outlining the entire screen in that case.
    if (
      rects.length === 0 ||
      rects.every((rect) =>
        rect.width >= globalThis.innerWidth * 0.9 &&
        rect.height >= globalThis.innerHeight * 0.9
      )
    ) {
      rects = [{
        left: viewportX - 36,
        top: viewportY - 24,
        width: 72,
        height: 48,
      }];
    }

    const { top: viewportTop, left: viewportLeft } = DomUtils.getViewportTopLeft();
    this.jumpHighlightElements = rects.map((rect) => {
      const highlight = DomUtils.addFlashRect({
        left: rect.left + viewportLeft,
        top: rect.top + viewportTop,
        width: rect.width,
        height: rect.height,
      });
      highlight.classList.add("vimium-mark-jump-flash");
      highlight.dataset.vimiumMark = keyChar;
      return highlight;
    });
    const generation = this.jumpHighlightGeneration;
    Utils.setTimeout(1100, () => {
      if (this.jumpHighlightGeneration === generation) this.clearJumpHighlight();
    });
    return this.jumpHighlightElements;
  },

  scheduleJumpHighlight(keyChar) {
    requestAnimationFrame(() => requestAnimationFrame(() => this.showJumpHighlight(keyChar)));
  },

  exit(continuation = null) {
    if (this.mode != null) {
      this.mode.exit();
    }
    this.mode = null;
    if (continuation) {
      return continuation(); // TODO(philc): Is this return necessary?
    }
  },

  // This returns the key which is used for storing mark locations in localStorage.
  getLocationKey(keyChar) {
    return `vimiumMark|${globalThis.location.href.split("#")[0]}|${keyChar}`;
  },

  getMarkString() {
    return JSON.stringify({
      scrollX: globalThis.scrollX,
      scrollY: globalThis.scrollY,
      hash: globalThis.location.hash,
    });
  },

  setPreviousPosition() {
    const markString = this.getMarkString();
    for (const reg of this.previousPositionRegisters) {
      this.localRegisters[reg] = markString;
    }
  },

  showMessage(message, keyChar) {
    HUD.show(`${message} \"${keyChar}\".`, 1000);
  },

  // If <Shift> is depressed, then it's a global mark, otherwise it's a local mark. This is
  // consistent vim's [A-Z] for global marks and [a-z] for local marks. However, it also admits
  // other non-Latin characters. The exceptions are "`" and "'", which are always considered local
  // marks. The "swap" command option inverts global and local marks.
  isGlobalMark(event, keyChar) {
    let shiftKey = event.shiftKey;
    if (this.currentRegistryEntry?.options.swap) {
      shiftKey = !shiftKey;
    }
    return shiftKey && !this.previousPositionRegisters.includes(keyChar);
  },

  createMark(keyChar, shiftKey = false) {
    if (this.isGlobalMark({ shiftKey }, keyChar)) {
      // We record the current scroll position, but only if this is the top frame within the tab.
      // Otherwise, the background page fetches it from the top frame.
      let scrollX, scrollY;
      if (DomUtils.isTopFrame()) {
        [scrollX, scrollY] = [globalThis.scrollX, globalThis.scrollY];
      }
      chrome.runtime.sendMessage({
        handler: "createMark",
        markName: keyChar,
        scrollX,
        scrollY,
      }, () => this.showMessage("Created global mark", keyChar));
    } else {
      localStorage[this.getLocationKey(keyChar)] = this.getMarkString();
      this.showMessage("Created local mark", keyChar);
    }
  },

  gotoMark(keyChar, shiftKey = false) {
    if (this.isGlobalMark({ shiftKey }, keyChar)) {
      const key = `vimiumGlobalMark|${keyChar}`;
      chrome.storage.local.get(key, function (items) {
        if (key in items) {
          chrome.runtime.sendMessage({ handler: "gotoMark", markName: keyChar });
          HUD.show(`Jumped to global mark '${keyChar}'`, 1000);
        } else {
          HUD.show(`Global mark not set '${keyChar}'`, 1000);
        }
      });
    } else {
      const markString = this.localRegisters[keyChar] != null
        ? this.localRegisters[keyChar]
        : localStorage[this.getLocationKey(keyChar)];
      if (markString != null) {
        this.setPreviousPosition();
        const position = JSON.parse(markString);
        if (position.hash && (position.scrollX === 0) && (position.scrollY === 0)) {
          globalThis.location.hash = position.hash;
        } else {
          globalThis.scrollTo(position.scrollX, position.scrollY);
        }
        this.scheduleJumpHighlight(keyChar);
        this.showMessage("Jumped to local mark", keyChar);
      } else {
        this.showMessage("Local mark not set", keyChar);
      }
    }
  },

  async getMarksForCurrentPage() {
    const baseUrl = globalThis.location.href.split("#")[0];
    const localPrefix = `vimiumMark|${baseUrl}|`;
    const marks = [];

    for (let index = 0; index < localStorage.length; index++) {
      const storageKey = localStorage.key(index);
      if (storageKey?.startsWith(localPrefix)) {
        marks.push({ key: storageKey.slice(localPrefix.length), scope: "local" });
      }
    }
    for (const key of Object.keys(this.localRegisters)) {
      if (!marks.some((mark) => mark.key === key && mark.scope === "local")) {
        marks.push({ key, scope: "local" });
      }
    }

    const storedMarks = await chrome.storage.local.get(null);
    for (const [storageKey, mark] of Object.entries(storedMarks)) {
      if (storageKey.startsWith("vimiumGlobalMark|") && mark?.url === baseUrl) {
        marks.push({ key: storageKey.slice("vimiumGlobalMark|".length), scope: "global" });
      }
    }

    return marks.sort((a, b) => a.key.localeCompare(b.key) || a.scope.localeCompare(b.scope));
  },

  activateCreateMode(_count, { registryEntry }) {
    this.currentRegistryEntry = registryEntry;
    this.mode = new Mode();
    this.mode.init({
      name: "create-mark",
      indicator: "Create mark...",
      exitOnEscape: true,
      suppressAllKeyboardEvents: true,
      keydown: (event) => {
        if (KeyboardUtils.isPrintable(event)) {
          const keyChar = KeyboardUtils.getKeyChar(event);
          this.exit(() => {
            this.createMark(keyChar, event.shiftKey);
          });
          return handlerStack.suppressEvent;
        }
      },
    });
  },

  activateGotoMode(_count, { registryEntry }) {
    this.currentRegistryEntry = registryEntry;
    this.mode = new Mode();
    this.mode.init({
      name: "goto-mark",
      indicator: "Go to mark...",
      exitOnEscape: true,
      suppressAllKeyboardEvents: true,
      keydown: (event) => {
        if (KeyboardUtils.isPrintable(event)) {
          this.exit(() => {
            const keyChar = KeyboardUtils.getKeyChar(event);
            this.gotoMark(keyChar, event.shiftKey);
          });
          return handlerStack.suppressEvent;
        }
      },
    });
  },
};

globalThis.Marks = Marks;
