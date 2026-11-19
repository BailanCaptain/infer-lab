import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import world from "./world.json";

export interface MountainScene {
  focus: (id: string | null) => void;
  tour: (enabled: boolean) => boolean;
  dispose: () => void;
}
type Callbacks = {
  onLoad: () => void;
  onProgress: (percent: number) => void;
  onError: () => void;
  onSelect: (id: string) => void;
  onInteract: () => void;
};

/** Browser presentation of the Blender asset. Coordinates originate in world.json. */
export function createMountainScene(host: HTMLDivElement, callbacks: Callbacks): MountainScene {
  const palette = world.palette;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.sky);
  scene.fog = new THREE.Fog(palette.fog, 65, 140);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  // Geometry and lighting are static: camera movement never invalidates the shadow atlas.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.domElement.setAttribute(
    "aria-label",
    "云海悬山三维场景，拖动旋转、滚轮缩放；也可使用章节目录定位",
  );
  renderer.domElement.setAttribute("role", "img");
  host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 220);
  const controls = new OrbitControls(camera, renderer.domElement);
  // Direct manipulation stops drawing immediately on release, including software WebGL.
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = 9;
  controls.maxDistance = 110;
  controls.minPolarAngle = Math.PI * 0.19;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.autoRotateSpeed = 0.3;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reducedMotion = () => motionQuery.matches || new URLSearchParams(location.search).has("nofx");
  const homeTarget = new THREE.Vector3(1, 9, -2);
  const homePosition = new THREE.Vector3();
  let selected: string | null = null;
  let disposed = false;
  let dirty = true;
  let loaded = false;
  let initialized = false;
  let userMoved = false;
  let tween: {
    from: THREE.Vector3;
    target: THREE.Vector3;
    to: THREE.Vector3;
    look: THREE.Vector3;
    start: number;
  } | null = null;
  scene.add(new THREE.HemisphereLight(palette.fog, palette.stoneDark, 2.5));
  const sun = new THREE.DirectionalLight(palette.plaster, 3.8);
  sun.position.set(-22, 42, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 100 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.06;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);

  // Depth-tested soft billboards form cloud banks around the real cliff geometry.
  const cloudCanvas = document.createElement("canvas");
  cloudCanvas.width = 128;
  cloudCanvas.height = 128;
  const ctx = cloudCanvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,0.7)");
  gradient.addColorStop(0.3, "rgba(255,255,255,0.5)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const cloudTexture = new THREE.CanvasTexture(cloudCanvas);
  const cloudMaterial = new THREE.ShaderMaterial({
    uniforms: { cloudMap: { value: cloudTexture }, cloudColor: { value: new THREE.Color(palette.fog) } },
    vertexShader: `
      varying vec2 cloudUv;
      void main() {
        cloudUv = uv;
        vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        center.xy += position.xy * vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
        gl_Position = projectionMatrix * center;
      }`,
    fragmentShader: `
      uniform sampler2D cloudMap;
      uniform vec3 cloudColor;
      varying vec2 cloudUv;
      void main() {
        gl_FragColor = vec4(cloudColor, texture2D(cloudMap, cloudUv).a * 0.7);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  let seed = world.seed;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const cloudCount = 36;
  const clouds = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), cloudMaterial, cloudCount);
  clouds.frustumCulled = false;
  const cloudTransform = new THREE.Object3D();
  for (let i = 0; i < cloudCount; i++) {
    cloudTransform.position.set((random() - 0.5) * 85, -5 + random() * 6, (random() - 0.5) * 68);
    const size = 9 + random() * 13;
    cloudTransform.scale.set(size * 1.8, size * 0.5, 1);
    cloudTransform.updateMatrix();
    clouds.setMatrixAt(i, cloudTransform.matrix);
  }
  scene.add(clouds);
  const pickTargets: THREE.Mesh[] = [];
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const pickGeometry = new THREE.BoxGeometry(4.3, 6.8, 2.7);
  for (const chapter of world.chapters) {
    const [x = 0, y = 0, z = 0] = chapter.position;
    const target = new THREE.Mesh(pickGeometry, pickMaterial);
    target.position.set(x, z + 3.4, -y);
    target.userData.chapter = chapter.id;
    scene.add(target);
    pickTargets.push(target);
  }
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(2.5, 2.55, 80),
    new THREE.MeshBasicMaterial({
      color: palette.seal,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);
  const manager = new THREE.LoadingManager();
  const draco = new DRACOLoader(manager);
  draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
  draco.setWorkerLimit(2);
  const loader = new GLTFLoader(manager).setDRACOLoader(draco);
  function disposeModel(model: THREE.Object3D) {
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      }
    });
  }
  loader.load(
    `${import.meta.env.BASE_URL}models/cloud-mountains.glb`,
    (gltf) => {
      if (disposed) {
        disposeModel(gltf.scene);
        return;
      }
      gltf.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      scene.add(gltf.scene);
      renderer.shadowMap.needsUpdate = true;
      loaded = true;
      dirty = true;
      host.dataset.sceneReady = "true";
      callbacks.onLoad();
    },
    (event) => {
      if (!disposed && event.total > 0) callbacks.onProgress(Math.round((event.loaded / event.total) * 100));
    },
    () => {
      if (!disposed) callbacks.onError();
    },
  );

  function move(to: THREE.Vector3, look: THREE.Vector3) {
    if (reducedMotion()) {
      camera.position.copy(to);
      controls.target.copy(look);
      tween = null;
    } else
      tween = {
        from: camera.position.clone(),
        target: controls.target.clone(),
        to,
        look,
        start: performance.now(),
      };
    dirty = true;
  }
  function focus(id: string | null) {
    selected = id;
    controls.autoRotate = false;
    const chapter = world.chapters.find((item) => item.id === id);
    marker.visible = !!chapter;
    if (chapter) {
      const [x = 0, y = 0, z = 0] = chapter.position;
      const look = new THREE.Vector3(x, z + 2.8, -y);
      const distance = camera.aspect < 0.85 ? 23 : 17;
      move(look.clone().add(new THREE.Vector3(3, 5, distance)), look);
      marker.position.set(x, z + 0.3, -y);
    } else {
      userMoved = false;
      move(homePosition.clone(), homeTarget.clone());
    }
    host.dataset.chapter = id ?? "overview";
  }
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    const factor = Math.max(1, 1.08 / camera.aspect);
    homePosition.copy(homeTarget).add(new THREE.Vector3(17, 20, 57).multiplyScalar(factor));
    if (!initialized || (!selected && !userMoved && !controls.autoRotate)) {
      camera.position.copy(homePosition);
      controls.target.copy(homeTarget);
      tween = null;
      initialized = true;
    }
    dirty = true;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let press = { x: 0, y: 0 };
  function hit(event: PointerEvent) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(pickTargets, false)[0]?.object.userData.chapter as string | undefined;
  }
  const pointerDown = (event: PointerEvent) => {
    press = { x: event.clientX, y: event.clientY };
  };
  const pointerUp = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5 || !loaded) return;
    const id = hit(event);
    if (id) callbacks.onSelect(id);
  };
  const pointerMove = (event: PointerEvent) => {
    renderer.domElement.style.cursor = event.buttons ? "grabbing" : hit(event) ? "pointer" : "grab";
  };
  const interactionStart = () => {
    userMoved = true;
    tween = null;
    controls.autoRotate = false;
    callbacks.onInteract();
  };
  const change = () => {
    dirty = true;
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") focus(null);
  };
  const contextLost = (event: Event) => {
    event.preventDefault();
    callbacks.onError();
  };
  const motionChange = () => {
    if (reducedMotion()) {
      controls.autoRotate = false;
      if (tween) {
        camera.position.copy(tween.to);
        controls.target.copy(tween.look);
        tween = null;
      }
      callbacks.onInteract();
      dirty = true;
    }
  };
  controls.addEventListener("start", interactionStart);
  controls.addEventListener("change", change);
  renderer.domElement.addEventListener("pointerdown", pointerDown);
  renderer.domElement.addEventListener("pointerup", pointerUp);
  renderer.domElement.addEventListener("pointermove", pointerMove);
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  window.addEventListener("keydown", keydown);
  motionQuery.addEventListener("change", motionChange);
  let lastFrame = 0;
  renderer.setAnimationLoop((time) => {
    if (document.hidden || time - lastFrame < 1000 / 24) return;
    const delta = lastFrame ? Math.min((time - lastFrame) / 1000, 0.1) : 0;
    lastFrame = time;
    if (tween) {
      const t = Math.min(1, (time - tween.start) / 1250);
      const eased = t * t * (3 - 2 * t);
      camera.position.lerpVectors(tween.from, tween.to, eased);
      controls.target.lerpVectors(tween.target, tween.look, eased);
      if (t === 1) tween = null;
      dirty = true;
    }
    controls.update(delta);
    if (dirty) {
      renderer.render(scene, camera);
      host.dataset.renderCalls = String(renderer.info.render.calls);
      dirty = false;
    }
  });
  return {
    focus,
    tour: (enabled) => {
      if (enabled) {
        selected = null;
        userMoved = false;
        marker.visible = false;
        tween = null;
        camera.position.copy(homePosition);
        controls.target.copy(homeTarget);
        host.dataset.chapter = "overview";
      }
      controls.autoRotate = enabled && !reducedMotion();
      dirty = true;
      return controls.autoRotate;
    },
    dispose: () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      manager.abort();
      draco.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      window.removeEventListener("keydown", keydown);
      motionQuery.removeEventListener("change", motionChange);
      disposeModel(scene);
      cloudTexture.dispose();
      cloudMaterial.dispose();
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch {}
      renderer.domElement.remove();
      delete host.dataset.sceneReady;
    },
  };
}
