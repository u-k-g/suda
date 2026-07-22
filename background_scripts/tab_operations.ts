// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
//
// Functions for opening URLs in tabs.
//

import * as bgUtils from "../background_scripts/bg_utils.js";
import "../lib/url_utils.js";

// Opens request.url in the current tab. If the URL is keywords, search for them in the default
// search engine. If the URL is a javascript: snippet, execute it in the current tab.
export async function openUrlInCurrentTab(request) {
  const urlStr = await UrlUtils.convertToUrl(request.url);
  if (urlStr == null) {
    // The requested destination is not a URL, so treat it like a search query.
    const query = request.url?.trim();
    if (!query) return;
    return chrome.search.query({ text: query });
  } else if (UrlUtils.hasJavascriptProtocol(urlStr)) {
    // Note that when injecting JavaScript, it's subject to the site's CSP. Sites with strict CSPs
    // (like github.com, developer.mozilla.org) will raise an error when we try to run this code.
    // See https://github.com/u-k-g/suda/issues/4331.
    const scriptingArgs = {
      target: { tabId: request.tabId },
      func: (text) => {
        const prefix = "javascript:";
        text = text.slice(prefix.length).trim();
        // TODO(philc): Why do we try to double decode here? Discover and then document it.
        text = decodeURIComponent(text);
        try {
          text = decodeURIComponent(text);
        } catch {
          // Swallow
        }
        const el = document.createElement("script");
        el.textContent = text;
        document.head.appendChild(el);
      },
      args: [urlStr],
    };
    // The MAIN world -- where the webpage runs -- is less privileged than the ISOLATED world.
    scriptingArgs.world = "MAIN";
    await bgUtils.runTabOperation(() => chrome.scripting.executeScript(scriptingArgs));
  } else {
    // The requested destination is a regular URL.
    await bgUtils.runTabOperation(() => chrome.tabs.update(request.tabId, { url: urlStr }));
  }
}

// Opens request.url in new tab and switches to it.
// Returns the created tab.
export async function openUrlInNewTab(request) {
  const urlStr = await UrlUtils.convertToUrl(request.url);
  const tabConfig = { windowId: request.tab.windowId };
  const position = request.position;
  let tabIndex = null;
  switch (position) {
    case "start":
      tabIndex = 0;
      break;
    case "before":
      tabIndex = request.tab.index;
      break;
    case "end":
      tabIndex = null;
      break;
    // "after" is the default case when there are no options.
    default:
      tabIndex = request.tab.index + 1;
  }
  tabConfig.index = tabIndex;
  tabConfig.active = request.active ?? true;
  tabConfig.openerTabId = request.tab.id;

  let newTab;

  if (urlStr == null) {
    // The requested destination is not a URL, so treat it like a search query.
    //
    // The chrome.search.query API lets us open the search in a new tab, but it doesn't let us
    // control the precise position of that tab. So, we open a new blank tab using our position
    // parameter, and then execute the search in that tab.

    // Creating a blank tab before calling chrome.search.query focuses the omnibox, so create an
    // empty page first.
    const query = request.url?.trim();
    if (!query) {
      newTab = await chrome.tabs.create(tabConfig);
    } else {
      tabConfig.url = "data:text/html,<html></html>";
      newTab = await chrome.tabs.create(tabConfig);
      await bgUtils.runTabOperation(() => chrome.search.query({ text: query, tabId: newTab.id }));
    }
  } else {
    // The requested destination is a regular URL.
    if (urlStr != UrlUtils.browserNewTabUrl) {
      tabConfig.url = urlStr;
    }
    newTab = await chrome.tabs.create(tabConfig);
  }
  return newTab;
}

// Open request.url in new window and switch to it.
export async function openUrlInNewWindow(request) {
  const winConfig = {
    url: await UrlUtils.convertToUrl(request.url),
    active: true,
  };
  if (request.active != null) {
    winConfig.active = request.active;
  }
  await chrome.windows.create(winConfig);
}
