// A UIComponent is an iframe containing a Suda extension page, like the CommandBar. This class
// provides methods that content scripts can use to interact with that page:
// - show
// - hide
// - postMessage
//
// When the iframe has not yet been loaded, all messages will be queued until it's done loading. The
// page in the iframe uses the module ui_component_messenger.js to manage message passing back to
// this class. Since the iframe's page can receive messages from untrusted javascript, secure
// message passing is achieved using ports from MessageChannel() and a sudaSecret handshake.
type UIFocusOptions = { focus?: boolean; sourceFrameId?: number };

class UIComponent {
  iframeElement!: HTMLIFrameElement;
  iframePort!: Promise<MessagePort | null>;
  showing = false;
  hiding = false;
  visibilityRequestId = 0;
  // An optional message handler for handling messages from the iFrame.
  messageHandler;
  iframeFrameId;
  // These are the focus options set when show() is invoked. We store them while the UIComponent
  // is visible so we know how to revert focus once it's dismissed.
  focusOptions: UIFocusOptions = {};
  shadowDOM;
  // When we open ports to the iframe using MessageChannel, we save them so that our unit tests can
  // close the ports. See ui_component_test.js for details.
  messageChannelPorts;

  // - iframeUrl:
  // - className: the CSS class to add to the iframe.
  // - messageHandler: optional; a function to handle messages from the iframe's page.
  async load(iframeUrl, className, messageHandler) {
    if (this.iframeElement) throw new Error("load should only be called once.");
    this.messageHandler = messageHandler;
    const isDomTests = iframeUrl.includes("?dom_tests=true");
    this.iframeElement = DomUtils.createElement("iframe");

    // Create this promise before the first await in load(). Callers intentionally do not have to
    // wait for load() before queueing a message.
    let resolveIframePort;
    this.iframePort = new Promise((resolve) => {
      resolveIframePort = resolve;
    });
    const abandonLoad = () => {
      for (const port of this.messageChannelPorts ?? []) port.close();
      resolveIframePort(null);
      return;
    };

    // Allow Suda's iframes to have clipboard access. This is needed when triggering commands like
    // link hints or copyCurrentUrl from within the help dialog. This
    // permission has to be set before we append the iframe to the DOM, or Chrome will log the
    // console error "Potential permissions policy violation: clipboard-read is not allowed in this
    // document."
    this.iframeElement.allow = "clipboard-read; clipboard-write";

    const styleSheet = DomUtils.createElement("style");
    styleSheet.type = "text/css";
    // Default to everything hidden while the stylesheet loads.
    styleSheet.innerHTML = "iframe {display: none;}";

    // Fetch "content_scripts/suda.css" from chrome.storage.session; the background page caches
    // it there.
    const cssItems = await Utils.withExtensionContext(() =>
      chrome.storage.session.get("sudaCSSInChromeStorage")
    );
    if (!cssItems) return abandonLoad();
    if (cssItems.sudaCSSInChromeStorage) {
      styleSheet.innerHTML = cssItems.sudaCSSInChromeStorage;
    }

    this.iframeElement.className = className;

    const shadowWrapper = DomUtils.createElement("div");
    // Prevent the page's CSS from interfering with this container div.
    shadowWrapper.className = "suda-reset";
    this.shadowDOM = shadowWrapper.attachShadow({ mode: "open" });
    this.shadowDOM.appendChild(styleSheet);
    // Allow a user's custom CSS to style iframe element inside this shadow DOM.
    DomUtils.injectUserCss(this.shadowDOM);
    this.shadowDOM.appendChild(this.iframeElement);

    this.setIframeVisible(false);
    const resolvedIframeUrl = await Utils.withExtensionContext(() =>
      Promise.resolve(chrome.runtime.getURL(iframeUrl))
    );
    if (resolvedIframeUrl == null) return abandonLoad();

    // The background worker initializes the per-session secret during startup. Waiting for the
    // document also preserves the startup ordering this component has historically relied on.
    await DomUtils.documentReady();
    const secretItems = await Utils.withExtensionContext(() =>
      chrome.storage.session.get("sudaSecret")
    );
    if (!secretItems) return abandonLoad();
    const secret = secretItems.sudaSecret;
    const { port1, port2 } = new MessageChannel();
    this.messageChannelPorts = [port1, port2];

    port1.onmessage = (event) => {
      let eventName = null;
      // TODO(philc): Why are we using both data and data.name as the name? Pick one.
      if (event) {
        eventName = (event.data ? event.data.name : undefined) || event.data;
      }

      switch (eventName) {
        case "uiComponentIsReady":
          // If this frame receives the focus, then hide the UI component.
          globalThis.addEventListener(
            "focus",
            forTrusted((event) => {
              if ((event.target === window) && this.focusOptions.focus) {
                this.hide(false);
              }
              // Continue propagating the event.
              return true;
            }),
            true,
          );
          // Set the iframe's port, thereby rendering the UI component ready.
          resolveIframePort(port1);
          break;
        case "setIframeFrameId":
          this.iframeFrameId = event.data.iframeFrameId;
          break;
        case "hide":
          return this.hide();
        default:
          this.messageHandler?.(event);
      }
    };

    // Install the load listener before setting src or attaching the iframe. A cached extension page
    // can otherwise finish loading before the private message channel is ready.
    this.iframeElement.addEventListener("load", () => {
      // Get sudaSecret so the iframe can determine that our message isn't the page
      // impersonating us.
      // Outside of tests, target origin starts with chrome-extension://{suda's-id}
      let targetOrigin;
      try {
        targetOrigin = isDomTests ? "*" : chrome.runtime.getURL("");
      } catch (error) {
        if (Utils.extensionContextWasInvalidated(error)) {
          return abandonLoad();
        }
        throw error;
      }
      const contentWindow = this.iframeElement.contentWindow;
      if (!contentWindow) return abandonLoad();
      contentWindow.postMessage(secret, targetOrigin, [port2]);
    });

    this.iframeElement.src = resolvedIframeUrl;
    this.handlePageColorFilter();
    document.documentElement.appendChild(shadowWrapper);
  }

  // Page-wide color filters also affect extension iframes. Reverse any such filter so Suda can
  // render its own theme; detect the visual effect rather than a particular extension's DOM ID.
  handlePageColorFilter() {
    const reverseFilterClass = "suda-reverse-page-filter";
    const reverseFilterIfExists = () => {
      const elements = [document.documentElement, document.body].filter(Boolean);
      const getStyle = document.defaultView?.getComputedStyle?.bind(document.defaultView);
      if (!getStyle) return;
      const hasPageFilter = elements.some((element) => {
        const filter = getStyle(element).filter;
        return filter && filter !== "none";
      });
      this.iframeElement.classList.toggle(reverseFilterClass, hasPageFilter);
    };

    reverseFilterIfExists();

    const observer = new MutationObserver(reverseFilterIfExists);
    observer.observe(document.head, { characterData: true, subtree: true, childList: true });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    if (document.body) {
      observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
    }
  }

  setIframeVisible(visible) {
    const classes = this.iframeElement.classList;
    if (visible) {
      this.iframeElement.style.removeProperty("display");
      classes.remove("suda-ui-component-hidden");
      classes.add("suda-ui-component-visible");
    } else {
      this.iframeElement.style.setProperty("display", "none", "important");
      classes.add("suda-ui-component-hidden");
      classes.remove("suda-ui-component-visible");
    }
  }

  // Send a message to this UIComponent's iframe's page.
  // - data: an object with at least a `name` field.
  async postMessage(data) {
    const port = await this.iframePort;
    if (!port) return false;
    port.postMessage(data);
    return true;
  }

  // Show the UIComponent.
  // - messageData: a message to send to the underlying iframe via `postMessage`.
  // - focusOptions: optional. {
  //     focus: whether the UIComponent should be focused once it's ready.
  //     sourceFrameId: which frame should the focus when this component is dismissed.
  //   }
  async show(messageData = {}, focusOptions = {}) {
    if (focusOptions) {
      Utils.assertType({ focus: "boolean", sourceFrameId: "number" }, focusOptions);
    }
    const visibilityRequestId = ++this.visibilityRequestId;
    this.focusOptions = focusOptions;
    this.showing = true;
    this.hiding = false;
    if (!(await this.postMessage(messageData))) {
      this.showing = false;
      return;
    }
    if (visibilityRequestId !== this.visibilityRequestId || !this.showing) return;
    this.setIframeVisible(true);
    if (this.focusOptions.focus) {
      this.iframeElement.focus();
    }
  }

  async hide(shouldRefocusOriginalFrame = true) {
    if (!this.showing && !this.hiding) return;

    const visibilityRequestId = ++this.visibilityRequestId;
    const focusOptions = this.focusOptions;
    this.showing = false;
    this.hiding = true;
    // Hide synchronously. Dismissal must not depend on the iframe message port being responsive.
    this.setIframeVisible(false);
    if (focusOptions.focus) {
      this.iframeElement.blur();
      if (shouldRefocusOriginalFrame) {
        if (focusOptions.sourceFrameId != null) {
          try {
            chrome.runtime.sendMessage({
              handler: "sendMessageToFrames",
              frameId: focusOptions.sourceFrameId,
              message: {
                handler: "focusFrame",
                forceFocusThisFrame: true,
              },
            }).catch(() => {});
          } catch (_error) {
            // The extension may have been reloaded while an older content script is still present.
          }
        } else {
          Utils.nextTick(() => globalThis.focus());
        }
      }
    }
    this.focusOptions = {};

    const port = await this.iframePort;
    if (visibilityRequestId !== this.visibilityRequestId || this.showing) return;
    if (!port) {
      this.hiding = false;
      return;
    }
    port.postMessage({ name: "hidden" }); // Inform the UI component that it is hidden.
    this.hiding = false;
  }
}

Object.assign(globalThis, { UIComponent });
