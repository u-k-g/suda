// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
// NOTE(smblott). Ultimately, all of the FindMode-related code should be moved here.

// This prevents unmapped printable characters from being passed through to underlying page; see
// #1415. Only used by PostFindMode, below.
class SuppressPrintable extends Mode {
  constructor(options) {
    super();
    super.init(options);
    const handler = (event) =>
      KeyboardUtils.isPrintable(event) ? this.suppressEvent : this.continueBubbling;
    const initialType = globalThis.getSelection().type;

    // We use unshift here, so we see events after normal mode, so we only see unmapped keys.
    this.unshift({
      _name: `mode-${this.id}/suppress-printable`,
      keydown: handler,
      keypress: handler,
      keyup: () => {
        // If the selection type has changed (usually, no longer "Range"), then the user is
        // interacting with the input element, so we get out of the way. See discussion of option 5c
        // from #1415.
        if (globalThis.getSelection().type !== initialType) {
          return this.exit();
        }
      },
    });
  }
}

// When we use find, the selection/focus can land in a focusable/editable element. In this
// situation, special considerations apply. We implement three special cases:
//   1. Disable insert mode, because the user hasn't asked to enter insert mode. We do this by using
//      InsertMode.suppressEvent.
//   2. Prevent unmapped printable keyboard events from propagating to the page; see #1415. We do
//      this by inheriting from SuppressPrintable.
//   3. If the very-next keystroke is Escape, then drop immediately into insert mode.
//
const newPostFindMode = function () {
  if (!document.activeElement || !DomUtils.isEditable(document.activeElement)) {
    return;
  }
  return new PostFindMode();
};

class PostFindMode extends SuppressPrintable {
  constructor() {
    const element = document.activeElement;
    super({
      name: "post-find",
      // PostFindMode shares a singleton with focusInput; each displaces the other.
      singleton: "post-find-mode/focus-input",
      exitOnBlur: element,
      exitOnClick: true,
      // Always truthy, so always continues bubbling.
      keydown(event) {
        return InsertMode.suppressEvent(event);
      },
      keypress(event) {
        return InsertMode.suppressEvent(event);
      },
      keyup(event) {
        return InsertMode.suppressEvent(event);
      },
    });

    // If the very-next keydown is Escape, then exit immediately, thereby passing subsequent keys to
    // the underlying insert-mode instance.
    this.push({
      _name: `mode-${this.id}/handle-escape`,
      keydown: (event) => {
        if (KeyboardUtils.isEscape(event)) {
          this.exit();
          return this.suppressEvent;
        } else {
          handlerStack.remove();
          return this.continueBubbling;
        }
      },
    });
  }
}

class FindMode extends Mode {
  constructor(options) {
    super();

    if (options == null) {
      options = {};
    }

    // TODO(philc): I don't think this.query is ever used/accessed, because it's only accessed from
    // static methods. Consider splitting the static portions of this class into a separate class
    // called FindModeSingleton. Blending the two together is confusing.
    this.query = {
      rawQuery: "",
      parsedQuery: "",
      matchCount: 0,
      hasResults: false,
    };

    // Save the selection, so findInPlace can restore it.
    this.initialRange = getCurrentRange();
    FindMode.query = { rawQuery: "" };

    if (options.returnToViewport) {
      this.scrollX = globalThis.scrollX;
      this.scrollY = globalThis.scrollY;
    }

    super.init(Object.assign(options, {
      name: "find",
      indicator: false,
      exitOnClick: true,
      exitOnEscape: true,
      // This prevents further Suda commands launching before the find-mode HUD receives the
      // focus. E.g. "/" followed quickly by "i" should not leave us in insert mode.
      suppressAllKeyboardEvents: true,
    }));

    if (!options.commandBar) {
      HUD.showFindMode(this);
    }
  }

  exit(event) {
    if (!this.options.commandBar) {
      HUD.unfocusIfFocused();
    }
    super.exit();
    if (event) {
      FindMode.handleEscape();
    }
  }

  restoreSelection() {
    if (!this.initialRange) {
      return;
    }
    const range = this.initialRange;
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  findInPlace(query, options) {
    // If requested, restore the scroll position (so that failed searches leave the scroll position
    // unchanged).
    this.checkReturnToViewPort();
    // Restore the selection. That way, we're always searching forward from the same place, so we
    // find the right match as the user adds matching characters, or removes previously-matched
    // characters. See #1434.
    this.restoreSelection();
    FindMode.updateQuery(query);
    query = FindMode.query.isRegex
      ? FindMode.getQueryFromRegexMatches()
      : FindMode.query.parsedQuery;
    FindMode.query.hasResults = FindMode.execute(query, options);
  }

  static updateQuery(query) {
    let pattern;
    if (!this.query) {
      this.query = {};
    }
    this.query.rawQuery = query;
    // the query can be treated differently (e.g. as a plain string versus regex) depending on the
    // presence of escape sequences. '\' is the escape character and needs to be escaped itself to
    // be used as a normal character. here we grep for the relevant escape sequences.
    this.query.isRegex = Settings.get("regexFindMode");
    this.query.parsedQuery = this.query.rawQuery.replace(
      /(\\{1,2})([rRI]?)/g,
      (match, slashes, flag) => {
        if ((flag === "") || (slashes.length !== 1)) {
          return match;
        }

        switch (flag) {
          case "r":
            this.query.isRegex = true;
            break;
          case "R":
            this.query.isRegex = false;
            break;
        }
        return "";
      },
    );

    // Implement smartcase.
    this.query.ignoreCase = !Utils.hasUpperCase(this.query.parsedQuery);

    // Plain find treats a run of whitespace like the browser's native finder does. Besides being
    // more forgiving, this lets a query cross a <br> or a block boundary.
    const regexPattern = this.query.isRegex
      ? this.query.parsedQuery
      : Utils.escapeRegexSpecialCharacters(this.query.parsedQuery).replace(/\s+/g, "\\s+");

    // Grep the page as one text stream. Searching each text node separately makes ordinary phrases
    // fail whenever a page wraps part of the phrase in an inline element.
    try {
      pattern = new RegExp(regexPattern, `g${this.query.ignoreCase ? "i" : ""}`);
    } catch {
      // If we catch a SyntaxError, assume the user is not done typing yet and return quietly.
      return this.clearMatches();
    }

    if (!this.query.parsedQuery) {
      return this.clearMatches(pattern);
    }

    const searchableText = getSearchableText();
    const matches = getSearchMatches(searchableText, pattern);
    this.query.matches = matches;
    // Keep these fields populated for callers which inspect FindMode.query.
    this.query.regexMatches = matches.map((match) => [match.text]);
    this.query.regexPattern = pattern;
    this.query.regexMatchedNodes = matches.map((match) => match.startNode);
    this.updateActiveRegexIndices();

    return this.query.matchCount = matches.length;
  }

  static clearMatches(pattern = null) {
    this.query.matches = [];
    this.query.regexMatches = [];
    this.query.regexPattern = pattern;
    this.query.regexMatchedNodes = [];
    this.query.activeMatchIndex = 0;
    this.query.activeRegexIndices = [0, 0];
    return this.query.matchCount = 0;
  }

  // Set the active match near the latest selection.
  static updateActiveRegexIndices() {
    let activeMatchIndex = -1;
    const matches = this.query.matches;
    const selection = globalThis.getSelection();
    if (selection.rangeCount > 0 && matches.length > 0) {
      const selectionRange = selection.getRangeAt(0);
      activeMatchIndex = matches.findIndex((match) => {
        if (
          selectionRange.startContainer === match.startNode &&
          selectionRange.startOffset >= match.startOffset &&
          (match.startNode !== match.endNode || selectionRange.startOffset < match.endOffset)
        ) {
          return true;
        }

        const matchRange = document.createRange();
        matchRange.setStart(match.startNode, match.startOffset);
        return selectionRange.compareBoundaryPoints(Range.START_TO_START, matchRange) <= 0;
      });
    }
    this.query.activeMatchIndex = Math.max(activeMatchIndex, 0);
    this.query.activeRegexIndices = [this.query.activeMatchIndex, 0];
  }

  static getQueryFromRegexMatches() {
    // find()ing an empty query always returns false
    if (!this.query.matches?.length) {
      return "";
    }
    return this.query.matches[this.query.activeMatchIndex].text;
  }

  static getNextQueryFromRegexMatches(backwards) {
    // find()ing an empty query always returns false
    if (!this.query.matches?.length) {
      return "";
    }
    const stepSize = backwards ? -1 : 1;
    const matchCount = this.query.matches.length;
    this.query.activeMatchIndex = (this.query.activeMatchIndex + stepSize + matchCount) %
      matchCount;
    this.query.activeRegexIndices = [this.query.activeMatchIndex, 0];
    return this.query.matches[this.query.activeMatchIndex].text;
  }

  // Returns null if no search has been performed yet.
  static getQuery(backwards) {
    if (!this.query) return;
    // check if the query has been changed by a script in another frame
    const mostRecentQuery = FindModeHistory.getQuery();
    if (mostRecentQuery !== this.query.rawQuery) {
      this.updateQuery(mostRecentQuery);
    }

    return this.getNextQueryFromRegexMatches(backwards);
  }

  static saveQuery() {
    FindModeHistory.saveQuery(this.query.rawQuery);
  }

  // :options is an optional dict. valid parameters are 'caseSensitive' and 'backwards'.
  static execute(query, options) {
    let result = null;
    options = Object.assign({
      backwards: false,
      caseSensitive: !this.query.ignoreCase,
      colorSelection: true,
    }, options);
    if (query == null) {
      query = FindMode.getQuery(options.backwards);
    }

    if (options.colorSelection) {
      document.body.classList.add("suda-find-mode");
      // ignore the selectionchange event generated by find()
      document.removeEventListener("selectionchange", this.restoreDefaultSelectionHighlight, true);
    }

    if (query && this.query.matches?.length) {
      result = highlight(this.query.matches[this.query.activeMatchIndex]);
    }

    // window.find focuses the |window| that it is called on. This gives us an opportunity to
    // (re-)focus another element/window, if that isn't the behaviour we want.
    if (options.postFindFocus != null) {
      options.postFindFocus.focus();
    }

    if (options.colorSelection) {
      setTimeout(
        () =>
          document.addEventListener("selectionchange", this.restoreDefaultSelectionHighlight, true),
        0,
      );
    }

    // We are either in normal mode ("n"), or find mode ("/"). We are not in insert mode.
    // Nevertheless, if a previous find landed in an editable element, then that element may still
    // be activated. In this case, we don't want to leave it behind (see #1412).
    if (document.activeElement && DomUtils.isEditable(document.activeElement)) {
      if (!DomUtils.isSelected(document.activeElement)) {
        document.activeElement.blur();
      }
    }

    return result;
  }

  // The user has found what they're looking for and is finished searching. We enter insert mode, if
  // possible.
  static handleEscape() {
    document.body.classList.remove("suda-find-mode");
    // Removing the class does not re-color existing selections. we recreate the current selection
    // so it reverts back to the default color.
    const selection = globalThis.getSelection();
    if (!selection.isCollapsed) {
      const range = globalThis.getSelection().getRangeAt(0);
      globalThis.getSelection().removeAllRanges();
      globalThis.getSelection().addRange(range);
    }
    return focusFoundLink() || selectFoundInputElement();
  }

  // Save the query so the user can do further searches with it.
  static handleEnter() {
    focusFoundLink();
    document.body.classList.add("suda-find-mode");
    return FindMode.saveQuery();
  }

  static findNext(backwards, options = {}) {
    // Bail out if we don't have any query text.
    const nextQuery = FindMode.getQuery(backwards);
    if (!nextQuery) {
      HUD.show("No query to find.", 1000);
      return;
    }

    Marks.setPreviousPosition();
    FindMode.query.hasResults = FindMode.execute(nextQuery, {
      backwards,
      postFindFocus: options.postFindFocus,
    });

    if (FindMode.query.hasResults) {
      if (options.postFindFocus) {
        options.postFindFocus.focus();
        return;
      }
      focusFoundLink();
      return newPostFindMode();
    } else {
      return HUD.show(`No matches for '${FindMode.query.rawQuery}'`, 1000);
    }
  }

  checkReturnToViewPort() {
    if (this.options.returnToViewport) {
      globalThis.scrollTo(this.scrollX, this.scrollY);
    }
  }
}

FindMode.restoreDefaultSelectionHighlight = forTrusted(() =>
  document.body.classList.remove("suda-find-mode")
);

const getCurrentRange = function () {
  const selection = getSelection();
  if (selection.type === "None") {
    const range = document.createRange();
    range.setStart(document.body, 0);
    range.setEnd(document.body, 0);
    return range;
  }

  if (selection.type === "Range") {
    selection.collapseToStart();
  }

  return selection.getRangeAt(0);
};

const getLinkFromSelection = function () {
  let node = globalThis.getSelection().anchorNode;
  while (node && (node !== document.body)) {
    if (node.nodeName.toLowerCase() === "a") {
      return node;
    }
    node = node.parentNode;
  }
  return null;
};

const focusFoundLink = function () {
  if (FindMode.query.hasResults) {
    const link = getLinkFromSelection();
    if (link) {
      link.focus();
    }
  }
};

const selectFoundInputElement = function () {
  // Since the last focused element might not be the one currently pointed to by find (e.g. the
  // current one might be disabled and therefore unable to receive focus), we use the approximate
  // heuristic of checking that the last anchor node is an ancestor of our element.
  const findModeAnchorNode = document.getSelection().anchorNode;
  if (
    FindMode.query.hasResults && document.activeElement &&
    DomUtils.isSelectable(document.activeElement) &&
    DomUtils.isDOMDescendant(findModeAnchorNode, document.activeElement)
  ) {
    return DomUtils.simulateSelect(document.activeElement);
  }
};

// Highlights a match, including matches which cross inline-element boundaries.
const highlight = (match) => {
  const selection = globalThis.getSelection();
  const range = document.createRange();
  range.setStart(match.startNode, match.startOffset);
  range.setEnd(match.endNode, match.endOffset);
  selection.removeAllRanges();
  selection.addRange(range);

  // Ensure the highlighted element is visible within the viewport.
  const rect = range.getBoundingClientRect();
  if (rect.top < 0 || rect.bottom > globalThis.innerHeight) {
    const screenHeight = globalThis.innerHeight;
    globalThis.scrollTo({
      top: globalThis.scrollY + rect.top + rect.height / 2 - screenHeight / 2,
      // Scroll instantly when we find a search result, matching Chrome's native search UI.
      behavior: "instant",
    });
  }

  return true;
};

const blockElements = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DD",
  "DIV",
  "DL",
  "DT",
  "FIELDSET",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
  "UL",
]);
const ignoredFindElements = new Set(["NOSCRIPT", "SCRIPT", "STYLE", "TEMPLATE"]);

// Flatten visible page text while retaining each text node's position in the combined stream.
const getSearchableText = () => {
  const chunks = [];
  const segments = [];
  let length = 0;

  const appendBoundary = () => {
    const lastChunk = chunks.at(-1);
    if (lastChunk && !/\s$/.test(lastChunk)) {
      chunks.push("\n");
      length++;
    }
  };

  function visit(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.length > 0) {
        const start = length;
        chunks.push(node.textContent);
        length += node.textContent.length;
        segments.push({ node, start, end: length });
      }
    } else if (
      node.nodeType === Node.ELEMENT_NODE &&
      !ignoredFindElements.has(node.tagName) &&
      (node.checkVisibility() || node.style.display === "contents")
    ) {
      if (node.tagName === "BR") return appendBoundary();
      const isBlock = blockElements.has(node.tagName);
      if (isBlock) appendBoundary();
      for (const child of node.childNodes) visit(child);
      if (isBlock) appendBoundary();
    }
  }

  visit(document.body);
  return { text: chunks.join(""), segments };
};

const getSearchMatches = ({ text, segments }, pattern) => {
  const matches = [];
  let result;
  pattern.lastIndex = 0;

  const firstSegmentAfter = (offset) => {
    let low = 0;
    let high = segments.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (segments[middle].end <= offset) low = middle + 1;
      else high = middle;
    }
    return segments[low];
  };

  const lastSegmentBefore = (offset) => {
    let low = 0;
    let high = segments.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (segments[middle].start < offset) low = middle + 1;
      else high = middle;
    }
    return segments[low - 1];
  };

  while ((result = pattern.exec(text)) !== null) {
    // Empty regular-expression matches cannot be highlighted or advanced through safely.
    if (!result[0]) break;

    const start = result.index;
    const end = start + result[0].length;
    const first = firstSegmentAfter(start);
    const last = lastSegmentBefore(end);
    if (!first || !last || first.start >= end || last.end <= start) continue;

    matches.push({
      text: result[0],
      startNode: first.node,
      startOffset: Math.max(start, first.start) - first.start,
      endNode: last.node,
      endOffset: Math.min(end, last.end) - last.start,
    });
  }

  return matches;
};

globalThis.PostFindMode = PostFindMode;
globalThis.FindMode = FindMode;
