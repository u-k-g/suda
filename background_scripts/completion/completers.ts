// This file contains the definition of the completers used for the CommandBar's suggestion UI. A
// completer will take a query (whatever the user typed into the CommandBar) and return a list of
// Suggestions, e.g. bookmarks, domains, URLs from history.
//
// The CommandBar frontend script makes a "filterCompleter" request to the background page, which in
// turn calls filter() on each these completers.
//
// A completer is a class which has three functions:
//  - filter(query): "query" will be whatever the user typed into the CommandBar.
//  - refresh(): (optional) refreshes the completer's data source (e.g. refetches the list of
//    bookmarks).
//  - cancel(): (optional) cancels any pending, cancelable action.

import * as completionSearch from "./search_wrapper.js";
import * as userSearchEngines from "../user_search_engines.js";
import * as ranking from "./ranking.js";
import { allCommands } from "../all_commands.js";
import { Commands, RegistryEntry } from "../commands.js";
import { RegexpCache } from "./ranking.js";

// Set this to true to render relevancy when debugging the ranking scores.
const showRelevancy = false;

// TODO(philc): Consider moving out the "computeRelevancy" function.
export class Suggestion {
  static stripPatterns;
  kind;
  queryTerms;
  description;
  url;
  // A shortened URL (URI-decoded, protocol removed) suitable for dispaly purposes.
  shortUrl;
  title = "";
  // A computed relevancy value.
  relevancy;
  relevancyFunction;
  relevancyData;
  // When true, then this suggestion is automatically pre-selected in the commandBar. This only affects
  // the suggestion in slot 0 in the commandBar.
  autoSelect = false;
  // When true, we highlight matched terms in the title and URL. Otherwise we don't.
  highlightTerms = true;

  // The text to insert into the commandBar input when this suggestion is selected.
  insertText;
  // This controls whether this suggestion is a candidate for deduplication after simplifying
  // its URL.
  deDuplicate = true;
  // The tab represented by this suggestion. Populated by TabCompleter.
  tabId;
  // Whether this is a suggestion provided by a user's custom search engine.
  isCustomSearch;
  // Set by CommandCompleter.
  // { registryEntry: RegistryEntry, keys: Array[string] }
  command;
  // Whether this is meant to be the first suggestion from the user's custom search engine which
  // represents their query as typed, verbatim.
  isPrimarySuggestion = false;
  searchUrl;

  constructor(options) {
    this.kind = options.kind ?? options.description;
    this.queryTerms = options.queryTerms ?? [];
    Object.seal(this);
    Object.assign(this, options);
  }

  // Returns the relevancy score.
  computeRelevancy() {
    // We assume that, once the relevancy has been set, it won't change. Completers must set
    // either @relevancy or @relevancyFunction.
    if (this.relevancy == null) {
      this.relevancy = this.relevancyFunction(this);
    }
    return this.relevancy;
  }

  toCompletion() {
    const kind = this.command ? "command" : this.isCustomSearch ? "custom-search" : this.kind;
    const title = this.insertText && this.isCustomSearch ? this.insertText : this.title;
    const displayUrl = this.url ? this.shortenUrl() : "";
    return {
      kind,
      source: this.description,
      title,
      titleMatches: this.matchingRanges(title),
      url: this.url,
      displayUrl,
      urlMatches: this.matchingRanges(displayUrl),
      insertText: this.insertText,
      autoSelect: this.autoSelect,
      tabId: this.tabId,
      command: this.command,
      searchUrl: this.searchUrl,
      isCustomSearch: this.isCustomSearch,
      isPrimarySuggestion: this.isPrimarySuggestion,
      relevancy: showRelevancy ? this.computeRelevancy() : undefined,
    };
  }

  // Use neat trick to snatch a domain (http://stackoverflow.com/a/8498668).
  getUrlRoot(url) {
    const a = document.createElement("a");
    a.href = url;
    return a.protocol + "//" + a.hostname;
  }

  getHostname(url) {
    const a = document.createElement("a");
    a.href = url;
    return a.hostname;
  }

  stripTrailingSlash(url) {
    if (url[url.length - 1] === "/") {
      url = url.substring(url, url.length - 1);
    }
    return url;
  }

  // Push the ranges within `string` which match `term` onto `ranges`.
  pushMatchingRanges(string, term, ranges) {
    let textPosition = 0;
    // Split `string` into a (flat) list of pairs:
    //   - for i=0,2,4,6,...
    //     - splits[i] is unmatched text
    //     - splits[i+1] is the following matched text (matching `term`)
    //       (except for the final element, for which there is no following matched text).
    // Example:
    //   - string = "Abacab"
    //   - term = "a"
    //   - splits = [ "", "A",    "b", "a",    "c", "a",    b" ]
    //                UM   M       UM   M       UM   M      UM      (M=Matched, UM=Unmatched)
    const splits = string.split(RegexpCache.get(term, "(", ")"));
    for (let index = 0, end = splits.length - 2; index <= end; index += 2) {
      const unmatchedText = splits[index];
      const matchedText = splits[index + 1];
      // Add the indices spanning `matchedText` to `ranges`.
      textPosition += unmatchedText.length;
      ranges.push([textPosition, textPosition + matchedText.length]);
      textPosition += matchedText.length;
    }
  }

  matchingRanges(string) {
    if (!this.highlightTerms || !string) return [];
    let ranges = [];
    for (const term of this.queryTerms) {
      this.pushMatchingRanges(string, term, ranges);
    }
    return ranges.length === 0 ? [] : this.mergeRanges(ranges.sort((a, b) => a[0] - b[0]));
  }

  // Merges the given list of ranges such that any overlapping regions are combined. E.g.
  //   mergeRanges([0, 4], [3, 6]) => [0, 6]. A range is [startIndex, endIndex].
  mergeRanges(ranges) {
    let previous = ranges.shift();
    const mergedRanges = [previous];
    for (const range of ranges) {
      if (previous[1] >= range[0]) {
        previous[1] = Math.max(range[1], previous[1]);
      } else {
        mergedRanges.push(range);
        previous = range;
      }
    }
    return mergedRanges;
  }

  // Simplify a suggestion's URL (by removing those parts which aren't useful for display or
  // comparison).
  shortenUrl() {
    if (this.shortUrl != null) {
      return this.shortUrl;
    }
    // We get easier-to-read shortened URLs if we URI-decode them.
    let url = (Utils.decodeURIByParts(this.url) || this.url).toLowerCase();
    for (const [filter, replacements] of Suggestion.stripPatterns) {
      if (new RegExp(filter).test(url)) {
        for (const replace of replacements) {
          url = url.replace(replace, "");
        }
      }
    }

    this.shortUrl = url;
    return this.shortUrl;
  }

  // Boost a relevancy score by a factor (in the range (0,1.0)), while keeping the score in the
  // range [0,1]. This makes greater adjustments to scores near the middle of the range (so, very
  // poor relevancy scores remain very poor).
  static boostRelevancyScore(factor, score) {
    return score + (score < 0.5 ? score * factor : (1.0 - score) * factor);
  }
}

// Patterns to strip from URLs; of the form [ [ filter, replacements ], [ filter, replacements ], ... ]
//   - filter is a regexp string; a URL must match this regexp first.
//   - replacements (itself a list) is a list of regexp objects, each of which is removed from URLs
//     matching the filter.
//
// Note. This includes site-specific patterns for very-popular sites with URLs which don't work well
// in the commandBar.
//
Suggestion.stripPatterns = [
  // Google search specific replacements; this replaces query parameters which are known to not be
  // helpful. There's some additional information here:
  // http://www.teknoids.net/content/google-search-parameters-2012
  [
    "^https?://www\\.google\\.(com|ca|com\\.au|co\\.uk|ie)/.*[&?]q=",
    "ei gws_rd url ved usg sa usg sig2 bih biw cd aqs ie sourceid es_sm"
      .split(/\s+/).map((param) => new RegExp(`\&${param}=[^&]+`)),
  ],

  // On Google maps, we get a new history entry for every pan and zoom event.
  ["^https?://www\\.google\\.(com|ca|com\\.au|co\\.uk|ie)/maps/place/.*/@", [new RegExp("/@.*")]],

  // General replacements; replaces leading and trailing fluff.
  [".", ["^https?://", "\\W+$"].map((re) => new RegExp(re))],
];

const folderSeparator = "/";

// this.bookmarks are loaded asynchronously when refresh() is called.
export class BookmarkCompleter {
  bookmarks;
  bookmarksTreePromise;
  async filter({ queryTerms, showAllOnEmpty = false }) {
    if (!this.bookmarks) await this.refresh();

    // If the folder separator character is the first character in any query term, then use the
    // bookmark's full path as its title. Otherwise, just use the its regular title.
    let results;
    const usePathAndTitle = queryTerms.reduce(
      (prev, term) => prev || term.startsWith(folderSeparator),
      false,
    );
    if (queryTerms.length > 0) {
      results = this.bookmarks.filter((bookmark) => {
        const suggestionTitle = usePathAndTitle ? bookmark.pathAndTitle : bookmark.title;
        if (bookmark.hasJavascriptProtocol == null) {
          bookmark.hasJavascriptProtocol = UrlUtils.hasJavascriptProtocol(bookmark.url);
        }
        if (bookmark.hasJavascriptProtocol && bookmark.shortUrl == null) {
          bookmark.shortUrl = "javascript:...";
        }
        const suggestionUrl = bookmark.shortUrl != null ? bookmark.shortUrl : bookmark.url;
        return ranking.matches(queryTerms, suggestionUrl, suggestionTitle);
      });
    } else {
      results = showAllOnEmpty ? this.bookmarks : [];
    }
    const suggestions = results.map((bookmark) => {
      return new Suggestion({
        queryTerms,
        description: "bookmark",
        url: bookmark.url,
        title: usePathAndTitle ? bookmark.pathAndTitle : bookmark.title,
        relevancyFunction: this.computeRelevancy,
        shortUrl: bookmark.shortUrl,
        deDuplicate: bookmark.shortUrl == null,
      });
    });
    return suggestions;
  }

  async refresh() {
    // In case refresh() is called multiple times before chrome.bookmarks.getTree() completes, only
    // call chrome.bookmarks.getTree() once.
    if (this.bookmarksTreePromise) {
      await this.bookmarksTreePromise;
      return;
    }

    this.bookmarksTreePromise = chrome.bookmarks.getTree();
    const bookmarksTree = await this.bookmarksTreePromise;
    this.bookmarks = this.traverseBookmarks(bookmarksTree)
      .filter((b) => b.url != null);
    this.bookmarksTreePromise = null;
  }

  // Traverses the bookmark hierarchy, and returns a flattened list of all bookmarks.
  traverseBookmarks(bookmarks) {
    const results = [];
    for (const folder of bookmarks) {
      this.traverseBookmarksRecursive(folder, results);
    }
    return results;
  }

  // Recursive helper for `traverseBookmarks`.
  traverseBookmarksRecursive(bookmark, results, parent = null, omitTitle = false) {
    if (parent == null) {
      parent = { pathAndTitle: "" };
    }
    // Chrome's root has no title; its children are localized browser containers (bookmarks bar,
    // mobile, and other bookmarks). Omit them structurally rather than matching English names.
    if (bookmark.title && !omitTitle) {
      bookmark.pathAndTitle = parent.pathAndTitle + folderSeparator + bookmark.title;
    } else {
      bookmark.pathAndTitle = parent.pathAndTitle;
    }
    results.push(bookmark);
    if (bookmark.children) {
      const childrenAreBrowserContainers = parent == null && !bookmark.title;
      for (const child of bookmark.children) {
        this.traverseBookmarksRecursive(child, results, bookmark, childrenAreBrowserContainers);
      }
    }
  }

  computeRelevancy(suggestion) {
    return ranking.wordRelevancy(
      suggestion.queryTerms,
      suggestion.shortUrl || suggestion.url,
      suggestion.title,
    );
  }
}

export class CommandCompleter {
  async filter({ queryTerms }) {
    // Get the key mapping for a command.
    // Each entry contains the user-specified options and an array of possible mappings.
    // Example:
    // "closeTabsOnRight" : {
    //    "count=2": ["c2l", "c2k"],
    //    "count=3": ["c3l", "c3k"],
    // }
    const commandToOptionsToKeys =
      (await chrome.storage.session.get("commandToOptionsToKeys")).commandToOptionsToKeys;

    // Create a RegistryEntry for the default action (no options specified) of a command.
    const createUnboundRegistryEntry = (command) => {
      return new RegistryEntry({
        keySequence: [],
        command: command.name,
        noRepeat: command.noRepeat,
        repeatLimit: command.repeatLimit,
        background: command.background,
        topFrame: command.topFrame,
        options: {},
      });
    };

    const matchingCommands = allCommands.filter((c) => ranking.matches(queryTerms, c.desc));

    const suggestions = [];
    for (const commandInfo of matchingCommands) {
      const variations = commandToOptionsToKeys[commandInfo.name] || {};

      // Whether the default action of the command (no additional options) is bound to a key.
      const isDefaultBound = Object.keys(variations).some((option) => option.length === 0);

      // If the default action is not bound, add the entry explicitly to the suggestions.
      // This makes unbound commands accessible from the CommandBar.
      if (!isDefaultBound) {
        suggestions.push(
          new Suggestion({
            queryTerms,
            description: "command",
            title: commandInfo.desc,
            deDuplicate: false,
            command: {
              registryEntry: createUnboundRegistryEntry(commandInfo),
              keys: [],
            },
            relevancy: 1,
          }),
        );
      }

      // Add all bound/mapped command variations to the suggestions.
      for (const [options, keys] of Object.entries(variations)) {
        suggestions.push(
          new Suggestion({
            queryTerms,
            description: "command",
            title: commandInfo.desc + (options ? ` (${options})` : ""),
            deDuplicate: false,
            command: {
              registryEntry: Commands.keyToRegistryEntry[keys[0]],
              keys: keys,
            },
            relevancy: 1,
          }),
        );
      }
    }
    return suggestions;
  }
}

export class HistoryCompleter {
  // - seenTabToOpenCompletionList: true if the user has typed only <Tab>, and nothing else.
  //   We interpret this to mean that they want to see all of their history in the CommandBar, sorted
  //   by recency.
  async filter({ queryTerms, seenTabToOpenCompletionList }) {
    await HistoryCache.onLoaded();

    let results;
    if (queryTerms.length > 0) {
      results = HistoryCache.history
        .filter((entry) => ranking.matches(queryTerms, entry.url, entry.title));
    } else if (seenTabToOpenCompletionList) {
      // The user has typed <Tab> to open the entire history (sorted by recency).
      results = HistoryCache.history;
    } else {
      results = [];
    }

    const suggestions = results.map((entry) => {
      return new Suggestion({
        queryTerms,
        description: "history",
        url: entry.url,
        title: entry.title,
        relevancyFunction: this.computeRelevancy,
        relevancyData: entry,
      });
    });
    return suggestions;
  }

  computeRelevancy(suggestion) {
    const historyEntry = suggestion.relevancyData;
    const recencyScore = ranking.recencyScore(historyEntry.lastVisitTime);
    // If there are no query terms, then relevancy is based on recency alone.
    if (suggestion.queryTerms.length === 0) return recencyScore;
    const wordRelevancy = ranking.wordRelevancy(
      suggestion.queryTerms,
      suggestion.url,
      suggestion.title,
    );
    // Average out the word score and the recency. Recency has the ability to pull the score up, but
    // not down.
    return (wordRelevancy + Math.max(recencyScore, wordRelevancy)) / 2;
  }
}

// The domain completer is designed to match a single-word query which looks like it is a domain.
// This supports the user experience where they quickly type a partial domain, hit tab -> enter, and
// expect to arrive there.
export class DomainCompleter {
  // A map of domain -> { entry: <historyEntry>, referenceCount: <count> }
  // - `entry` is the most recently accessed page in the History within this domain.
  // - `referenceCount` is a count of the number of History entries within this domain.
  //    If `referenceCount` goes to zero, the domain entry can and should be deleted.
  domains;

  async filter({ queryTerms, query }) {
    const isMultiWordQuery = /\S\s/.test(query);
    if ((queryTerms.length === 0) || isMultiWordQuery) return [];
    if (!this.domains) await this.populateDomains();

    const firstTerm = queryTerms[0];
    const domains = Object.keys(this.domains || []).filter((d) => d.includes(firstTerm));
    const domainsAndScores = this.sortDomainsByRelevancy(queryTerms, domains);
    const result = new Suggestion({
      queryTerms,
      description: "domain",
      // This should be the URL or the domain, or an empty string, but not null.
      url: domainsAndScores[0]?.[0] || "",
      relevancy: 2.0,
    });
    return result.url.length > 0 ? [result] : [];
  }

  // Returns a list of domains of the form: [ [domain, relevancy], ... ]
  sortDomainsByRelevancy(queryTerms, domainCandidates) {
    const results = [];
    for (const domain of domainCandidates) {
      const recencyScore = ranking.recencyScore(this.domains[domain].entry.lastVisitTime || 0);
      const wordRelevancy = ranking.wordRelevancy(queryTerms, domain, null);
      const score = (wordRelevancy + Math.max(recencyScore, wordRelevancy)) / 2;
      results.push([domain, score]);
    }
    results.sort((a, b) => b[1] - a[1]);
    return results;
  }

  async populateDomains() {
    await HistoryCache.onLoaded();
    this.domains = {};
    for (const entry of HistoryCache.history) {
      this.onVisited(entry);
    }
    chrome.history.onVisited.addListener(this.onVisited.bind(this));
    chrome.history.onVisitRemoved.addListener(this.onVisitRemoved.bind(this));
  }

  onVisited(newPage) {
    const domain = this.parseDomainAndScheme(newPage.url);
    if (domain) {
      const slot = this.domains[domain] ||
        (this.domains[domain] = { entry: newPage, referenceCount: 0 });
      // We want each entry in our domains map to point to the most recent History entry for that
      // domain.
      if (slot.entry.lastVisitTime < newPage.lastVisitTime) {
        slot.entry = newPage;
      }
      slot.referenceCount += 1;
    }
  }

  onVisitRemoved(toRemove) {
    if (toRemove.allHistory) {
      this.domains = {};
    } else {
      for (const url of toRemove.urls) {
        const domain = this.parseDomainAndScheme(url);
        const entry = this.domains[domain];
        if (entry == null) continue;
        entry.referenceCount--;
        if (entry.referenceCount <= 0) {
          delete this.domains[domain];
        }
      }
    }
  }

  // Return something like "http://www.example.com" or false.
  parseDomainAndScheme(url) {
    if (UrlUtils.urlHasProtocol(url) && !UrlUtils.hasSpecialProtocol(url)) {
      return url.split("/", 3).join("/");
    }
  }
}

// Searches through all open tabs, matching on title and URL. With an empty query, mirror the
// current window's tab strip: preserve tab-index order and omit tabs hidden in collapsed groups.
// Once the user types, search every tab, including tabs in collapsed groups and other windows.
export class TabCompleter {
  async filter({ queryTerms }) {
    const hasQuery = queryTerms.length > 0;
    const tabs = await chrome.tabs.query(hasQuery ? {} : { currentWindow: true });
    let results = tabs.filter((tab) => ranking.matches(queryTerms, tab.url, tab.title));

    if (!hasQuery) {
      const collapsedGroupIds = new Set();
      if (chrome.tabGroups?.query) {
        const collapsedGroups = await chrome.tabGroups.query({ collapsed: true });
        for (const group of collapsedGroups) collapsedGroupIds.add(group.id);
      }
      results = results
        .filter((tab) => !collapsedGroupIds.has(tab.groupId))
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    }

    const suggestions = results
      .map((tab, index) => {
        const suggestion = new Suggestion({
          queryTerms,
          description: "tab",
          url: tab.url,
          title: tab.title,
          tabId: tab.id,
          deDuplicate: false,
        });
        suggestion.relevancy = hasQuery
          ? this.computeRelevancy(suggestion)
          : 1 - (index / (results.length + 1));
        return suggestion;
      })
      .sort((a, b) => b.relevancy - a.relevancy);
    // Boost relevancy with a multiplier so a relevant tab doesn't get crowded out by results from
    // competing completers. To prevent tabs from crowding out everything else in turn, penalize
    // them for being further down the results list by scaling on a hyperbola starting at 1 and
    // approaching 0 asymptotically for higher indexes. The multiplier and the curve fall-off were
    // subjectively chosen on the grounds that they seem to work pretty well.
    suggestions.forEach(function (suggestion, i) {
      suggestion.relevancy *= 8;
      suggestion.relevancy /= (i / 4) + 1;
    });
    return suggestions;
  }

  computeRelevancy(suggestion) {
    return ranking.wordRelevancy(suggestion.queryTerms, suggestion.url, suggestion.title);
  }
}

export class SearchEngineCompleter {
  static debug;
  cancel() {
    completionSearch.cancel();
  }

  // Returns the UserSearchEngine for the given query. Returns null if the query does not begin with
  // a keyword from one of the user's search engines.
  getUserSearchEngineForQuery(query) {
    const parts = query.trimStart().split(/\s+/);
    // For a keyword "w", we match "w search terms" and "w ", but not "w" on its own.
    const keyword = parts[0];
    if (parts.length <= 1) return null;
    // Don't match queries for built-in properties like "constructor". See #4396.
    if (Object.hasOwn(userSearchEngines.keywordToEngine, keyword)) {
      return userSearchEngines.keywordToEngine[keyword];
    }
    return null;
  }

  refresh() {
    userSearchEngines.set(Settings.get("searchEngines"));
  }

  async filter(request) {
    const { queryTerms } = request;

    const keyword = queryTerms[0];
    const queryTermsWithoutKeyword = queryTerms.slice(1);

    const userSearchEngine = userSearchEngines.keywordToEngine[keyword];
    if (!userSearchEngine) return [];

    const searchUrl = userSearchEngine.url;

    const completions = await completionSearch.complete(searchUrl, queryTermsWithoutKeyword);

    const makeSuggestion = (query) => {
      const url = UrlUtils.createSearchUrl(query, searchUrl);
      return new Suggestion({
        queryTerms,
        description: userSearchEngine.description,
        url,
        title: query,
        searchUrl,
        highlightTerms: false,
        isCustomSearch: true,
        relevancy: null,
        relevancyFunction: this.computeRelevancy,
      });
    };

    const suggestions = completions.map((completion) => {
      const s = makeSuggestion(completion);
      s.insertText = completion;
      return s;
    });

    if (suggestions[0]) suggestions[0].relevancy = 1.0;

    // This is a suggestion which contains the user's query. It's the "search for exactly what I
    // just typed" option. It should always appear first in the list.
    const primarySuggestion = makeSuggestion(queryTermsWithoutKeyword.join(" "));
    primarySuggestion.relevancy = 2;
    primarySuggestion.isPrimarySuggestion = true;
    primarySuggestion.autoSelect = true;
    suggestions.unshift(primarySuggestion);

    return suggestions;
  }

  computeRelevancy({ queryTerms, title }) {
    // Tweaks:
    // - Calibration: we boost relevancy scores to try to achieve an appropriate balance between
    //   relevancy scores here, and those provided by other completers.
    // - Relevancy depends only on the title (which is the search terms), and not on the URL.
    return Suggestion.boostRelevancyScore(
      0.5,
      0.7 * ranking.wordRelevancy(queryTerms, title, title),
    );
  }
}

SearchEngineCompleter.debug = false;

// A completer which calls filter() on many completers, aggregates the results, ranks them, and
// returns the top 10. All queries from the commandBar come through a multi completer.
const maxResults = 10;

function modelessSourceForCompleter(completer) {
  if (completer.commandBarSource) return completer.commandBarSource;
  if (completer instanceof BookmarkCompleter) return "bookmarks";
  if (completer instanceof CommandCompleter) return "commands";
  if (completer instanceof HistoryCompleter) return "history";
  if (completer instanceof TabCompleter) return "tabs";
  if (completer instanceof DomainCompleter || completer instanceof SearchEngineCompleter) {
    return "search";
  }
  return null;
}

export class MultiCompleter {
  completers;
  constructor(completers) {
    this.completers = completers;
  }

  refresh() {
    for (const c of this.completers) {
      if (c.refresh) c.refresh();
    }
  }

  cancel() {
    for (const c of this.completers) {
      c.cancel?.();
    }
  }

  async filter(request) {
    const disabledModelessSources = new Set(
      request.commandBarMode === "" ? request.disabledModelessCommandBarSources ?? [] : [],
    );
    const availableCompleters = this.completers.filter((completer) => {
      const source = modelessSourceForCompleter(completer);
      return source == null || !disabledModelessSources.has(source);
    });
    const searchEngineCompleter = availableCompleters.find(
      (c) => c instanceof SearchEngineCompleter,
    );
    const query = request.query;
    const queryTerms = request.queryTerms;

    // Tab selection always shows results for an empty query. Other completers can explicitly opt
    // into empty-query results with seenTabToOpenCompletionList; standalone history uses this to
    // show its entries by recency.
    const isTabCompleter = this.completers.length == 1 &&
      this.completers[0] instanceof TabCompleter;
    if (
      queryTerms.length == 0 && !isTabCompleter && !request.seenTabToOpenCompletionList &&
      !request.showAllOnEmpty
    ) {
      return [];
    }

    const queryMatchesUserSearchEngine = searchEngineCompleter?.getUserSearchEngineForQuery(query);

    // If the user's query matches one of their custom search engines, then use only that engine to
    // provide completions for their query.
    const showOnlyTabs = request.commandBarMode === "" && queryTerms.length === 0;
    const completers = queryMatchesUserSearchEngine
      ? [searchEngineCompleter]
      : showOnlyTabs
      ? availableCompleters.filter((c) => c instanceof TabCompleter)
      : availableCompleters.filter((c) => c != searchEngineCompleter);

    RegexpCache.clear();

    const promises = completers.map((c) => c.filter(request));
    let results = (await Promise.all(promises)).flat(1);
    results = this.postProcessSuggestions(request, queryTerms, results);
    return results;
  }

  // Rank them, simplify the URLs, and de-duplicate suggestions with the same simplified URL.
  postProcessSuggestions(request, queryTerms, suggestions) {
    for (const s of suggestions) {
      s.computeRelevancy(queryTerms);
      // Domain suggestions intentionally have a strong fixed score. In the modeless command bar,
      // an already-open matching tab is more useful than navigating to that domain again, so give
      // tabs enough additional weight to rank above domains. Standalone tab selection and all
      // other completer modes retain their original ranking.
      if (request.commandBarMode === "" && s.kind === "tab") {
        s.relevancy += 2;
      }
    }
    suggestions.sort((a, b) => b.relevancy - a.relevancy);

    const seenUrls = new Set();
    const dedupedSuggestions = [];
    for (const s of suggestions) {
      if (dedupedSuggestions.length === maxResults) break;
      if (s.deDuplicate) {
        const url = s.shortenUrl();
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
      }
      dedupedSuggestions.push(s);
    }

    // Give each completer the opportunity to tweak the suggestions.
    for (const completer of this.completers) {
      if (completer.postProcessSuggestions) {
        completer.postProcessSuggestions(request, dedupedSuggestions);
      }
    }

    return dedupedSuggestions.map((suggestion) => suggestion.toCompletion());
  }
}

// Provides cached access to Chrome's history. As the user browses to new pages, we add those pages
// to this history cache.
type HistoryEntry = {
  url: string;
  title?: string;
  lastVisitTime?: number;
};

type HistoryRemoval = {
  allHistory: boolean;
  urls?: string[];
};

export const HistoryCache = {
  size: 20000,
  // An array of History items returned from Chrome.
  history: [] as HistoryEntry[],
  loaded: false,
  chromeHistoryPromise: null as Promise<HistoryEntry[]> | null,
  _onVisitedListener: (_entry: HistoryEntry) => {},
  _onVisitRemovedListener: (_removal: HistoryRemoval) => {},

  reset() {
    this.history = [];
    this.loaded = false;
    this.chromeHistoryPromise = null;
    chrome.history.onVisited.removeListener(this._onVisitedListener);
    chrome.history.onVisitRemoved.removeListener(this._onVisitRemovedListener);
  },

  async onLoaded() {
    if (this.loaded) return;
    await this.fetchHistory();
  },

  async fetchHistory() {
    if (this.chromeHistoryPromise) {
      await this.chromeHistoryPromise;
      return;
    }
    this.chromeHistoryPromise = chrome.history.search({
      text: "",
      maxResults: this.size,
      startTime: 0,
    });

    const history = await this.chromeHistoryPromise;

    // Be defensive about history entries without titles.
    for (const entry of history) {
      if (entry.title == null) entry.title = "";
    }
    history.sort(this.compareHistoryByUrl);
    this.history = history;
    this.loaded = true;
    chrome.history.onVisited.addListener(this._onVisitedListener);
    chrome.history.onVisitRemoved.addListener(this._onVisitRemovedListener);
    this.chromeHistoryPromise = null;
  },

  compareHistoryByUrl(a: HistoryEntry, b: HistoryEntry) {
    if (a.url === b.url) return 0;
    if (a.url > b.url) return 1;
    return -1;
  },

  // When a page we've seen before has been visited again, be sure to replace our History item so it
  // has the correct "lastVisitTime". That's crucial for ranking CommandBar suggestions.
  onVisited(newPage: HistoryEntry) {
    // Be defensive about history entries without titles.
    if (newPage.title == null) newPage.title = "";
    const i = HistoryCache.binarySearch(newPage, this.history, this.compareHistoryByUrl);
    const pageWasFound = this.history[i]?.url == newPage.url;
    if (pageWasFound) {
      this.history[i] = newPage;
    } else {
      this.history.splice(i, 0, newPage);
    }
  },

  // When a page is removed from the chrome history, remove it from the suda history too.
  onVisitRemoved(toRemove: HistoryRemoval) {
    if (toRemove.allHistory) {
      this.history = [];
    } else {
      for (const url of toRemove.urls ?? []) {
        const i = HistoryCache.binarySearch({ url }, this.history, this.compareHistoryByUrl);
        if ((i < this.history.length) && (this.history[i].url === url)) {
          this.history.splice(i, 1);
        }
      }
    }
  },

  // Returns the matching index or the closest matching index if the element is not found. That
  // means callers must check the element at the returned index to know whether it was found.
  binarySearch<T>(targetElement: T, array: T[], compareFunction: (a: T, b: T) => number) {
    if (array.length === 0) return 0;
    let middle = 0;
    let high = array.length - 1;
    let low = 0;

    while (low <= high) {
      middle = Math.floor((low + high) / 2);
      const compareResult = compareFunction(array[middle], targetElement);
      if (compareResult > 0) {
        high = middle - 1;
      } else if (compareResult < 0) {
        low = middle + 1;
      } else {
        return middle;
      }
    }
    return compareFunction(array[middle], targetElement) < 0 ? middle + 1 : middle;
  },
};

HistoryCache._onVisitedListener = HistoryCache.onVisited.bind(HistoryCache);
HistoryCache._onVisitRemovedListener = HistoryCache.onVisitRemoved.bind(HistoryCache);
