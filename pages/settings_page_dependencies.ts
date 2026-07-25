// Shared runtime dependencies for extension settings pages.
//
// These modules expose their APIs on globalThis for legacy callers. Keep this list intentionally
// small so settings modules remain independently testable. The browser page loads
// all_content_scripts separately to enable Suda's normal mode on its own settings UI.
import "../lib/utils.js";
import "../lib/settings.js";
import "../lib/keyboard_utils.js";
import "../lib/dom_utils.js";
