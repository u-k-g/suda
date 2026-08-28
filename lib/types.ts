// A centralized file of types which can be shared by both content scripts and background pages.

Object.assign(globalThis, {
  CommandBarShowOptions: {
    // The name of the completer to fetch results from.
    completer: "string",
    // Text to prefill the command palette with.
    query: "string",
    // Session-persistent draft namespace for this command-palette entry point.
    draftKey: "string",
    // Whether to open the result in a new tab.
    newTab: "boolean",
    // Whether to select the first entry.
    selectFirst: "boolean",
    // A keyword which will scope the search to a UserSearchEngine.
    keyword: "string",
    // The count typed before launching command mode, used to repeat the selected command.
    prefixCount: "number",
    // The unified command-palette mode. An empty string is the combined, modeless command palette.
    mode: "string",
    // The URL of the page which opened the command palette. Used by URL-edit mode.
    currentUrl: "string",
    // Number of links selected before opening the link-action picker.
    linkSelectionCount: "number",
  },
});
