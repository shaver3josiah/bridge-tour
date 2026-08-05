/*!
 * Photo Sphere Viewer / Gallery Plugin 5.14.3
 * @copyright 2015-2026 Damien "Mistic" Sorel
 * @licence MIT (https://opensource.org/licenses/MIT)
 */
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/index.ts
import { DEFAULTS, registerButton } from "@photo-sphere-viewer/core";

// src/events.ts
var events_exports = {};
__export(events_exports, {
  HideGalleryEvent: () => HideGalleryEvent,
  ShowGalleryEvent: () => ShowGalleryEvent
});
import { TypedEvent } from "@photo-sphere-viewer/core";
var _ShowGalleryEvent = class _ShowGalleryEvent extends TypedEvent {
  /** @internal */
  constructor(fullscreen) {
    super(_ShowGalleryEvent.type);
    this.fullscreen = fullscreen;
  }
};
_ShowGalleryEvent.type = "show-gallery";
var ShowGalleryEvent = _ShowGalleryEvent;
var _HideGalleryEvent = class _HideGalleryEvent extends TypedEvent {
  /** @internal */
  constructor() {
    super(_HideGalleryEvent.type);
  }
};
_HideGalleryEvent.type = "hide-gallery";
var HideGalleryEvent = _HideGalleryEvent;

// src/GalleryButton.ts
import { AbstractButton } from "@photo-sphere-viewer/core";

// src/icons/gallery.svg
var gallery_default = '<svg viewBox="185 115 330 330" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M186.7 326.7V163.3c0-15 8.3-23.3 23.3-23.3h210c15 0 23.3 8.3 23.3 23.3v163.4c0 15-8.3 23.3-23.3 23.3H210c-15 0-23.3-8.3-23.3-23.3zm70 70v-23.4H420c30.2 0 46.7-16.4 46.7-46.6V210H490c15 0 23.3 8.3 23.3 23.3v163.4c0 15-8.3 23.3-23.3 23.3H280c-15 0-23.3-8.3-23.3-23.3zm-23.8-105H397l-40-50.4-26.7 29.7-44.3-54.5zm106.7-76c9.6 0 17.8-7.8 17.8-17.2a18 18 0 0 0-17.8-17.8c-9.4 0-17.2 8.2-17.2 17.8 0 9.4 7.8 17.2 17.2 17.2z"/><!--Created by Wolf B\xF6se from the Noun Project--></svg>';

// src/GalleryButton.ts
var GalleryButton = class extends AbstractButton {
  /**
   * @param {PSV.components.Navbar} navbar
   */
  constructor(navbar) {
    super(navbar, {
      className: "psv-gallery-button",
      hoverScale: true,
      collapsable: true,
      tabbable: true,
      icon: gallery_default
    });
    this.plugin = this.viewer.getPlugin("gallery");
    if (this.plugin) {
      this.plugin.addEventListener(ShowGalleryEvent.type, this);
      this.plugin.addEventListener(HideGalleryEvent.type, this);
    }
  }
  destroy() {
    if (this.plugin) {
      this.plugin.removeEventListener(ShowGalleryEvent.type, this);
      this.plugin.removeEventListener(HideGalleryEvent.type, this);
    }
    super.destroy();
  }
  /**
   * @internal
   */
  handleEvent(e) {
    if (e instanceof ShowGalleryEvent) {
      this.toggleActive(true);
    } else if (e instanceof HideGalleryEvent) {
      this.toggleActive(false);
    }
  }
  isSupported() {
    return !!this.plugin;
  }
  onClick() {
    this.plugin.toggle();
  }
};
GalleryButton.id = "gallery";

// src/GalleryPlugin.ts
import { AbstractConfigurablePlugin, events as events2, PSVError, utils as utils3 } from "@photo-sphere-viewer/core";

// src/GalleryComponent.ts
import { AbstractComponent, CONSTANTS, events, utils as utils2 } from "@photo-sphere-viewer/core";
import { MathUtils } from "three";

// src/constants.ts
import { utils } from "@photo-sphere-viewer/core";
var GALLERY_ITEM_DATA = "psvGalleryItem";
var GALLERY_ITEM_DATA_KEY = utils.dasherize(GALLERY_ITEM_DATA);
var ACTIVE_CLASS = "psv-gallery-item--active";
var ITEMS_TEMPLATE = (items, size) => `
${items.map((item) => `
<div class="psv-gallery-item" 
     data-${GALLERY_ITEM_DATA_KEY}="${item.id}"
     style="width:${size.width}px; aspect-ratio:${size.width / size.height};"
     tabindex="0">
    ${item.name ? `<div class="psv-gallery-item-title"><span>${item.name}</span></div>` : ""}
    <svg class="psv-gallery-item-thumb" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice"><use href="#psvGalleryBlankIcon"></use></svg>
    ${item.thumbnail ? `<div class="psv-gallery-item-thumb" data-src="${item.thumbnail}"></div>` : ""}
</div>
`).join("")}
`;

// src/icons/arrow.svg
var arrow_default = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="25 0 50 100"><polygon fill="currentColor" points="24.66 99.31 25.34 100 75.34 50 25.34 0 24.66 0.69 24.66 22.64 52.01 50 24.66 77.36 24.66 99.31"/><!-- Created by Rainbow Designs from the Noun Project --></svg>\n';

// src/icons/blank.svg
var blank_default = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">\n  <defs>\n    <symbol id="psvGalleryBlankIcon" viewBox="0 0 200 200">\n      <rect x="0" y="0" width="200" height="200" fill="#666"/>\n      <g transform="scale(0.25) translate(25 20) " fill="#eee">\n        <path d="M376 220.61c-85.84 0-155.39 69.56-155.39 155.39 0 85.84 69.56 155.39 155.39 155.39 85.84 0 155.39-69.56 155.39-155.39 0-85.84-69.56-155.39-155.39-155.39zm0 300.92c-80.41 0-145.53-65.12-145.53-145.53S295.59 230.47 376 230.47 521.53 295.59 521.53 376 456.41 521.53 376 521.53z"/>\n        <path d="M467.27 300.03H284.74a18.21 18.21 0 0 0-18.25 18.25v115.43a18.21 18.21 0 0 0 18.25 18.26h182.53a18.21 18.21 0 0 0 18.25-18.26V318.28a18.2 18.2 0 0 0-18.25-18.25zm-190.91 18.25a8.64 8.64 0 0 1 8.39-8.38h182.53a8.64 8.64 0 0 1 8.38 8.38V413l-44.89-35.52c-.49-.5-.99-.5-1.48-.99h-2.46c-.5 0-1 0-1.48.5l-37.5 21.2-43.9-58.7-.5-.5s0-.48-.49-.48c0 0-.49 0-.49-.5-.49 0-.49-.49-.99-.49-.49 0-.49 0-.98-.49H337.53c-.5 0-.5.5-.99.5h-.49l-.5.48s-.48 0-.48.5l-58.7 65.12zM467.27 442.1H284.74a8.64 8.64 0 0 1-8.39-8.38v-15.3l63.15-68.07 42.92 57.22 1.48 1.48h.49c.5.5 1.48.5 1.97.5H388.83l38.47-21.72 46.37 36.5c.5.5 1.49 1 1.98 1v8.88c0 3.95-3.45 7.9-8.38 7.9z"/>\n        <path d="M429.77 333.58a13.81 13.81 0 1 1-27.63 0 13.81 13.81 0 0 1 27.63 0"/>\n      </g>\n    </symbol>\n  </defs>\n</svg>';

// src/utils.ts
function clickRepeater(element, cb) {
  let interval;
  element.addEventListener("mousedown", () => {
    cb();
    clearInterval(interval);
    interval = setInterval(() => {
      if (element.style.pointerEvents === "none") {
        clearInterval(interval);
      } else {
        cb();
      }
    }, 500);
  });
  element.addEventListener("mouseup", () => {
    clearInterval(interval);
  });
}

// src/GalleryComponent.ts
var GalleryComponent = class extends AbstractComponent {
  constructor(plugin, viewer) {
    super(viewer, {
      className: `psv-gallery ${CONSTANTS.CAPTURE_EVENTS_CLASS}`
    });
    this.plugin = plugin;
    this.state = {
      visible: true,
      mousedown: false,
      initMouse: null,
      mouse: null,
      itemMargin: null,
      breakpoint: null,
      scrollLeft: 0,
      scrollTop: 0,
      isAboveBreakpoint: null
    };
    this.container.innerHTML = blank_default;
    this.container.querySelector("svg").style.display = "none";
    const closeBtn = document.createElement("div");
    closeBtn.className = "psv-panel-close-button";
    closeBtn.innerHTML = CONSTANTS.ICONS.close;
    this.container.appendChild(closeBtn);
    closeBtn.addEventListener("click", () => this.plugin.hide());
    this.items = document.createElement("div");
    this.items.className = "psv-gallery-container";
    this.container.appendChild(this.items);
    if (this.config.navigationArrows) {
      this.arrowLeft = document.createElement("div");
      this.arrowLeft.className = "psv-gallery-arrow";
      this.arrowLeft.innerHTML = arrow_default;
      this.container.appendChild(this.arrowLeft);
      this.arrowRight = document.createElement("div");
      this.arrowRight.className = "psv-gallery-arrow";
      this.arrowRight.innerHTML = arrow_default;
      this.container.appendChild(this.arrowRight);
      clickRepeater(this.arrowLeft, () => this.__scroll(-1));
      clickRepeater(this.arrowRight, () => this.__scroll(1));
    }
    this.state.itemMargin = parseInt(utils2.getStyleProperty(this.items, "padding-left"), 10);
    this.state.breakpoint = parseInt(utils2.getStyleProperty(this.container, "--psv-gallery-breakpoint"), 10);
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio > 0) {
            const element = entry.target;
            element.style.backgroundImage = `url("${element.dataset.src}")`;
            delete element.dataset.src;
            this.observer.unobserve(entry.target);
          }
        });
      },
      {
        root: this.viewer.container
      }
    );
    this.viewer.addEventListener(events.SizeUpdatedEvent.type, this);
    this.container.addEventListener("transitionend", this);
    this.container.addEventListener("keydown", this);
    this.items.addEventListener("wheel", this);
    this.items.addEventListener("scroll", this);
    this.items.addEventListener("mousedown", this);
    this.items.addEventListener("mousemove", this);
    this.items.addEventListener("click", this);
    window.addEventListener("mouseup", this);
    this.hide();
  }
  get isAboveBreakpoint() {
    return this.items.offsetWidth > this.state.breakpoint;
  }
  get config() {
    return this.plugin.config;
  }
  destroy() {
    window.removeEventListener("mouseup", this);
    this.viewer.removeEventListener(events.SizeUpdatedEvent.type, this);
    this.observer.disconnect();
    super.destroy();
  }
  /**
   * @internal
   */
  handleEvent(e) {
    switch (e.type) {
      case "transitionend":
        if (this.isVisible() && e.target === this.container) {
          this.__focusActiveOrFirst();
        }
        break;
      case "keydown":
        if (this.isVisible()) {
          switch (e.key) {
            case CONSTANTS.KEY_CODES.Escape:
              this.plugin.hide();
              break;
            case CONSTANTS.KEY_CODES.Enter:
              this.__click(e);
              break;
          }
        }
        break;
      case "wheel": {
        const evt = e;
        this.__scroll(evt.deltaY > 0 ? 1 : -1);
        e.preventDefault();
        break;
      }
      case "scroll":
      case events.SizeUpdatedEvent.type:
        this.__updateArrows();
        break;
      case "mousedown":
        this.state.mousedown = true;
        if (this.isAboveBreakpoint) {
          this.state.initMouse = e.clientX;
        } else {
          this.state.initMouse = e.clientY;
        }
        this.state.mouse = this.state.initMouse;
        break;
      case "mousemove":
        if (this.state.mousedown) {
          if (this.isAboveBreakpoint) {
            const delta = this.state.mouse - e.clientX;
            this.items.scrollLeft += delta;
            this.state.scrollLeft = this.items.scrollLeft;
            this.state.mouse = e.clientX;
          } else {
            const delta = this.state.mouse - e.clientY;
            this.items.scrollTop += delta;
            this.state.scrollTop = this.items.scrollTop;
            this.state.mouse = e.clientY;
          }
        }
        break;
      case "mouseup":
        this.state.mousedown = false;
        this.state.mouse = null;
        e.preventDefault();
        break;
      case "click": {
        const currentMouse = this.isAboveBreakpoint ? e.clientX : e.clientY;
        if (Math.abs(this.state.initMouse - currentMouse) < 10) {
          this.__click(e);
        }
        break;
      }
    }
  }
  show() {
    this.container.classList.add("psv-gallery--open");
    this.state.visible = true;
  }
  hide() {
    this.container.classList.remove("psv-gallery--open");
    this.state.visible = false;
    if (utils2.hasParent(document.activeElement, this.container)) {
      this.viewer.navbar.focusButton(GalleryButton.id);
    }
  }
  setItems(items) {
    this.items.innerHTML = ITEMS_TEMPLATE(items, this.plugin.config.thumbnailSize);
    if (this.observer) {
      this.observer.disconnect();
      this.items.querySelectorAll("[data-src]").forEach((child) => {
        this.observer.observe(child);
      });
    }
    this.__updateArrows();
  }
  setActive(id) {
    const currentActive = this.items.querySelector("." + ACTIVE_CLASS);
    currentActive?.classList.remove(ACTIVE_CLASS);
    if (id) {
      const nextActive = this.items.querySelector(`[data-${GALLERY_ITEM_DATA_KEY}="${id}"]`);
      if (nextActive) {
        nextActive.classList.add(ACTIVE_CLASS);
        this.items.scrollLeft = nextActive.offsetLeft + nextActive.clientWidth / 2 - this.items.clientWidth / 2;
      }
    }
  }
  /**
   * Handle clicks on items
   */
  __click(e) {
    const item = utils2.getMatchingTarget(e, `.psv-gallery-item`);
    if (!item) {
      return;
    }
    const id = item.dataset[GALLERY_ITEM_DATA];
    this.plugin.applyItem(id);
    this.setActive(id);
    if (this.config.hideOnClick || !this.isAboveBreakpoint) {
      this.hide();
    }
  }
  __focusActiveOrFirst() {
    const el = this.items.querySelector("." + ACTIVE_CLASS) ?? this.items.firstElementChild;
    el?.focus();
  }
  /**
   * Applies scroll
   */
  __scroll(direction) {
    if (this.isAboveBreakpoint) {
      const maxScroll = this.items.scrollWidth - this.items.offsetWidth;
      const scrollAmount = this.plugin.config.thumbnailSize.width + (this.state.itemMargin ?? 0);
      this.state.scrollLeft = MathUtils.clamp(this.state.scrollLeft + direction * scrollAmount, 0, maxScroll);
      if (direction === -1 && this.state.scrollLeft < scrollAmount * 0.8) {
        this.state.scrollLeft = 0;
      }
      if (direction === 1 && this.state.scrollLeft > maxScroll - scrollAmount * 0.8) {
        this.state.scrollLeft = maxScroll;
      }
      this.items.scroll({
        left: this.state.scrollLeft,
        behavior: "smooth"
      });
    } else {
      const maxScroll = this.items.scrollHeight - this.items.offsetHeight;
      const scrollAmount = this.items.querySelector(":first-child").offsetHeight * 2 + (this.state.itemMargin ?? 0);
      this.state.scrollTop = MathUtils.clamp(this.state.scrollTop + direction * scrollAmount, 0, maxScroll);
      if (direction === -1 && this.state.scrollTop < scrollAmount * 0.8) {
        this.state.scrollTop = 0;
      }
      if (direction === 1 && this.state.scrollTop > maxScroll - scrollAmount * 0.8) {
        this.state.scrollTop = maxScroll;
      }
      this.items.scroll({
        top: this.state.scrollTop,
        behavior: "smooth"
      });
    }
  }
  /**
   * Updates the arrows visibility and indicator size
   */
  __updateArrows() {
    if (!this.config.navigationArrows) {
      return;
    }
    if (this.state.isAboveBreakpoint !== this.isAboveBreakpoint) {
      utils2.toggleClass(this.arrowLeft, "psv-gallery-arrow--left", this.isAboveBreakpoint);
      utils2.toggleClass(this.arrowLeft, "psv-gallery-arrow--top", !this.isAboveBreakpoint);
      utils2.toggleClass(this.arrowRight, "psv-gallery-arrow--right", this.isAboveBreakpoint);
      utils2.toggleClass(this.arrowRight, "psv-gallery-arrow--bottom", !this.isAboveBreakpoint);
      this.state.isAboveBreakpoint = this.isAboveBreakpoint;
    }
    const toggle = (el, show) => {
      if (show) {
        el.style.opacity = "1";
        el.style.pointerEvents = "auto";
      } else {
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
      }
    };
    if (this.isAboveBreakpoint) {
      const maxScroll = this.items.scrollWidth - this.items.offsetWidth;
      toggle(this.arrowLeft, this.items.scrollLeft > 50);
      toggle(this.arrowRight, this.items.scrollLeft < maxScroll - 50);
    } else {
      const maxScroll = this.items.scrollHeight - this.items.offsetHeight;
      toggle(this.arrowLeft, this.items.scrollTop > 50);
      toggle(this.arrowRight, this.items.scrollTop < maxScroll - 50);
    }
  }
};

// src/GalleryPlugin.ts
var getConfig = utils3.getConfigParser({
  items: [],
  navigationArrows: true,
  visibleOnLoad: false,
  hideOnClick: true,
  thumbnailSize: {
    width: 200,
    height: 100
  }
});
var _GalleryPlugin = class _GalleryPlugin extends AbstractConfigurablePlugin {
  constructor(viewer, config) {
    super(viewer, config);
    this.items = [];
    this.gallery = new GalleryComponent(this, this.viewer);
  }
  static withConfig(config) {
    return [_GalleryPlugin, config];
  }
  /**
   * @internal
   */
  init() {
    super.init();
    utils3.checkStylesheet(this.viewer.container, "gallery-plugin");
    this.map = this.viewer.getPlugin("map");
    this.plan = this.viewer.getPlugin("plan");
    this.viewer.addEventListener(events2.PanoramaLoadedEvent.type, this);
    this.viewer.addEventListener(events2.ShowPanelEvent.type, this);
    if (this.config.visibleOnLoad) {
      this.viewer.addEventListener(events2.ReadyEvent.type, () => {
        if (this.items.length) {
          this.show();
        }
      }, { once: true });
    }
    this.setItems(this.config.items);
    delete this.config.items;
    setTimeout(() => this.__updateButton());
  }
  /**
   * @internal
   */
  destroy() {
    this.viewer.removeEventListener(events2.PanoramaLoadedEvent.type, this);
    this.viewer.removeEventListener(events2.ShowPanelEvent.type, this);
    this.gallery.destroy();
    super.destroy();
  }
  setOptions(options) {
    super.setOptions(options);
    if (options.thumbnailSize) {
      this.gallery.setItems(this.items);
    }
  }
  /**
   * @internal
   */
  handleEvent(e) {
    if (e instanceof events2.PanoramaLoadedEvent) {
      const item = this.items.find((i) => utils3.deepEqual(i.panorama, e.data.panorama));
      this.currentId = item?.id;
      this.gallery.setActive(this.currentId);
    } else if (e instanceof events2.ShowPanelEvent) {
      this.gallery.isVisible() && this.hide();
    }
  }
  /**
   * Shows the gallery
   */
  show() {
    this.map?.minimize();
    this.plan?.minimize();
    this.dispatchEvent(new ShowGalleryEvent(!this.gallery.isAboveBreakpoint));
    return this.gallery.show();
  }
  /**
   * Hides the carousem
   */
  hide() {
    this.dispatchEvent(new HideGalleryEvent());
    return this.gallery.hide();
  }
  /**
   * Hides or shows the gallery
   */
  toggle() {
    if (this.gallery.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }
  isVisible() {
    return this.gallery.isVisible();
  }
  /**
   * Sets the list of items
   * @param items
   * @param [handler] function that will be called when an item is clicked instead of the default behavior
   * @throws {@link PSVError} if the configuration is invalid
   */
  setItems(items, handler) {
    if (!items) {
      items = [];
    } else {
      items.forEach((item, i) => {
        if (!item.id) {
          throw new PSVError(`Item ${i} has no "id".`);
        }
        if (!item.panorama) {
          throw new PSVError(`Item "${item.id}" has no "panorama".`);
        }
      });
    }
    this.handler = handler;
    this.items = items.map((item) => ({
      ...item,
      id: `${item.id}`
    }));
    this.gallery.setItems(this.items);
    if (this.currentId) {
      const item = this.items.find((i) => i.id === this.currentId);
      this.currentId = item?.id;
      this.gallery.setActive(this.currentId);
    }
    if (!this.items.length) {
      this.gallery.hide();
    }
    this.__updateButton();
  }
  /**
   * @internal
   */
  applyItem(id) {
    if (id === this.currentId) {
      return;
    }
    if (this.handler) {
      this.handler(id);
    } else {
      const item = this.items.find((i) => i.id === id);
      this.viewer.setPanorama(item.panorama, {
        caption: item.name,
        ...item.options
      });
    }
    this.currentId = id;
  }
  __updateButton() {
    this.viewer.navbar.getButton(GalleryButton.id, false)?.toggle(this.items.length > 0);
  }
};
_GalleryPlugin.id = "gallery";
_GalleryPlugin.VERSION = "5.14.3";
_GalleryPlugin.configParser = getConfig;
_GalleryPlugin.readonlyOptions = ["items", "navigationArrows", "visibleOnLoad"];
var GalleryPlugin = _GalleryPlugin;

// src/index.ts
DEFAULTS.lang[GalleryButton.id] = "Gallery";
registerButton(GalleryButton, "caption:left");
export {
  GalleryPlugin,
  events_exports as events
};
//# sourceMappingURL=index.module.js.map