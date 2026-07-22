// The official new-tab override always opens this local page. Preserve the configurable custom-URL
// destination by leaving immediately when the user selected one. Chrome does not expose a way for
// an installed override to delegate back to the protected browser-default new-tab page.
const isCommandBarFallback = new URL(globalThis.location.href).searchParams.has("sudaCommandBar");
if (!isCommandBarFallback) {
  Utils.withExtensionContext(() =>
    chrome.storage.sync.get(["newTabDestination", "newTabCustomUrl"])
  ).then((settings) => {
    if (!settings) return;
    if (settings.newTabDestination === "customUrl" && settings.newTabCustomUrl) {
      globalThis.location.replace(settings.newTabCustomUrl);
    }
  });
}
