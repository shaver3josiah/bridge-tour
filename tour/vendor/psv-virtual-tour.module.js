/*!
 * Photo Sphere Viewer / Virtual Tour Plugin 5.14.3
 * @copyright 2015-2026 Damien "Mistic" Sorel
 * @licence MIT (https://opensource.org/licenses/MIT)
 */
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/events.ts
var events_exports = {};
__export(events_exports, {
  EnterArrowEvent: () => EnterArrowEvent,
  LeaveArrowEvent: () => LeaveArrowEvent,
  NodeChangedEvent: () => NodeChangedEvent
});
import { TypedEvent } from "@photo-sphere-viewer/core";
var _NodeChangedEvent = class _NodeChangedEvent extends TypedEvent {
  /** @internal */
  constructor(node, data) {
    super(_NodeChangedEvent.type);
    this.node = node;
    this.data = data;
  }
};
_NodeChangedEvent.type = "node-changed";
var NodeChangedEvent = _NodeChangedEvent;
var _EnterArrowEvent = class _EnterArrowEvent extends TypedEvent {
  /** @internal */
  constructor(link, node) {
    super(_EnterArrowEvent.type);
    this.link = link;
    this.node = node;
  }
};
_EnterArrowEvent.type = "enter-arrow";
var EnterArrowEvent = _EnterArrowEvent;
var _LeaveArrowEvent = class _LeaveArrowEvent extends TypedEvent {
  /** @internal */
  constructor(link, node) {
    super(_LeaveArrowEvent.type);
    this.link = link;
    this.node = node;
  }
};
_LeaveArrowEvent.type = "leave-arrow";
var LeaveArrowEvent = _LeaveArrowEvent;

// src/VirtualTourPlugin.ts
import { AbstractConfigurablePlugin, PSVError as PSVError4, events as events2, utils as utils5 } from "@photo-sphere-viewer/core";
import { MathUtils as MathUtils3 } from "three";

// src/ArrowsRenderer.ts
import { AbstractComponent, events, utils } from "@photo-sphere-viewer/core";
import { MathUtils, PerspectiveCamera, Scene } from "three";

// ../../node_modules/three/examples/jsm/renderers/CSS2DRenderer.js
import {
  Matrix4,
  Object3D,
  Vector2,
  Vector3
} from "three";
var CSS2DObject = class extends Object3D {
  /**
   * Constructs a new CSS2D object.
   *
   * @param {HTMLElement} [element] - The DOM element.
   */
  constructor(element = document.createElement("div")) {
    super();
    this.isCSS2DObject = true;
    this.element = element;
    this.element.style.position = "absolute";
    this.element.style.userSelect = "none";
    this.element.setAttribute("draggable", false);
    this.center = new Vector2(0.5, 0.5);
    this.addEventListener("removed", function() {
      this.traverse(function(object) {
        if (object.element && object.element instanceof object.element.ownerDocument.defaultView.Element && object.element.parentNode !== null) {
          object.element.remove();
        }
      });
    });
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    this.element = source.element.cloneNode(true);
    this.center = source.center;
    return this;
  }
};
var _vector = new Vector3();
var _viewMatrix = new Matrix4();
var _viewProjectionMatrix = new Matrix4();
var _a = new Vector3();
var _b = new Vector3();
var CSS2DRenderer = class {
  /**
   * Constructs a new CSS2D renderer.
   *
   * @param {CSS2DRenderer~Parameters} [parameters] - The parameters.
   */
  constructor(parameters = {}) {
    const _this = this;
    let _width, _height;
    let _widthHalf, _heightHalf;
    const cache = {
      objects: /* @__PURE__ */ new WeakMap()
    };
    const domElement = parameters.element !== void 0 ? parameters.element : document.createElement("div");
    domElement.style.overflow = "hidden";
    this.domElement = domElement;
    this.sortObjects = true;
    this.getSize = function() {
      return {
        width: _width,
        height: _height
      };
    };
    this.render = function(scene, camera) {
      if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld();
      if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();
      _viewMatrix.copy(camera.matrixWorldInverse);
      _viewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, _viewMatrix);
      renderObject(scene, scene, camera);
      if (this.sortObjects) zOrder(scene);
    };
    this.setSize = function(width, height) {
      _width = width;
      _height = height;
      _widthHalf = _width / 2;
      _heightHalf = _height / 2;
      domElement.style.width = width + "px";
      domElement.style.height = height + "px";
    };
    function hideObject(object) {
      if (object.isCSS2DObject) object.element.style.display = "none";
      for (let i = 0, l = object.children.length; i < l; i++) {
        hideObject(object.children[i]);
      }
    }
    function renderObject(object, scene, camera) {
      if (object.visible === false) {
        hideObject(object);
        return;
      }
      if (object.isCSS2DObject) {
        _vector.setFromMatrixPosition(object.matrixWorld);
        _vector.applyMatrix4(_viewProjectionMatrix);
        const visible = _vector.z >= -1 && _vector.z <= 1 && object.layers.test(camera.layers) === true;
        const element = object.element;
        element.style.display = visible === true ? "" : "none";
        if (visible === true) {
          object.onBeforeRender(_this, scene, camera);
          element.style.transform = "translate(" + -100 * object.center.x + "%," + -100 * object.center.y + "%)translate(" + (_vector.x * _widthHalf + _widthHalf) + "px," + (-_vector.y * _heightHalf + _heightHalf) + "px)";
          if (element.parentNode !== domElement) {
            domElement.appendChild(element);
          }
          object.onAfterRender(_this, scene, camera);
        }
        const objectData = {
          distanceToCameraSquared: getDistanceToSquared(camera, object)
        };
        cache.objects.set(object, objectData);
      }
      for (let i = 0, l = object.children.length; i < l; i++) {
        renderObject(object.children[i], scene, camera);
      }
    }
    function getDistanceToSquared(object1, object2) {
      _a.setFromMatrixPosition(object1.matrixWorld);
      _b.setFromMatrixPosition(object2.matrixWorld);
      return _a.distanceToSquared(_b);
    }
    function filterAndFlatten(scene) {
      const result = [];
      scene.traverseVisible(function(object) {
        if (object.isCSS2DObject) result.push(object);
      });
      return result;
    }
    function zOrder(scene) {
      const sorted = filterAndFlatten(scene).sort(function(a, b) {
        if (a.renderOrder !== b.renderOrder) {
          return b.renderOrder - a.renderOrder;
        }
        const distanceA = cache.objects.get(a).distanceToCameraSquared;
        const distanceB = cache.objects.get(b).distanceToCameraSquared;
        return distanceA - distanceB;
      });
      const zMax = sorted.length;
      for (let i = 0, l = sorted.length; i < l; i++) {
        sorted[i].element.style.zIndex = zMax - i;
      }
    }
  }
};

// ../../node_modules/three/examples/jsm/renderers/CSS3DRenderer.js
import {
  Matrix4 as Matrix42,
  Object3D as Object3D2,
  Quaternion,
  Vector3 as Vector32
} from "three";
var _position = new Vector32();
var _quaternion = new Quaternion();
var _scale = new Vector32();
var CSS3DObject = class extends Object3D2 {
  /**
   * Constructs a new CSS3D object.
   *
   * @param {HTMLElement} [element] - The DOM element.
   */
  constructor(element = document.createElement("div")) {
    super();
    this.isCSS3DObject = true;
    this.element = element;
    this.element.style.position = "absolute";
    this.element.style.pointerEvents = "auto";
    this.element.style.userSelect = "none";
    this.element.setAttribute("draggable", false);
    this.addEventListener("removed", function() {
      this.traverse(function(object) {
        if (object.element && object.element instanceof object.element.ownerDocument.defaultView.Element && object.element.parentNode !== null) {
          object.element.remove();
        }
      });
    });
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    this.element = source.element.cloneNode(true);
    return this;
  }
};
var _matrix = new Matrix42();
var _matrix2 = new Matrix42();
var CSS3DRenderer = class {
  /**
   * Constructs a new CSS3D renderer.
   *
   * @param {CSS3DRenderer~Parameters} [parameters] - The parameters.
   */
  constructor(parameters = {}) {
    const _this = this;
    let _width, _height;
    let _widthHalf, _heightHalf;
    const cache = {
      camera: { style: "" },
      objects: /* @__PURE__ */ new WeakMap()
    };
    const domElement = parameters.element !== void 0 ? parameters.element : document.createElement("div");
    domElement.style.overflow = "hidden";
    this.domElement = domElement;
    const viewElement = document.createElement("div");
    viewElement.style.transformOrigin = "0 0";
    viewElement.style.pointerEvents = "none";
    domElement.appendChild(viewElement);
    const cameraElement = document.createElement("div");
    cameraElement.style.transformStyle = "preserve-3d";
    viewElement.appendChild(cameraElement);
    this.getSize = function() {
      return {
        width: _width,
        height: _height
      };
    };
    this.render = function(scene, camera) {
      const fov = camera.projectionMatrix.elements[5] * _heightHalf;
      if (camera.view && camera.view.enabled) {
        viewElement.style.transform = `translate( ${-camera.view.offsetX * (_width / camera.view.width)}px, ${-camera.view.offsetY * (_height / camera.view.height)}px )`;
        viewElement.style.transform += `scale( ${camera.view.fullWidth / camera.view.width}, ${camera.view.fullHeight / camera.view.height} )`;
      } else {
        viewElement.style.transform = "";
      }
      if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld();
      if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();
      let tx, ty;
      if (camera.isOrthographicCamera) {
        tx = -(camera.right + camera.left) / 2;
        ty = (camera.top + camera.bottom) / 2;
      }
      const scaleByViewOffset = camera.view && camera.view.enabled ? camera.view.height / camera.view.fullHeight : 1;
      const cameraCSSMatrix = camera.isOrthographicCamera ? `scale( ${scaleByViewOffset} )scale(` + fov + ")translate(" + epsilon(tx) + "px," + epsilon(ty) + "px)" + getCameraCSSMatrix(camera.matrixWorldInverse) : `scale( ${scaleByViewOffset} )translateZ(` + fov + "px)" + getCameraCSSMatrix(camera.matrixWorldInverse);
      const perspective = camera.isPerspectiveCamera ? "perspective(" + fov + "px) " : "";
      const style = perspective + cameraCSSMatrix + "translate(" + _widthHalf + "px," + _heightHalf + "px)";
      if (cache.camera.style !== style) {
        cameraElement.style.transform = style;
        cache.camera.style = style;
      }
      renderObject(scene, scene, camera, cameraCSSMatrix);
    };
    this.setSize = function(width, height) {
      _width = width;
      _height = height;
      _widthHalf = _width / 2;
      _heightHalf = _height / 2;
      domElement.style.width = width + "px";
      domElement.style.height = height + "px";
      viewElement.style.width = width + "px";
      viewElement.style.height = height + "px";
      cameraElement.style.width = width + "px";
      cameraElement.style.height = height + "px";
    };
    function epsilon(value) {
      return Math.abs(value) < 1e-10 ? 0 : value;
    }
    function getCameraCSSMatrix(matrix) {
      const elements = matrix.elements;
      return "matrix3d(" + epsilon(elements[0]) + "," + epsilon(-elements[1]) + "," + epsilon(elements[2]) + "," + epsilon(elements[3]) + "," + epsilon(elements[4]) + "," + epsilon(-elements[5]) + "," + epsilon(elements[6]) + "," + epsilon(elements[7]) + "," + epsilon(elements[8]) + "," + epsilon(-elements[9]) + "," + epsilon(elements[10]) + "," + epsilon(elements[11]) + "," + epsilon(elements[12]) + "," + epsilon(-elements[13]) + "," + epsilon(elements[14]) + "," + epsilon(elements[15]) + ")";
    }
    function getObjectCSSMatrix(matrix) {
      const elements = matrix.elements;
      const matrix3d = "matrix3d(" + epsilon(elements[0]) + "," + epsilon(elements[1]) + "," + epsilon(elements[2]) + "," + epsilon(elements[3]) + "," + epsilon(-elements[4]) + "," + epsilon(-elements[5]) + "," + epsilon(-elements[6]) + "," + epsilon(-elements[7]) + "," + epsilon(elements[8]) + "," + epsilon(elements[9]) + "," + epsilon(elements[10]) + "," + epsilon(elements[11]) + "," + epsilon(elements[12]) + "," + epsilon(elements[13]) + "," + epsilon(elements[14]) + "," + epsilon(elements[15]) + ")";
      return "translate(-50%,-50%)" + matrix3d;
    }
    function hideObject(object) {
      if (object.isCSS3DObject) object.element.style.display = "none";
      for (let i = 0, l = object.children.length; i < l; i++) {
        hideObject(object.children[i]);
      }
    }
    function renderObject(object, scene, camera, cameraCSSMatrix) {
      if (object.visible === false) {
        hideObject(object);
        return;
      }
      if (object.isCSS3DObject) {
        const visible = object.layers.test(camera.layers) === true;
        const element = object.element;
        element.style.display = visible === true ? "" : "none";
        if (visible === true) {
          object.onBeforeRender(_this, scene, camera);
          let style;
          if (object.isCSS3DSprite) {
            _matrix.copy(camera.matrixWorldInverse);
            _matrix.transpose();
            if (object.rotation2D !== 0) _matrix.multiply(_matrix2.makeRotationZ(object.rotation2D));
            object.matrixWorld.decompose(_position, _quaternion, _scale);
            _matrix.setPosition(_position);
            _matrix.scale(_scale);
            _matrix.elements[3] = 0;
            _matrix.elements[7] = 0;
            _matrix.elements[11] = 0;
            _matrix.elements[15] = 1;
            style = getObjectCSSMatrix(_matrix);
          } else {
            style = getObjectCSSMatrix(object.matrixWorld);
          }
          const cachedObject = cache.objects.get(object);
          if (cachedObject === void 0 || cachedObject.style !== style) {
            element.style.transform = style;
            const objectData = { style };
            cache.objects.set(object, objectData);
          }
          if (element.parentNode !== cameraElement) {
            cameraElement.appendChild(element);
          }
          object.onAfterRender(_this, scene, camera);
        }
      }
      for (let i = 0, l = object.children.length; i < l; i++) {
        renderObject(object.children[i], scene, camera, cameraCSSMatrix);
      }
    }
  }
};

// src/arrow.svg
var arrow_default = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n    <path fill-rule="even-odd" fill="currentColor" d="\n        M50,50 m45,0\n        a45,45 0 1,0 -90,0\n        a45,45 0 1,0  90,0\n\n        M50,50 m38,0\n        a38,38 0 0,1 -76,0\n        a38,38 0 0,1  76,0\n\n        M50,50 m30,0\n        a30,30 0 1,0 -60,0\n        a30,30 0 1,0  60,0\n        \n        M50,40 m2.5,-2.5\n        l17.5,17.5\n        a 2.5,2.5 0 0 1 -5,5\n        l-15,-15\n        l-15,15\n        a 2.5,2.5 0 0 1 -5,-5\n        l17.5,-17.5\n        a 3.5,3.5 0 0 1 5,0\n    "/>\n</svg>';

// src/constants.ts
var LINK_DATA = "tourLink";
var LINK_ID = "__tour-link__";
var LOADING_TOOLTIP = {
  className: "psv-virtual-tour-tooltip",
  content: `<div class="psv-virtual-tour-loader"><div></div><div></div><div></div></div>`
};
var DEFAULT_ARROW = {
  element: () => {
    const button = document.createElement("button");
    button.className = "psv-virtual-tour-arrow";
    button.innerHTML = arrow_default;
    return button;
  },
  size: { width: 80, height: 80 }
};

// src/ArrowsRenderer.ts
var ARROW_DATA = "arrow";
var ArrowsRenderer = class extends AbstractComponent {
  constructor(parent, plugin) {
    super(parent, {
      className: "psv-virtual-tour-arrows"
    });
    this.plugin = plugin;
    this.renderer = this.is3D ? new CSS3DRenderer({
      element: this.container
    }) : new CSS2DRenderer({
      element: this.container
    });
    this.camera = this.is3D ? new PerspectiveCamera(30, 1) : null;
    this.scene = new Scene();
    this.viewer.addEventListener(events.ReadyEvent.type, this, { once: true });
    this.viewer.addEventListener(events.PositionUpdatedEvent.type, this);
    this.viewer.addEventListener(events.SizeUpdatedEvent.type, this);
    this.viewer.addEventListener(events.RenderEvent.type, this);
    this.viewer.addEventListener(events.ClickEvent.type, this);
    this.container.addEventListener("mouseenter", this, true);
    this.container.addEventListener("mouseleave", this, true);
    this.container.addEventListener("mousemove", this, true);
    this.container.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  get is3D() {
    return this.plugin.is3D;
  }
  get arrowsPosition() {
    return this.plugin.config.arrowsPosition;
  }
  get arrowStyle() {
    return this.plugin.config.arrowStyle;
  }
  init() {
    if (this.is3D) {
      this.gallery = this.viewer.getPlugin("gallery");
      this.gallery?.addEventListener("show-gallery", this);
      this.gallery?.addEventListener("hide-gallery", this);
    }
  }
  destroy() {
    this.viewer.removeEventListener(events.ReadyEvent.type, this);
    this.viewer.removeEventListener(events.PositionUpdatedEvent.type, this);
    this.viewer.removeEventListener(events.SizeUpdatedEvent.type, this);
    this.viewer.removeEventListener(events.RenderEvent.type, this);
    this.viewer.removeEventListener(events.ClickEvent.type, this);
    this.gallery?.removeEventListener("show-gallery", this);
    this.gallery?.removeEventListener("hide-gallery", this);
    super.destroy();
  }
  handleEvent(e) {
    switch (e.type) {
      case events.ReadyEvent.type:
      case events.SizeUpdatedEvent.type:
      case events.PositionUpdatedEvent.type:
        this.__updateCamera();
        break;
      case events.RenderEvent.type:
        this.render();
        break;
      case events.ClickEvent.type: {
        if (e.data.rightclick) {
          break;
        }
        const link = this.__getTargetLink(e.data.target, true);
        if (link) {
          this.plugin.setCurrentNode(link.nodeId, null, link);
        }
        break;
      }
      case "mouseenter": {
        const link = this.__getTargetLink(utils.getEventTarget(e));
        if (link) {
          this.plugin.__onEnterArrow(link, e);
        }
        break;
      }
      case "mouseleave": {
        const link = this.__getTargetLink(utils.getEventTarget(e));
        if (link) {
          this.plugin.__onLeaveArrow(link);
        }
        break;
      }
      case "mousemove": {
        const link = this.__getTargetLink(utils.getEventTarget(e), true);
        if (link) {
          this.plugin.__onHoverArrow(e);
        }
        break;
      }
      case "hide-gallery":
        this.__onToggleGallery(false);
        break;
      case "show-gallery":
        if (!e.fullscreen) {
          this.__onToggleGallery(true);
        }
        break;
    }
  }
  __updateCamera() {
    const size = this.viewer.getSize();
    this.renderer.setSize(size.width, size.height);
    if (this.is3D) {
      const position = this.viewer.getPosition();
      position.pitch = MathUtils.clamp(position.pitch, -this.arrowsPosition.maxPitch, -this.arrowsPosition.minPitch);
      this.viewer.dataHelper.sphericalCoordsToVector3(
        position,
        this.camera.position,
        size.height * 2
      ).negate();
      this.camera.lookAt(0, 0, 0);
      this.camera.translateY(size.height / 3);
      this.camera.updateProjectionMatrix();
    }
  }
  render() {
    if (this.is3D) {
      const position = this.viewer.getPosition();
      const objectsAndDist = [];
      let minDist = Number.MAX_SAFE_INTEGER;
      this.scene.children.forEach((object) => {
        const data = object.userData[ARROW_DATA];
        if (data.conflict) {
          const distance2 = Math.abs(utils.getShortestArc(position.yaw, data.yaw));
          minDist = Math.min(minDist, distance2);
          objectsAndDist.push([object, distance2]);
        }
      });
      objectsAndDist.forEach(([object, distance2]) => {
        const fade = distance2 !== minDist;
        object.element.style.opacity = fade ? "0.5" : null;
        object.element.style.zIndex = fade ? "-1" : null;
      });
      this.renderer.render(this.scene, this.camera);
    } else {
      this.renderer.render(this.scene, this.viewer.renderer.camera);
    }
  }
  clear() {
    this.scene.clear();
  }
  __buildArrowElement(link, style) {
    if (style?.image) {
      const image = document.createElement("img");
      image.src = style.image;
      return image;
    } else if (style?.element) {
      if (typeof style.element === "function") {
        return style.element(link);
      } else {
        return style.element;
      }
    }
  }
  addLinkArrow(link, position, depth = 1) {
    let element = this.__buildArrowElement(link, link.arrowStyle);
    if (!element) {
      element = this.__buildArrowElement(link, this.arrowStyle);
    }
    element[LINK_DATA] = link;
    const conf = {
      ...this.arrowStyle,
      ...link.arrowStyle
    };
    element.classList.add("psv-virtual-tour-link");
    if (conf.className) {
      utils.addClasses(element, conf.className);
    }
    if (conf.style) {
      Object.assign(element.style, conf.style);
    }
    if (this.is3D) {
      element.style.width = conf.size.width * 1.5 + "px";
      element.style.height = conf.size.height * 1.5 + "px";
      let conflict = false;
      this.scene.children.forEach((object2) => {
        const data = object2.userData[ARROW_DATA];
        if (Math.abs(utils.getShortestArc(data.yaw, position.yaw)) < this.arrowsPosition.linkOverlapAngle) {
          data.conflict = true;
          conflict = true;
        }
      });
      const object = new CSS3DObject(element);
      object.userData[ARROW_DATA] = { yaw: position.yaw, conflict };
      object.rotation.set(-Math.PI / 2, 0, Math.PI - position.yaw);
      this.viewer.dataHelper.sphericalCoordsToVector3(
        { yaw: position.yaw, pitch: 0 },
        object.position,
        depth * 100
      );
      this.scene.add(object);
    } else {
      element.style.width = conf.size.width + "px";
      element.style.height = conf.size.height + "px";
      element.style.pointerEvents = "auto";
      const object = new CSS2DObject(element);
      this.viewer.dataHelper.sphericalCoordsToVector3(
        position,
        object.position
      );
      this.scene.add(object);
    }
  }
  __getTargetLink(target, closest = false) {
    const target2 = closest ? utils.getClosest(target, ".psv-virtual-tour-link") : target;
    return target2 ? target2[LINK_DATA] : void 0;
  }
  __onToggleGallery(visible) {
    if (!visible) {
      this.container.style.marginBottom = "";
    } else {
      this.container.style.marginBottom = this.viewer.container.querySelector(".psv-gallery").offsetHeight + "px";
    }
  }
};

// src/datasources/ClientSideDatasource.ts
import { PSVError as PSVError2, utils as utils3 } from "@photo-sphere-viewer/core";

// src/datasources/AbstractDataSource.ts
import { PSVError, utils as utils2 } from "@photo-sphere-viewer/core";
var AbstractDatasource = class {
  constructor(plugin, viewer) {
    this.plugin = plugin;
    this.viewer = viewer;
    this.nodes = {};
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  destroy() {
  }
  /**
   * Checks the configuration of a node
   */
  checkNode(node) {
    if (!node.id) {
      throw new PSVError("No id given for node");
    }
    if (!node.panorama) {
      throw new PSVError(`No panorama provided for node ${node.id}`);
    }
    if (this.plugin.isGps && !(node.gps?.length >= 2)) {
      throw new PSVError(`No GPS position provided for node ${node.id}`);
    }
    if (!this.plugin.isGps && node.markers?.some((marker) => marker.gps && !marker.position)) {
      throw new PSVError(`Cannot use GPS positioning for markers in manual mode`);
    }
    if (!node.links) {
      utils2.logWarn(`Node ${node.id} has no links`);
      node.links = [];
    }
  }
  /**
   * Checks the configuration of a link
   */
  checkLink(node, link) {
    if (!link.nodeId) {
      throw new PSVError(`Link of node ${node.id} has no target id`);
    }
    if (link.nodeId === node.id) {
      throw new PSVError(`Node ${node.id} links to itself`);
    }
    if (!this.plugin.isGps && !utils2.isExtendedPosition(link.position)) {
      throw new PSVError(`No position provided for link ${link.nodeId} of node ${node.id}`);
    }
    if (this.plugin.isGps && !link.gps) {
      throw new PSVError(`No GPS position provided for link ${link.nodeId} of node ${node.id}`);
    }
  }
};

// src/datasources/ClientSideDatasource.ts
var ClientSideDatasource = class extends AbstractDatasource {
  async loadNode(nodeId) {
    if (this.nodes[nodeId]) {
      return this.nodes[nodeId];
    } else {
      throw new PSVError2(`Node ${nodeId} not found`);
    }
  }
  setNodes(rawNodes) {
    if (!rawNodes?.length) {
      throw new PSVError2("No nodes provided");
    }
    const nodes = {};
    const linkedNodes = {};
    rawNodes.forEach((node) => {
      this.checkNode(node);
      if (nodes[node.id]) {
        throw new PSVError2(`Duplicate node ${node.id}`);
      }
      nodes[node.id] = node;
    });
    rawNodes.forEach((node) => {
      this.__checkLinks(node, nodes);
      node.links.forEach((link) => {
        linkedNodes[link.nodeId] = true;
      });
    });
    rawNodes.forEach((node) => {
      if (!linkedNodes[node.id]) {
        utils3.logWarn(`Node ${node.id} is never linked to`);
      }
    });
    this.nodes = nodes;
  }
  updateNode(rawNode) {
    if (!rawNode.id) {
      throw new PSVError2("No id given for node");
    }
    const node = this.nodes[rawNode.id];
    if (!node) {
      throw new PSVError2(`Node ${rawNode.id} does not exist`);
    }
    Object.assign(node, rawNode);
    this.checkNode(node);
    this.__checkLinks(node, this.nodes);
    return node;
  }
  __checkLinks(node, nodes) {
    node.links.forEach((link) => {
      if (!nodes[link.nodeId]) {
        throw new PSVError2(`Target node ${link.nodeId} of node ${node.id} does not exists`);
      }
      link.gps = link.gps || nodes[link.nodeId].gps;
      this.checkLink(node, link);
    });
  }
};

// src/datasources/ServerSideDatasource.ts
import { PSVError as PSVError3 } from "@photo-sphere-viewer/core";
var ServerSideDatasource = class extends AbstractDatasource {
  constructor(plugin, viewer) {
    super(plugin, viewer);
    if (!plugin.config.getNode) {
      throw new PSVError3("Missing getNode() option.");
    }
    this.nodeResolver = plugin.config.getNode;
  }
  async loadNode(nodeId) {
    if (this.nodes[nodeId]) {
      return this.nodes[nodeId];
    } else {
      const node = await this.nodeResolver(nodeId);
      this.checkNode(node);
      node.links.forEach((link) => {
        this.checkLink(node, link);
      });
      this.nodes[nodeId] = node;
      return node;
    }
  }
  clearCache() {
    this.nodes = {};
  }
};

// src/utils.ts
import { utils as utils4 } from "@photo-sphere-viewer/core";
import { MathUtils as MathUtils2 } from "three";
function gpsToSpherical(gps1, gps2) {
  const p1 = gpsDegToRad(gps1);
  const p2 = gpsDegToRad(gps2);
  const h1 = gps1[2] ?? 0;
  const h2 = gps2[2] ?? 0;
  let pitch = 0;
  if (h1 !== h2) {
    pitch = Math.atan((h2 - h1) / distance(p1, p2));
  }
  const yaw = bearing(p1, p2);
  return { yaw, pitch };
}
function gpsDegToRad(gps) {
  return [MathUtils2.degToRad(gps[0]), MathUtils2.degToRad(gps[1])];
}
function distance(p1, p2) {
  return utils4.greatArcDistance(p1, p2) * 6371e3;
}
function bearing(p1, p2) {
  const [long1, lat1] = p1;
  const [long2, lat2] = p2;
  const y = Math.sin(long2 - long1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(long2 - long1);
  return Math.atan2(y, x);
}

// src/VirtualTourPlugin.ts
var getConfig = utils5.getConfigParser(
  {
    dataMode: "client",
    positionMode: "manual",
    renderMode: "3d",
    nodes: null,
    getNode: null,
    startNodeId: null,
    preload: false,
    transitionOptions: {
      showLoader: true,
      speed: "20rpm",
      effect: "fade",
      rotation: true
    },
    linksOnCompass: true,
    showLinkTooltip: true,
    getLinkTooltip: null,
    arrowStyle: DEFAULT_ARROW,
    arrowsPosition: {
      minPitch: 0.3,
      maxPitch: Math.PI / 2,
      linkOverlapAngle: Math.PI / 4,
      linkPitchOffset: -0.1
    },
    map: null
  },
  {
    dataMode(dataMode) {
      if (dataMode !== "client" && dataMode !== "server") {
        throw new PSVError4("VirtualTourPlugin: invalid dataMode");
      }
      return dataMode;
    },
    positionMode(positionMode) {
      if (positionMode !== "gps" && positionMode !== "manual") {
        throw new PSVError4("VirtualTourPlugin: invalid positionMode");
      }
      return positionMode;
    },
    renderMode(renderMode) {
      if (renderMode !== "3d" && renderMode !== "2d") {
        throw new PSVError4("VirtualTourPlugin: invalid renderMode");
      }
      return renderMode;
    },
    arrowsPosition(arrowsPosition, { defValue }) {
      return { ...defValue, ...arrowsPosition };
    },
    arrowStyle(arrowStyle, { defValue }) {
      return { ...defValue, ...arrowStyle };
    },
    map(map, { rawConfig }) {
      if (map) {
        if (rawConfig.dataMode === "server") {
          utils5.logWarn("VirtualTourPlugin: The map cannot be used in server side mode");
          return null;
        }
        if (!map.imageUrl) {
          utils5.logWarn('VirtualTourPlugin: configuring the map requires at least "imageUrl"');
          return null;
        }
        if (!("recenter" in map)) {
          map.recenter = true;
        }
      }
      return map;
    }
  }
);
var _VirtualTourPlugin = class _VirtualTourPlugin extends AbstractConfigurablePlugin {
  constructor(viewer, config) {
    super(viewer, config);
    this.state = {
      currentNode: null,
      currentTooltip: null,
      loadingNode: null,
      preload: {}
    };
    this.arrowsRenderer = new ArrowsRenderer(this.viewer, this);
  }
  get is3D() {
    return this.config.renderMode === "3d";
  }
  get isServerSide() {
    return this.config.dataMode === "server";
  }
  get isGps() {
    return this.config.positionMode === "gps";
  }
  static withConfig(config) {
    return [_VirtualTourPlugin, config];
  }
  /**
   * @internal
   */
  init() {
    super.init();
    this.arrowsRenderer.init();
    utils5.checkStylesheet(this.viewer.container, "virtual-tour-plugin");
    this.markers = this.viewer.getPlugin("markers");
    this.compass = this.viewer.getPlugin("compass");
    if (this.markers?.config.markers) {
      utils5.logWarn(
        "No default markers can be configured on the MarkersPlugin when using the VirtualTourPlugin. Consider defining `markers` on each tour node."
      );
      delete this.markers.config.markers;
    }
    if (this.isGps) {
      this.plan = this.viewer.getPlugin("plan");
    }
    if (!this.isServerSide) {
      this.gallery = this.viewer.getPlugin("gallery");
      this.map = this.viewer.getPlugin("map");
      if (this.config.map && !this.map) {
        utils5.logWarn("The map is configured on the VirtualTourPlugin but the MapPlugin is not loaded.");
      }
    }
    this.datasource = this.isServerSide ? new ServerSideDatasource(this, this.viewer) : new ClientSideDatasource(this, this.viewer);
    if (this.map) {
      this.map.addEventListener("select-hotspot", this);
      this.map.setImage(this.config.map.imageUrl);
    }
    this.plan?.addEventListener("select-hotspot", this);
    if (this.isServerSide) {
      if (this.config.startNodeId) {
        this.setCurrentNode(this.config.startNodeId);
      }
    } else if (this.config.nodes) {
      this.setNodes(this.config.nodes, this.config.startNodeId);
      delete this.config.nodes;
    }
  }
  /**
   * @internal
   */
  destroy() {
    this.map?.removeEventListener("select-hotspot", this);
    this.plan?.removeEventListener("select-hotspot", this);
    this.datasource.destroy();
    this.arrowsRenderer.destroy();
    delete this.datasource;
    delete this.markers;
    delete this.compass;
    delete this.gallery;
    delete this.arrowsRenderer;
    super.destroy();
  }
  /**
   * @internal
   */
  handleEvent(e) {
    if (e instanceof events2.ClickEvent) {
      const link = e.data.objects.find((o) => o.userData[LINK_DATA])?.userData[LINK_DATA];
      if (link) {
        this.setCurrentNode(link.nodeId, null, link);
      }
    } else if (e.type === "select-hotspot") {
      const id = e.hotspotId;
      if (id.startsWith(LINK_ID)) {
        this.setCurrentNode(id.substring(LINK_ID.length));
      }
    }
  }
  /**
   * Returns the current node
   */
  getCurrentNode() {
    return this.state.currentNode;
  }
  /**
   * Sets the nodes (client mode only)
   * @throws {@link PSVError} if not in client mode
   */
  setNodes(nodes, startNodeId) {
    if (this.isServerSide) {
      throw new PSVError4("Cannot set nodes in server side mode");
    }
    this.__hideTooltip();
    this.state.currentNode = null;
    this.datasource.setNodes(nodes);
    if (!startNodeId) {
      startNodeId = nodes[0].id;
    } else if (!this.datasource.nodes[startNodeId]) {
      startNodeId = nodes[0].id;
      utils5.logWarn(`startNodeId not found is provided nodes, resetted to ${startNodeId}`);
    }
    this.setCurrentNode(startNodeId);
    this.__setGalleryItems();
    this.__setMapHotspots();
    this.__setPlanHotspots();
  }
  /**
   * Changes the current node
   * @returns {Promise<boolean>} resolves false if the loading was aborted by another call
   */
  setCurrentNode(nodeId, options, fromLink) {
    if (nodeId === this.state.currentNode?.id && !options?.forceUpdate) {
      return Promise.resolve(true);
    }
    if (options?.forceUpdate && this.isServerSide) {
      this.datasource.clearCache();
    }
    this.viewer.hideError();
    this.state.loadingNode = nodeId;
    const fromNode = this.state.currentNode;
    const fromLinkPosition = fromNode && fromLink ? this.__getLinkPosition(fromNode, fromLink) : null;
    return Promise.resolve(this.state.preload[nodeId]).then(() => {
      if (this.state.loadingNode !== nodeId) {
        throw utils5.getAbortError();
      }
      return this.datasource.loadNode(nodeId);
    }).then((node) => {
      if (this.state.loadingNode !== nodeId) {
        throw utils5.getAbortError();
      }
      const transitionOptions = {
        ...getConfig.defaults.transitionOptions,
        rotateTo: fromLinkPosition,
        zoomTo: fromLinkPosition ? this.viewer.getZoomLevel() : null,
        // prevents the adapter to apply InitialHorizontalFOVDegrees
        ...typeof this.config.transitionOptions === "function" ? this.config.transitionOptions(node, fromNode, fromLink) : this.config.transitionOptions,
        ...options
      };
      if (!transitionOptions.effect) {
        transitionOptions.effect = "none";
      }
      this.viewer.panel.hide("description");
      this.__hideTooltip();
      this.arrowsRenderer.clear();
      if (this.gallery?.config.hideOnClick) {
        this.gallery.hide();
      }
      if (this.map?.config.minimizeOnHotspotClick) {
        this.map.minimize();
      }
      if (this.plan?.config.minimizeOnHotspotClick) {
        this.plan.minimize();
      }
      if (transitionOptions.rotation && transitionOptions.effect === "none") {
        return this.viewer.animate({
          ...transitionOptions.rotateTo,
          zoom: transitionOptions.zoomTo,
          speed: transitionOptions.speed
        }).then(() => [node, transitionOptions]);
      } else {
        return Promise.resolve([node, transitionOptions]);
      }
    }).then(([node, transitionOptions]) => {
      if (this.state.loadingNode !== nodeId) {
        throw utils5.getAbortError();
      }
      this.markers?.clearMarkers();
      if (this.config.linksOnCompass) {
        this.compass?.clearHotspots();
      }
      return this.viewer.setPanorama(node.panorama, {
        caption: node.caption,
        description: node.description,
        panoData: node.panoData,
        sphereCorrection: node.sphereCorrection,
        showLoader: transitionOptions.showLoader,
        position: transitionOptions.rotateTo,
        zoom: transitionOptions.zoomTo,
        transition: transitionOptions.effect === "none" ? false : {
          effect: transitionOptions.effect,
          rotation: transitionOptions.rotation,
          speed: transitionOptions.speed
        }
      }).then((completed) => {
        if (!completed) {
          throw utils5.getAbortError();
        }
        return node;
      });
    }).then((node) => {
      if (this.state.loadingNode !== nodeId) {
        throw utils5.getAbortError();
      }
      this.state.currentNode = node;
      if (this.map) {
        this.map.setCenter(this.__getNodeMapPosition(node) ?? this.map.config.center, this.config.map.recenter);
      }
      this.plan?.setCoordinates(node.gps);
      this.__addNodeMarkers(node);
      this.__renderLinks(node);
      this.__preload(node);
      this.state.loadingNode = null;
      this.dispatchEvent(
        new NodeChangedEvent(node, {
          fromNode,
          fromLink,
          fromLinkPosition
        })
      );
      this.viewer.resetIdleTimer();
      return true;
    }).catch((err) => {
      if (utils5.isAbortError(err)) {
        return false;
      }
      this.viewer.showError(this.viewer.config.lang.loadError);
      this.viewer.loader.hide();
      this.viewer.navbar.setCaption("");
      this.state.loadingNode = null;
      throw err;
    });
  }
  /**
   * Rotate the view to face the link
   */
  async gotoLink(nodeId, speed = "8rpm") {
    const position = this.getLinkPosition(nodeId);
    if (!speed) {
      this.viewer.rotate(position);
    } else {
      await this.viewer.animate({
        ...position,
        speed
      });
    }
  }
  /**
   * Returns the position of a link in the viewer
   */
  getLinkPosition(nodeId) {
    const link = this.state.currentNode?.links.find((link2) => link2.nodeId === nodeId);
    if (!link) {
      throw new PSVError4(`Cannot find link "${nodeId}"`);
    }
    return this.__getLinkPosition(this.state.currentNode, link);
  }
  /**
   * Updates a node (client mode only)
   * All properties but "id" are optional, the new config will be merged with the previous
   * @throws {@link PSVError} if not in client mode
   */
  updateNode(newNode) {
    if (this.isServerSide) {
      throw new PSVError4("Cannot update node in server side mode");
    }
    const node = this.datasource.updateNode(newNode);
    if (newNode.name || newNode.thumbnail || newNode.panorama) {
      this.__setGalleryItems();
    }
    if (newNode.name || newNode.gps || newNode.map) {
      this.__setMapHotspots();
    }
    if (newNode.name || newNode.gps || newNode.plan) {
      this.__setPlanHotspots();
    }
    if (this.state.currentNode?.id === node.id) {
      this.__hideTooltip();
      if (newNode.panorama || newNode.panoData || newNode.sphereCorrection) {
        this.setCurrentNode(node.id, { forceUpdate: true });
        return;
      }
      if (newNode.caption) {
        this.viewer.setOption("caption", node.caption);
      }
      if (newNode.description) {
        this.viewer.setOption("description", node.description);
      }
      if (newNode.links || newNode.gps) {
        this.__renderLinks(node);
      }
      if (newNode.gps) {
        this.plan?.setCoordinates(node.gps);
      }
      if (newNode.map || newNode.gps) {
        this.map?.setCenter(this.__getNodeMapPosition(node));
      }
      if (newNode.markers || newNode.gps) {
        this.__addNodeMarkers(node);
      }
    }
  }
  /**
   * Updates the gallery plugin
   */
  __setGalleryItems() {
    if (this.gallery) {
      this.gallery.setItems(
        Object.values(this.datasource.nodes).filter((node) => node.showInGallery !== false).map((node) => ({
          id: node.id,
          panorama: node.panorama,
          name: node.name,
          thumbnail: node.thumbnail
        })),
        (id) => {
          this.setCurrentNode(id);
        }
      );
    }
  }
  /**
   * Update the map plugin
   */
  __setMapHotspots() {
    if (this.map) {
      this.map.setHotspots(
        Object.values(this.datasource.nodes).filter((node) => node.map !== false).map((node) => ({
          tooltip: node.name,
          ...node.map || {},
          ...this.__getNodeMapPosition(node),
          id: LINK_ID + node.id
        }))
      );
    }
  }
  /**
   * Updates the plan plugin
   */
  __setPlanHotspots() {
    if (this.plan) {
      this.plan.setHotspots(
        Object.values(this.datasource.nodes).filter((node) => node.plan !== false).map((node) => ({
          tooltip: node.name,
          ...node.plan || {},
          coordinates: node.gps,
          id: LINK_ID + node.id
        }))
      );
    }
  }
  /**
   * Adds the links for the node
   */
  __renderLinks(node) {
    this.arrowsRenderer.clear();
    const positions = [];
    node.links.forEach((link) => {
      const position = this.__getLinkPosition(node, link);
      position.yaw += link.linkOffset?.yaw ?? 0;
      position.pitch += link.linkOffset?.pitch ?? 0;
      if (this.isGps && !this.is3D) {
        position.pitch += this.config.arrowsPosition.linkPitchOffset;
      }
      positions.push(position);
      this.arrowsRenderer.addLinkArrow(link, position, link.linkOffset?.depth);
    });
    this.arrowsRenderer.render();
    if (this.config.linksOnCompass) {
      this.compass?.setHotspots(positions);
    }
  }
  /**
   * Computes the marker position for a link
   */
  __getLinkPosition(node, link) {
    if (this.isGps) {
      return gpsToSpherical(node.gps, link.gps);
    } else {
      return this.viewer.dataHelper.cleanPosition(link.position);
    }
  }
  /**
   * Returns the complete tootlip content for a node
   */
  async __getTooltipContent(link) {
    const node = await this.datasource.loadNode(link.nodeId);
    const elements = [];
    if (node.name || node.thumbnail || node.caption) {
      if (node.name) {
        elements.push(`<h3>${node.name}</h3>`);
      }
      if (node.thumbnail) {
        elements.push(`<img src="${node.thumbnail}">`);
      }
      if (node.caption) {
        elements.push(`<p>${node.caption}</p>`);
      }
    }
    let content = elements.join("");
    if (this.config.getLinkTooltip) {
      content = this.config.getLinkTooltip(content, link, node);
    }
    return content;
  }
  /** @internal */
  __onEnterArrow(link, evt) {
    const viewerPos = utils5.getPosition(this.viewer.container);
    const viewerPoint = {
      x: evt.clientX - viewerPos.x,
      y: evt.clientY - viewerPos.y
    };
    if (this.config.showLinkTooltip) {
      this.state.currentTooltip = this.viewer.createTooltip({
        ...LOADING_TOOLTIP,
        left: viewerPoint.x,
        top: viewerPoint.y,
        box: {
          // separate the tooltip from the cursor
          width: 20,
          height: 20
        }
      });
      this.__getTooltipContent(link).then((content) => {
        if (content) {
          this.state.currentTooltip.update(content);
        } else {
          this.__hideTooltip();
        }
      });
    }
    this.map?.setActiveHotspot(LINK_ID + link.nodeId);
    this.plan?.setActiveHotspot(LINK_ID + link.nodeId);
    this.dispatchEvent(new EnterArrowEvent(link, this.state.currentNode));
  }
  /** @internal */
  __onHoverArrow(evt) {
    const viewerPos = utils5.getPosition(this.viewer.container);
    const viewerPoint = {
      x: evt.clientX - viewerPos.x,
      y: evt.clientY - viewerPos.y
    };
    this.state.currentTooltip?.move({
      left: viewerPoint.x,
      top: viewerPoint.y
    });
  }
  /** @internal */
  __onLeaveArrow(link) {
    this.__hideTooltip();
    this.map?.setActiveHotspot(null);
    this.plan?.setActiveHotspot(null);
    this.dispatchEvent(new LeaveArrowEvent(link, this.state.currentNode));
  }
  /**
   * Hides the tooltip
   */
  __hideTooltip() {
    this.state.currentTooltip?.hide();
    this.state.currentTooltip = null;
  }
  /**
   * Manage the preload of the linked panoramas
   */
  __preload(node) {
    if (!this.config.preload) {
      return;
    }
    this.state.preload[node.id] = true;
    this.state.currentNode.links.filter((link) => !this.state.preload[link.nodeId]).filter((link) => {
      if (typeof this.config.preload === "function") {
        return this.config.preload(this.state.currentNode, link);
      } else {
        return true;
      }
    }).forEach((link) => {
      this.state.preload[link.nodeId] = this.datasource.loadNode(link.nodeId).then((linkNode) => {
        return this.viewer.textureLoader.preloadPanorama(linkNode.panorama);
      }).then(() => {
        this.state.preload[link.nodeId] = true;
      }).catch(() => {
        delete this.state.preload[link.nodeId];
      });
    });
  }
  /**
   * Changes the markers to the ones defined on the node
   */
  __addNodeMarkers(node) {
    if (node.markers) {
      if (this.markers) {
        this.markers.setMarkers(
          node.markers.map((marker) => {
            if (marker.gps && this.isGps) {
              marker.position = gpsToSpherical(node.gps, marker.gps);
              if (marker.data?.["map"]) {
                Object.assign(marker.data["map"], this.__getGpsMapPosition(marker.gps));
              }
              if (marker.data?.["plan"]) {
                marker.data["plan"].coordinates = marker.gps;
              }
            }
            return marker;
          })
        );
      } else {
        utils5.logWarn(`Node ${node.id} markers ignored because the plugin is not loaded.`);
      }
    }
  }
  /**
   * Gets the position of a node on the map, if applicable
   */
  __getNodeMapPosition(node) {
    const fromGps = this.__getGpsMapPosition(node.gps);
    if (fromGps) {
      return fromGps;
    } else if (node.map) {
      return { x: node.map.x, y: node.map.y };
    } else {
      return null;
    }
  }
  /**
   * Gets a gps position on the map
   */
  __getGpsMapPosition(gps) {
    const map = this.config.map;
    if (this.isGps && map && map.extent && map.size) {
      return {
        x: MathUtils3.mapLinear(gps[0], map.extent[0], map.extent[2], 0, map.size.width),
        y: MathUtils3.mapLinear(gps[1], map.extent[1], map.extent[3], 0, map.size.height)
      };
    } else {
      return null;
    }
  }
};
_VirtualTourPlugin.id = "virtual-tour";
_VirtualTourPlugin.VERSION = "5.14.3";
_VirtualTourPlugin.configParser = getConfig;
_VirtualTourPlugin.readonlyOptions = Object.keys(getConfig.defaults);
var VirtualTourPlugin = _VirtualTourPlugin;
export {
  VirtualTourPlugin,
  events_exports as events
};
//# sourceMappingURL=index.module.js.map