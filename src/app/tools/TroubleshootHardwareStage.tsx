import { useEffect, useMemo, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { AscendCalcCardId } from "../../sim/modelspec/deployCalculator";
import type { LogAnalysisReport } from "../../sim/troubleshoot/logAnalyzer";
import {
  type DerivedHardwareFaultFrame,
  type DerivedRankUnitState,
  deriveHardwareFaultFrame,
  type SlotDieVisualState,
  TROUBLESHOOT_3D_CARD_OPTIONS,
} from "./troubleshootHardwareModel";

interface StagePaletteEntry {
  readonly fill: number;
  readonly edge: number;
  readonly height: number;
  readonly badgeBg: string;
  readonly badgeBorder: string;
  readonly badgeText: string;
}

const STATE_PALETTE: Readonly<Record<SlotDieVisualState, StagePaletteEntry>> = {
  "root-cause": {
    fill: 0xb54237,
    edge: 0x7c231b,
    height: 0.62,
    badgeBg: "#fff0e9",
    badgeBorder: "#b54237",
    badgeText: "#8f291f",
  },
  "confirmed-cascade": {
    fill: 0x9a4b86,
    edge: 0x6e2d5e,
    height: 0.38,
    badgeBg: "#f7e7f2",
    badgeBorder: "#9a4b86",
    badgeText: "#732e62",
  },
  "unattributed-timeout": {
    fill: 0xc78300,
    edge: 0x8c5b00,
    height: 0.34,
    badgeBg: "#fff4cf",
    badgeBorder: "#c78300",
    badgeText: "#7d5100",
  },
  participating: {
    fill: 0x087f73,
    edge: 0x065a52,
    height: 0.15,
    badgeBg: "#ddf4ef",
    badgeBorder: "#087f73",
    badgeText: "#065c53",
  },
  idle: {
    fill: 0xc8cbc0,
    edge: 0x8f968e,
    height: 0.05,
    badgeBg: "#ece9df",
    badgeBorder: "#c4c6bc",
    badgeText: "#66716d",
  },
  unmapped: {
    fill: 0xd4d5cb,
    edge: 0x9aa39d,
    height: 0.05,
    badgeBg: "#ece9df",
    badgeBorder: "#c4c6bc",
    badgeText: "#66716d",
  },
};

function computeVisibleBounds(root: T.Object3D): T.Box3 {
  const box = new T.Box3();
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (!obj.visible) return;
    let cur: T.Object3D | null = obj;
    while (cur) {
      if (!cur.visible) return;
      cur = cur.parent;
    }
    if (obj instanceof T.Mesh && obj.geometry) {
      if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
      if (obj.geometry.boundingBox) {
        const worldBox = obj.geometry.boundingBox.clone().applyMatrix4(obj.matrixWorld);
        box.union(worldBox);
      }
    }
  });
  return box;
}

function fitCameraToServer(handles: SceneHandles): void {
  const bbox = computeVisibleBounds(handles.serverGroup);
  if (bbox.isEmpty()) return;
  const center = bbox.getCenter(new T.Vector3());
  const size = bbox.getSize(new T.Vector3());
  const aspect = Math.max(0.55, handles.camera.aspect || 1.35);
  const isTall = size.y > 2.6;

  handles.defaultTarget.set(center.x, center.y, center.z);
  const viewDir = new T.Vector3(
    isTall ? -0.34 : -0.72,
    isTall ? 1.24 : 0.92,
    isTall ? 0.96 : 1.02,
  ).normalize();

  const forward = viewDir.clone().negate();
  const worldUp = new T.Vector3(0, 1, 0);
  const right = new T.Vector3().crossVectors(forward, worldUp).normalize();
  const up = new T.Vector3().crossVectors(right, forward).normalize();

  const corners = [
    new T.Vector3(bbox.min.x, bbox.min.y, bbox.min.z),
    new T.Vector3(bbox.min.x, bbox.min.y, bbox.max.z),
    new T.Vector3(bbox.min.x, bbox.max.y, bbox.min.z),
    new T.Vector3(bbox.min.x, bbox.max.y, bbox.max.z),
    new T.Vector3(bbox.max.x, bbox.min.y, bbox.min.z),
    new T.Vector3(bbox.max.x, bbox.min.y, bbox.max.z),
    new T.Vector3(bbox.max.x, bbox.max.y, bbox.min.z),
    new T.Vector3(bbox.max.x, bbox.max.y, bbox.max.z),
  ];

  let maxHalfW = 0.5;
  let maxHalfH = 0.5;
  let maxTowardCam = 0.5;
  const rel = new T.Vector3();
  for (const c of corners) {
    rel.subVectors(c, handles.defaultTarget);
    maxHalfW = Math.max(maxHalfW, Math.abs(rel.dot(right)));
    maxHalfH = Math.max(maxHalfH, Math.abs(rel.dot(up)));
    maxTowardCam = Math.max(maxTowardCam, rel.dot(viewDir));
  }

  const tanHalfVFov = Math.tan(T.MathUtils.degToRad(handles.camera.fov * 0.5));
  const tanHalfHFov = tanHalfVFov * aspect;
  const distV = maxHalfH / Math.max(0.1, tanHalfVFov);
  const distH = maxHalfW / Math.max(0.1, tanHalfHFov);
  const dist = Math.max(distV, distH) * 1.18 + maxTowardCam * 0.65;

  handles.controls.maxDistance = Math.max(28, dist * 2.4);
  handles.defaultCamPos.copy(handles.defaultTarget).addScaledVector(viewDir, dist);
  handles.camera.position.copy(handles.defaultCamPos);
  handles.controls.target.copy(handles.defaultTarget);
  handles.controls.update();
}

function computePartLocalTopY(part: T.Object3D): number {
  part.updateMatrixWorld(true);
  const inv = part.matrixWorld.clone().invert();
  const box = new T.Box3();
  let hasMesh = false;
  part.traverse((child) => {
    const mesh = child as T.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (!bb) return;
    const localMat = inv.clone().multiply(mesh.matrixWorld);
    box.union(bb.clone().applyMatrix4(localMat));
    hasMesh = true;
  });
  return hasMesh && Number.isFinite(box.max.y) ? box.max.y : 0.24;
}

function disposeObjectTree(root: T.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as T.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      for (const m of mat) m.dispose();
    } else if (mat) {
      mat.dispose();
    }
  });
}

export interface TroubleshootHardwareStageProps {
  readonly report: LogAnalysisReport;
  readonly defaultCardId?: AscendCalcCardId | undefined;
  readonly selectedRank: number | null;
  readonly onSelectEvidence: (rank: number, lineNumber: number | null) => void;
}
interface SceneHandles {
  scene: T.Scene;
  camera: T.PerspectiveCamera;
  renderer: T.WebGLRenderer;
  controls: OrbitControls;
  serverGroup: T.Group;
  overlayGroup: T.Group;
  npuSlots: T.Object3D[];
  slotTopY: number[];
  defaultCamPos: T.Vector3;
  defaultTarget: T.Vector3;
  requestRender: () => void;
}

function syncOverlayGeometry(
  handles: SceneHandles,
  frame: DerivedHardwareFaultFrame,
  selectedRank: number | null,
): void {
  disposeObjectTree(handles.overlayGroup);
  handles.overlayGroup.clear();

  const { spec, rankUnits, waitingArcs } = frame;
  const worldAnchors = new Map<number, T.Vector3>();
  const isPcie = spec.partPrefix === "card";
  const isDualNpu = spec.diesPerPhysicalSlot === 2 && !isPcie;
  const colW = isDualNpu ? 0.22 : isPcie ? 0.24 : 0.32;
  const colD = isDualNpu ? 0.26 : isPcie ? 0.28 : 0.32;

  for (const unit of rankUnits) {
    const part = handles.npuSlots[unit.physicalSlot];
    if (!part) continue;
    const topY = handles.slotTopY[unit.physicalSlot] ?? 0.24;
    const lx = isDualNpu ? (unit.dieIndex === 0 ? -0.19 : 0.19) : isPcie ? 0.06 : 0;
    const lz = isPcie ? (unit.dieIndex === 0 ? -0.48 : 0.36) : 0.02;

    const pal = STATE_PALETTE[unit.state];
    const localAnchor = new T.Vector3(lx, topY + 0.03, lz);
    part.updateMatrixWorld(true);
    const worldBase = localAnchor.clone().applyMatrix4(part.matrixWorld);

    const group = new T.Group();
    group.position.copy(worldBase);

    const bodyGeo = new T.BoxGeometry(colW, pal.height, colD);
    const bodyMat = new T.MeshStandardMaterial({
      color: pal.fill,
      roughness: 0.42,
      metalness: 0.08,
      transparent: unit.state === "idle" || unit.state === "unmapped",
      opacity: unit.state === "idle" || unit.state === "unmapped" ? 0.52 : 0.96,
    });
    const body = new T.Mesh(bodyGeo, bodyMat);
    body.position.y = pal.height * 0.5;
    const pickLogicalRank = unit.logicalRank ?? unit.rank;
    body.userData = { pickRank: pickLogicalRank, evidenceLineNumber: unit.evidenceLineNumber };
    group.add(body);

    const isSelected = selectedRank === pickLogicalRank || frame.activeStage.focusRank === unit.rank;
    const edgeGeo = new T.EdgesGeometry(
      new T.BoxGeometry(
        colW + (isSelected ? 0.05 : 0.014),
        pal.height + (isSelected ? 0.04 : 0.01),
        colD + (isSelected ? 0.05 : 0.014),
      ),
    );
    const edgeMat = new T.LineBasicMaterial({
      color: isSelected ? 0x17211f : pal.edge,
    });
    const edges = new T.LineSegments(edgeGeo, edgeMat);
    edges.position.y = pal.height * 0.5;
    group.add(edges);

    handles.overlayGroup.add(group);
    worldAnchors.set(unit.rank, worldBase.clone().add(new T.Vector3(0, pal.height + 0.04, 0)));
  }

  for (const arc of waitingArcs) {
    const p0 = worldAnchors.get(arc.fromRank);
    const p1 = worldAnchors.get(arc.toRank);
    if (!p0 || !p1) continue;
    const dist = p0.distanceTo(p1);
    const mid = p0.clone().lerp(p1, 0.5);
    mid.y = Math.max(p0.y, p1.y) + 0.36 + Math.min(0.55, dist * 0.14);
    const curve = new T.QuadraticBezierCurve3(p0, mid, p1);
    const tubeGeo = new T.TubeGeometry(curve, 28, 0.022, 8, false);
    const tubeMat = new T.MeshStandardMaterial({
      color: 0x9a4b86,
      roughness: 0.35,
      metalness: 0.05,
    });
    handles.overlayGroup.add(new T.Mesh(tubeGeo, tubeMat));

    const ringGeo = new T.TorusGeometry(0.11, 0.018, 8, 24);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new T.MeshStandardMaterial({ color: 0xb54237, roughness: 0.35 });
    const ring = new T.Mesh(ringGeo, ringMat);
    ring.position.copy(p1);
    handles.overlayGroup.add(ring);
  }

  handles.requestRender();
}

export function TroubleshootHardwareStage({
  report,
  defaultCardId = "a2-64g",
  selectedRank,
  onSelectEvidence,
}: TroubleshootHardwareStageProps) {
  const [cardId, setCardId] = useState<AscendCalcCardId>(defaultCardId);
  const [stepIndex, setStepIndex] = useState<number>(() => {
    const init = deriveHardwareFaultFrame(report, defaultCardId, 999);
    return init.stages.length - 1;
  });
  const [playing, setPlaying] = useState(false);
  const [hasActivated, setHasActivated] = useState(false);
  const [assetReady, setAssetReady] = useState<string | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const handlesRef = useRef<SceneHandles | null>(null);
  const onSelectRef = useRef(onSelectEvidence);
  onSelectRef.current = onSelectEvidence;

  const prevReportRef = useRef(report);
  if (prevReportRef.current !== report) {
    prevReportRef.current = report;
    const nextInit = deriveHardwareFaultFrame(report, cardId, 999);
    setStepIndex(nextInit.stages.length - 1);
    setPlaying(false);
  }

  const frame = useMemo(
    () => deriveHardwareFaultFrame(report, cardId, stepIndex),
    [report, cardId, stepIndex],
  );
  const hardwareModel = frame.spec.hardwareModel;
  const latestOverlayRef = useRef({ frame, selectedRank });
  latestOverlayRef.current = { frame, selectedRank };

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setHasActivated(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.some((e) => e.isIntersecting);
        if (vis) setHasActivated(true);
        if (!vis) setPlaying(false);
      },
      { rootMargin: "360px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const onVis = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", onVis);
    const timer = window.setInterval(() => {
      setStepIndex((cur) => {
        if (cur >= frame.stages.length - 1) {
          setPlaying(false);
          return cur;
        }
        return cur + 1;
      });
    }, 1150);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [playing, frame.stages.length]);

  useEffect(() => {
    if (!hasActivated || !canvasHostRef.current) return;
    const host = canvasHostRef.current;
    let disposed = false;
    let rafId = 0;

    const scene = new T.Scene();
    scene.background = new T.Color("#ece9df");
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      setWebglUnavailable(true);
      setAssetReady("webgl-unavailable");
      return;
    }
    setWebglUnavailable(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    host.innerHTML = "";
    host.appendChild(renderer.domElement);

    const camera = new T.PerspectiveCamera(33, 1, 0.1, 100);
    const defaultCamPos = new T.Vector3(-4.2, 4.3, 5.4);
    const defaultTarget = new T.Vector3(0, 0.35, 0.05);
    camera.position.copy(defaultCamPos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(defaultTarget);
    controls.enablePan = false;
    controls.minDistance = 2.6;
    controls.maxDistance = 10.5;
    controls.maxPolarAngle = Math.PI * 0.47;

    scene.add(new T.HemisphereLight("#fff8e6", "#7a8c7d", 2.15));
    const keyLight = new T.DirectionalLight("#fff1d6", 2.8);
    keyLight.position.set(-7, 15, 10);
    scene.add(keyLight);
    const fillLight = new T.DirectionalLight("#dae6f2", 1.35);
    fillLight.position.set(10, 9, -7);
    scene.add(fillLight);

    const ground = new T.Mesh(
      new T.PlaneGeometry(36, 36),
      new T.MeshStandardMaterial({ color: "#e6e4da", roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    scene.add(ground);

    const serverGroup = new T.Group();
    const overlayGroup = new T.Group();
    scene.add(serverGroup);
    scene.add(overlayGroup);

    const requestRender = () => {
      if (disposed || rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        if (disposed) return;
        controls.update();
        renderer.render(scene, camera);
      });
    };

    controls.addEventListener("change", requestRender);

    const resize = () => {
      const w = Math.max(240, host.clientWidth);
      const h = Math.max(220, host.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      if (handlesRef.current && handlesRef.current.serverGroup.children.length > 0) {
        fitCameraToServer(handlesRef.current);
      }
      requestRender();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const raycaster = new T.Raycaster();
    const pointer = new T.Vector2();
    const onPointerUp = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(overlayGroup.children, true);
      for (const hit of hits) {
        const r = hit.object.userData?.pickRank;
        if (typeof r === "number") {
          const line = hit.object.userData?.evidenceLineNumber ?? null;
          onSelectRef.current(r, typeof line === "number" ? line : null);
          break;
        }
      }
    };
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const handles: SceneHandles = {
      scene,
      camera,
      renderer,
      controls,
      serverGroup,
      overlayGroup,
      npuSlots: [],
      slotTopY: [],
      defaultCamPos,
      defaultTarget,
      requestRender,
    };
    handlesRef.current = handles;

    return () => {
      disposed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      disposeObjectTree(serverGroup);
      disposeObjectTree(overlayGroup);
      ground.geometry.dispose();
      (ground.material as T.Material).dispose();
      renderer.dispose();
      handlesRef.current = null;
    };
  }, [hasActivated]);

  useEffect(() => {
    const handles = handlesRef.current;
    if (!hasActivated || !handles) return;
    let cancelled = false;
    setAssetReady(null);

    const url = `${import.meta.env.BASE_URL}experiences/whole/assets/${hardwareModel}.glb`;
    new GLTFLoader().load(
      url,
      (gltf) => {
        if (cancelled || handlesRef.current !== handles) return;
        disposeObjectTree(handles.serverGroup);
        handles.serverGroup.clear();

        const root = gltf.scene.children[0] ?? gltf.scene;
        const parts: T.Object3D[] = [];
        root.traverse((obj) => {
          if (obj.userData?.kind) parts.push(obj);
        });

        for (const part of parts) {
          if (part.userData.kind === "lid" || part.userData.kind === "cooling") {
            part.visible = false;
            continue;
          }
          part.position.y += (Number(part.userData.explodeZ) || 0) * 0.36;
          part.position.z -= (Number(part.userData.explodeY) || 0) * 0.36;
        }

        handles.serverGroup.add(root);
        handles.serverGroup.updateMatrixWorld(true);
        fitCameraToServer(handles);

        const npuEntries = parts
          .filter((o) => o.userData.kind === "npu")
          .map((o) => {
            const m = o.name.match(/(?:npu|card)(\d+)$/i);
            return { part: o, idx: m ? Number(m[1]) : 999 };
          })
          .sort((a, b) => a.idx - b.idx);

        handles.npuSlots = npuEntries.map((e) => e.part);
        handles.slotTopY = handles.npuSlots.map((p) => computePartLocalTopY(p));
        const cur = latestOverlayRef.current;
        syncOverlayGeometry(handles, cur.frame, cur.selectedRank);
        handles.renderer.render(handles.scene, handles.camera);
        setAssetReady(hardwareModel);
      },
      undefined,
      () => {
        if (!cancelled) setAssetReady("error");
      },
    );

    return () => {
      cancelled = true;
    };
  }, [hasActivated, hardwareModel]);

  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles || assetReady !== hardwareModel) return;
    syncOverlayGeometry(handles, frame, selectedRank);
  }, [frame, selectedRank, assetReady, hardwareModel]);

  const handleResetCamera = () => {
    const h = handlesRef.current;
    if (!h) return;
    h.camera.position.copy(h.defaultCamPos);
    h.controls.target.copy(h.defaultTarget);
    h.controls.update();
    h.requestRender();
  };

  const maxStep = Math.max(0, frame.stages.length - 1);

  return (
    <section
      ref={rootRef}
      className="wt-finding-card"
      data-testid="troubleshoot-3d-stage"
      data-hardware-model={frame.spec.hardwareModel}
      data-mapping-mode={frame.mappingMode}
      data-step-index={frame.activeStage.index}
      data-scene-ready={
        webglUnavailable
          ? "webgl-fallback"
          : assetReady === frame.spec.hardwareModel
            ? "true"
            : assetReady === "error"
              ? "error"
              : "loading"
      }
      style={{ marginTop: 12, padding: "14px 16px" }}
    >
      <div className="wt-finding-head" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span className="wt-badge-scope">整机 3D 故障现场回放</span>
          <span className="wt-baseline-pill">{frame.spec.hardwareDisplayName}</span>
          <span className="wt-section-meta" style={{ fontSize: "12.5px" }}>
            {frame.mappingNote}
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {TROUBLESHOOT_3D_CARD_OPTIONS.map((opt) => (
            <button
              key={opt.cardId}
              type="button"
              className={`wt-preset-btn ${cardId === opt.cardId ? "is-active" : ""}`}
              data-testid={`troubleshoot-3d-model-${opt.cardId}`}
              onClick={() => setCardId(opt.cardId)}
            >
              {opt.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
          marginTop: 10,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            position: "relative",
            minHeight: 290,
            borderRadius: "var(--radius-card)",
            border: "1px solid var(--color-line)",
            background: "#ece9df",
            overflow: "hidden",
          }}
        >
          <div
            ref={canvasHostRef}
            data-testid="troubleshoot-3d-canvas"
            style={{ width: "100%", height: "100%", minHeight: 290 }}
          />
          {webglUnavailable ? (
            <div
              data-testid="troubleshoot-3d-webgl-fallback"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 6,
                padding: "18px 20px",
                background: "#ece9df",
                color: "var(--color-ink)",
                fontSize: "13px",
                lineHeight: 1.5,
              }}
            >
              <strong>当前终端未启用 WebGL 3D 渲染</strong>
              <span>
                整机立体机箱视图已自动降级，右侧多卡状态矩阵、故障因果时间轴与一键定位日志原行功能仍完整可用。
              </span>
            </div>
          ) : (
            <button
              type="button"
              className="wt-preset-btn"
              data-testid="troubleshoot-3d-reset-view"
              onClick={handleResetCamera}
              style={{ position: "absolute", top: 8, right: 8, background: "rgba(252,251,247,0.9)" }}
            >
              复位视角
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div
              data-testid="troubleshoot-3d-stage-caption"
              style={{
                padding: "8px 10px",
                borderRadius: "var(--radius-field)",
                border: "1px solid var(--color-line)",
                background: "var(--color-surface)",
                fontSize: "13.5px",
                fontWeight: 600,
                color: "var(--color-ink)",
              }}
            >
              阶段 {frame.activeStage.index} / {maxStep}：{frame.activeStage.title}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))",
                gap: 6,
                marginTop: 8,
              }}
            >
              {frame.rankUnits.map((u: DerivedRankUnitState) => {
                const pal = STATE_PALETTE[u.state];
                const pickLogicalRank = u.logicalRank ?? u.rank;
                const isSel = selectedRank === pickLogicalRank || frame.activeStage.focusRank === u.rank;
                return (
                  <button
                    key={u.rank}
                    type="button"
                    data-testid={`troubleshoot-3d-slot-${u.rank}`}
                    data-slot-state={u.state}
                    onClick={() => onSelectEvidence(pickLogicalRank, u.evidenceLineNumber)}
                    style={{
                      textAlign: "left",
                      padding: "6px 8px",
                      borderRadius: "var(--radius-field)",
                      border: `${isSel ? "2px" : "1px"} solid ${pal.badgeBorder}`,
                      background: pal.badgeBg,
                      color: pal.badgeText,
                      cursor: "pointer",
                      fontSize: "12.5px",
                      lineHeight: 1.35,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{u.label}</div>
                    <div style={{ fontSize: "12px", opacity: 0.92 }}>{u.statusLabel}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <button
                type="button"
                className="wt-preset-btn"
                data-testid="troubleshoot-3d-play-toggle"
                disabled={maxStep === 0}
                onClick={() => {
                  if (!playing && stepIndex >= maxStep) setStepIndex(0);
                  setPlaying((p) => !p);
                }}
              >
                {playing ? "暂停" : "播放演进"}
              </button>
              <button
                type="button"
                className="wt-preset-btn"
                data-testid="troubleshoot-3d-prev"
                disabled={stepIndex <= 0}
                onClick={() => {
                  setPlaying(false);
                  setStepIndex((s) => Math.max(0, s - 1));
                }}
              >
                上一步
              </button>
              <button
                type="button"
                className="wt-preset-btn"
                data-testid="troubleshoot-3d-next"
                disabled={stepIndex >= maxStep}
                onClick={() => {
                  setPlaying(false);
                  setStepIndex((s) => Math.min(maxStep, s + 1));
                }}
              >
                下一步
              </button>
              <button
                type="button"
                className="wt-preset-btn"
                data-testid="troubleshoot-3d-replay"
                disabled={maxStep === 0}
                onClick={() => {
                  setStepIndex(0);
                  setPlaying(true);
                }}
              >
                从首帧重播
              </button>
              <input
                type="range"
                aria-label="故障时间线进度"
                data-testid="troubleshoot-3d-slider"
                min={0}
                max={maxStep}
                value={stepIndex}
                onChange={(e) => {
                  setPlaying(false);
                  setStepIndex(Number(e.target.value));
                }}
                style={{ flex: "1 1 110px", accentColor: "#087f73" }}
              />
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px 12px",
                fontSize: "12px",
                color: "var(--color-ink-muted)",
              }}
            >
              <span>
                <strong style={{ color: "#b54237" }}>■</strong> 首错真凶卡
              </span>
              <span>
                <strong style={{ color: "#9a4b86" }}>■</strong> 次生等待超时
              </span>
              <span>
                <strong style={{ color: "#9a4b86" }}>⌒</strong> 示意等待依赖（非物理网线包序）
              </span>
              <span>
                <strong style={{ color: "#087f73" }}>■</strong> 参与运行
              </span>
              <span>
                <strong style={{ color: "#8f968e" }}>□</strong> 未参与 / 未知
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
