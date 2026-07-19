// deno-lint-ignore-file no-explicit-any
// Ambient declarations for the extension's ordered classic scripts. These values are installed on
// globalThis by earlier files in manifest.json/pages/all_content_scripts.js. Keep this file limited
// to cross-script boundaries; module-local code is checked from its TypeScript source.

declare const Utils: any;
declare const Settings: any;
declare const UrlUtils: any;
declare const DomUtils: any;
declare const KeyboardUtils: any;
declare const Rect: any;
declare const handlerStack: any;
declare const FindModeHistory: any;
declare const UIComponent: any;
declare const UIComponentMessenger: any;
declare const Mode: any;
declare const KeyHandlerMode: any;
declare const NormalMode: any;
declare const NormalModeCommands: any;
declare const InsertMode: any;
declare const VisualMode: any;
declare const VisualLineMode: any;
declare const FindMode: any;
declare const Scroller: any;
declare const Marks: any;
declare const HUD: any;
declare const CommandBar: any;
declare const LinkHints: any;
declare const HintCoordinator: any;
declare const KeyboardEventRule: any;
declare const forTrusted: any;
declare const frameId: any;
declare const isEnabledForUrl: any;
declare const should: any;
declare const context: any;
declare const setup: any;
declare const teardown: any;
declare const assert: any;
declare const stub: any;
declare const returns: any;
declare const ensureCalled: any;
