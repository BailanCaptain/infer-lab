import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import city from "./city.json";

export interface CityScene {
  reset: () => void;
  tour: (enabled: boolean) => boolean;
  dispose: () => void;
}
type Callbacks = {
  onLoad: () => void;
  onProgress: (percent: number) => void;
  onError: () => void;
  onInteract: () => void;
};

/** Demand-driven viewer: no RAF loop or shadow redraw when the city is idle. */
export function createCityScene(host: HTMLDivElement, callbacks: Callbacks): CityScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(city.palette.sky);
  scene.fog = new THREE.Fog(city.palette.fog, 70, 175);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute("aria-label", "推理之旅城市模型，拖动旋转、滚轮缩放");
  host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.2, 280);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = 15;
  controls.maxDistance = 140;
  controls.minPolarAngle = Math.PI * 0.16;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.autoRotateSpeed = 0.22;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reducedMotion = () => motion.matches || new URLSearchParams(location.search).has("nofx");
  const homeTarget = new THREE.Vector3(...city.camera.target);
  const homePosition = new THREE.Vector3();
  let disposed = false;
  let frame: number | null = null;
  let inFrame = false;
  let dirty = true;
  let lastFrame = 0;
  let lastTourFrame = 0;
  const tourInterval = 1000 / 30;
  let renderCount = 0;
  let width = 1;
  let height = 1;
  const hemi = new THREE.HemisphereLight(city.palette.fog, city.palette.dark, 2.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(city.palette.light, 3.3);
  sun.position.set(-30, 52, 15);
  sun.target.position.set(0, 0, -12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -52, right: 52, top: 52, bottom: -52, near: 1, far: 130 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.08;
  sun.shadow.bias = -0.0002;
  scene.add(sun, sun.target);

  function invalidate() {
    dirty = true;
    if (!disposed && !document.hidden && !inFrame && frame === null) frame = requestAnimationFrame(draw);
  }
  function draw(now: number) {
    frame = null;
    if (disposed || document.hidden) return;
    // User input renders on the next browser frame. Only the unattended tour is capped.
    if (controls.autoRotate && !dirty && now - lastTourFrame < tourInterval) {
      frame = requestAnimationFrame(draw);
      return;
    }
    if (controls.autoRotate) {
      // Keep the remainder so a 75 Hz display doesn't turn the 30 FPS tour into 25 FPS.
      lastTourFrame = now - ((now - lastTourFrame) % tourInterval);
    }
    inFrame = true;
    const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 0;
    lastFrame = now;
    controls.update(delta);
    if (dirty) {
      renderer.render(scene, camera);
      host.dataset.renderCount = String(++renderCount);
      host.dataset.drawCalls = String(renderer.info.render.calls);
      host.dataset.triangles = String(renderer.info.render.triangles);
      dirty = false;
    }
    inFrame = false;
    if (controls.autoRotate) frame = requestAnimationFrame(draw);
  }
  function reset() {
    controls.autoRotate = false;
    camera.position.copy(homePosition);
    controls.target.copy(homeTarget);
    callbacks.onInteract();
    invalidate();
  }
  const resize = () => {
    const bounds = host.getBoundingClientRect();
    width = bounds.width;
    height = Math.max(1, bounds.height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // Bound fragment work on large / high-DPI displays without resizing during a drag.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25, Math.sqrt(2_500_000 / (width * height))));
    renderer.setSize(width, height);
    homePosition
      .copy(homeTarget)
      .add(new THREE.Vector3(...city.camera.offset).multiplyScalar(Math.max(1, 0.9 / camera.aspect)));
    camera.position.copy(homePosition);
    controls.target.copy(homeTarget);
    invalidate();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const manager = new THREE.LoadingManager();
  const draco = new DRACOLoader(manager)
    .setDecoderPath(`${import.meta.env.BASE_URL}draco/`)
    .setWorkerLimit(1);
  const loader = new GLTFLoader(manager).setDRACOLoader(draco);
  function disposeModel(object: THREE.Object3D) {
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    object.traverse((item) => {
      if (!(item instanceof THREE.Mesh)) return;
      item.geometry.dispose();
      for (const material of Array.isArray(item.material) ? item.material : [item.material])
        materials.add(material);
    });
    for (const material of materials) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      material.dispose();
    }
    for (const texture of textures) {
      texture.dispose();
      if (typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap) texture.image.close();
    }
  }
  loader.load(
    `${import.meta.env.BASE_URL}models/${city.model}`,
    (gltf) => {
      if (disposed) {
        disposeModel(gltf.scene);
        return;
      }
      const model = gltf.scene;
      model.traverse((item) => {
        if (item instanceof THREE.Mesh) {
          item.castShadow = true;
          item.receiveShadow = true;
        }
      });
      scene.add(model);
      renderer.shadowMap.needsUpdate = true;
      host.dataset.sceneReady = "true";
      callbacks.onLoad();
      invalidate();
    },
    (event) => {
      if (!disposed && event.total) callbacks.onProgress(Math.round((event.loaded / event.total) * 100));
    },
    () => {
      if (!disposed) callbacks.onError();
    },
  );

  const interact = () => {
    controls.autoRotate = false;
    callbacks.onInteract();
    invalidate();
  };
  const key = (event: KeyboardEvent) => {
    if (event.key === "Escape") reset();
  };
  const visibility = () => {
    if (document.hidden && frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    } else {
      lastFrame = 0;
      invalidate();
    }
  };
  const motionChange = () => {
    if (reducedMotion()) {
      controls.autoRotate = false;
      callbacks.onInteract();
      invalidate();
    }
  };
  const lost = (event: Event) => {
    event.preventDefault();
    controls.autoRotate = false;
    callbacks.onError();
  };
  controls.addEventListener("start", interact);
  controls.addEventListener("change", invalidate);
  renderer.domElement.addEventListener("webglcontextlost", lost);
  window.addEventListener("keydown", key);
  document.addEventListener("visibilitychange", visibility);
  motion.addEventListener("change", motionChange);
  return {
    reset,
    tour: (enabled) => {
      if (enabled) {
        reset();
        lastTourFrame = performance.now();
      }
      controls.autoRotate = enabled && !reducedMotion();
      invalidate();
      return controls.autoRotate;
    },
    dispose: () => {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      manager.abort();
      draco.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      window.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", visibility);
      motion.removeEventListener("change", motionChange);
      disposeModel(scene);
      sun.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      delete host.dataset.sceneReady;
    },
  };
}
