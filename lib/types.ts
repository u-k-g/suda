// A centralized file of types which can be shared by both content scripts and background pages.

Object.assign(globalThis, {
  CommandBarShowOptions: {
    // The name of the completer to fetch results from.
    completer: "string",
    // Text to prefill the CommandBar with.
    query: "string",
    // Whether to open the result in a new tab.
    newTab: "boolean",
    // Whether to select the first entry.
    selectFirst: "boolean",
    // A keyword which will scope the search to a UserSearchEngine.
    keyword: "string",
    // The count typed before launching command mode, used to repeat the selected command.
    prefixCount: "number",
    // The unified command-bar mode. An empty string is the combined, modeless command bar.
    mode: "string",
    // The URL of the page which opened the command bar. Used by URL-edit mode.
    currentUrl: "string",
    // Number of links selected before opening the link-action picker.
    linkSelectionCount: "number",
  },
});
