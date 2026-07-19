// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import "../lib/settings.js";
import "../lib/url_utils.js";

// Browser new-tab pages are privileged pages, so Suda cannot run a content script on them.
// When the user has selected another new-tab destination, redirect newly created browser tabs to
// that destination instead.
const browserNewTabUrls = new Set([
  "about:newtab",
  "brave://newtab",
  "chrome-search://local-ntp/local-ntp.html",
  "chrome://new-tab-page",
  "chrome://newtab",
  "edge://newtab",
  "vivaldi://newtab",
]);

const tabsAwaitingUrl = new Map();
const fallbackTimers = new Map();
const fallbackDelayMs = 100;

function normalizeNewTabUrl(url) {
  return typeof url == "string" ? url.toLowerCase().replace(/\/+$/, "") : "";
}

export function isBrowserNewTabUrl(url) {
  return browserNewTabUrls.has(normalizeNewTabUrl(url));
}

// Settings must be loaded before calling this function.
export function getConfiguredNewTabUrl() {
  const destination = Settings.get("newTabDestination");
  const customUrl = Settings.get("newTabCustomUrl");
  if (destination == Settings.newTabDestinations.sudaNewTabPage) {
    return Settings.sudaNewTabPageUrl;
  } else if (destination == Settings.newTabDestinations.customUrl && customUrl.length > 0) {
    return customUrl;
  }
  return UrlUtils.chromeNewTabUrl;
}

export async function redirectBrowserNewTab(tab, url = tab.pendingUrl || tab.url) {
  if (!isBrowserNewTabUrl(url)) return false;

  await Settings.onLoaded();
  const configuredUrl = getConfiguredNewTabUrl();
  if (configuredUrl == UrlUtils.chromeNewTabUrl) return false;

  // Updating Chrome's protected new-tab page races with Chrome's own navigation, which can replace
  // our URL after chrome.tabs.update succeeds. Create the configured tab first and then remove the
  // browser tab; Chrome cannot overwrite a navigation in a different tab.
  const createProperties = {
    active: tab.active ?? true,
    url: configuredUrl,
  };
  for (const property of ["index", "openerTabId", "windowId"]) {
    if (Number.isInteger(tab[property])) createProperties[property] = tab[property];
  }
  if (typeof tab.cookieStoreId == "string") createProperties.cookieStoreId = tab.cookieStoreId;

  await chrome.tabs.create(createProperties);
  await chrome.tabs.remove(tab.id);
  return true;
}

function stopTrackingTab(tabId) {
  tabsAwaitingUrl.delete(tabId);
  const timer = fallbackTimers.get(tabId);
  if (timer != null) clearTimeout(timer);
  fallbackTimers.delete(tabId);
}

export function handleCreatedTab(tab) {
  const url = tab.pendingUrl || tab.url;
  if (url && !isBrowserNewTabUrl(url)) return false;

  // Chrome may expose chrome://newtab here before its own navigation has committed. Redirecting at
  // that point races with Chrome, which can replace our navigation with its new-tab page.
  tabsAwaitingUrl.set(tab.id, url);
  return true;
}

export async function handleUpdatedTab(tabId, changeInfo, tab) {
  if (!tabsAwaitingUrl.has(tabId)) return false;

  const url = changeInfo.url || tab.pendingUrl || tab.url;
  if (url && !isBrowserNewTabUrl(url)) {
    stopTrackingTab(tabId);
    return false;
  }

  const isComplete = changeInfo.status == "complete" || tab.status == "complete";
  if (!url || !isComplete) return false;

  stopTrackingTab(tabId);
  return await redirectBrowserNewTab(tab, url);
}

// Chrome does not reliably emit tabs.onUpdated for its protected new-tab page. Re-read the live tab
// shortly after creation so Ctrl-T/Cmd-T still redirects even when no update event is delivered.
export async function handleSettledCreatedTab(tabId) {
  if (!tabsAwaitingUrl.has(tabId)) return false;

  const initialUrl = tabsAwaitingUrl.get(tabId);
  const tab = await chrome.tabs.get(tabId);
  const currentUrl = tab.pendingUrl || tab.url;
  if (currentUrl && !isBrowserNewTabUrl(currentUrl)) {
    stopTrackingTab(tabId);
    return false;
  }

  // Some Chrome versions expose neither url nor pendingUrl for their new-tab page.
  const newTabUrl = currentUrl || initialUrl || UrlUtils.chromeNewTabUrl;

  stopTrackingTab(tabId);
  return await redirectBrowserNewTab(tab, newTabUrl);
}

export function handleRemovedTab(tabId) {
  stopTrackingTab(tabId);
}

export function initializeNewTabRedirect() {
  const swallowTabError = () => {};
  chrome.tabs.onCreated.addListener((tab) => {
    if (!handleCreatedTab(tab)) return;
    const timer = setTimeout(() => {
      handleSettledCreatedTab(tab.id).catch(swallowTabError);
    }, fallbackDelayMs);
    fallbackTimers.set(tab.id, timer);
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    handleUpdatedTab(tabId, changeInfo, tab).catch(swallowTabError);
  });
  chrome.tabs.onRemoved.addListener(handleRemovedTab);
}
