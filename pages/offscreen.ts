chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== "offscreen" || message.handler !== "readClipboardText") return false;

  try {
    // Offscreen documents cannot receive focus, so navigator.clipboard.readText() rejects. With
    // the extension's clipboardRead permission, execCommand can paste into a local editable node.
    const input = document.createElement("textarea");
    document.body.appendChild(input);
    input.focus();
    const pasted = document.execCommand("paste");
    const text = input.value.replace(/\xa0/g, " ");
    input.remove();
    sendResponse(pasted ? { text } : { error: "Chrome did not allow Suda to read the clipboard." });
  } catch (error) {
    sendResponse({ error: error instanceof Error ? error.message : String(error) });
  }
  return false;
});
