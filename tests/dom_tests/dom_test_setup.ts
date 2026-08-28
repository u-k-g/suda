// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
globalThis.sudaDomTestsAreRunning = true;

import * as shoulda from "../vendor/shoulda.js";

// Attach shoulda's functions -- like setup, context, should -- to the global namespace.
Object.assign(globalThis, shoulda);
globalThis.shoulda = shoulda;

document.addEventListener("DOMContentLoaded", async () => {
  isEnabledForUrl = true;
  await Settings.onLoaded();
  // Most DOM tests exercise page modes directly, so opt into them explicitly now that fresh
  // installations default to command-palette-only mode.
  Settings._settings.commandBarOnly = false;
  await HUD.init();
});
