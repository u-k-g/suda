import { TabRecency } from "./tab_recency.js";

export function tabNoLongerExists(error) {
  return error?.message?.includes("No tab with id");
}

export function tabCannotReceiveMessage(error) {
  return tabNoLongerExists(error) ||
    error?.message?.includes("Could not establish connection. Receiving end does not exist");
}

export function receivingEndDoesNotExist(error) {
  return error?.message?.includes("Could not establish connection. Receiving end does not exist");
}

// Tabs can retain an orphaned Suda isolated world after the extension reloads. That world can no
// longer receive runtime messages, so a missing receiver does not necessarily mean that reinjecting
// the whole content bundle is safe.
export async function topFrameHasSudaIsolatedWorld(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      func: () => {
        const scope = globalThis as unknown as Record<string, unknown>;
        return Boolean(
          scope["forTrusted"] || scope["KeyboardUtils"] || scope["handlerStack"] ||
            scope["HelpDialog"],
        );
      },
    });
    return results?.[0]?.result === true;
  } catch {
    return false;
  }
}

// Browser tab APIs necessarily race tabs being closed. Run an operation against a tab snapshot and
// ignore only that expected race; preserve every other failure.
export async function runTabOperation(operation) {
  try {
    return await operation();
  } catch (error) {
    if (!tabNoLongerExists(error)) throw error;
  }
}

// Some Chromium forks still report callback-capable tab API failures only through
// chrome.runtime.lastError, even when the API also supports promises. Use this for operations which
// are especially likely to race a browser-owned shortcut or a tab closing.
export function runTabCallbackOperation(operation, onMissingReceiver = null) {
  return new Promise((resolve, reject) => {
    operation((result) => {
      const error = chrome.runtime.lastError;
      if (tabNoLongerExists(error)) return resolve(undefined);
      if (receivingEndDoesNotExist(error)) {
        return Promise.resolve(onMissingReceiver?.(error)).then(resolve, reject);
      }
      if (error != null) return reject(error);
      resolve(result);
    });
  });
}

// TODO(philc): tabRecency imports bg_utils. We should resovle the cycle for the sake of clarity.
export const tabRecency = new TabRecency();
tabRecency.init();
