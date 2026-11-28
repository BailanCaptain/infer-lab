import { useEffect, useMemo, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { AscendCalcCardId } from "../../sim/modelspec/deployCalculator";
import type { LogAnalysisReport } from "../../sim/troubleshoot/logAnalyzer";
import {
  type DerivedHardwareFaultFrame,
  type DerivedLinkFaultMark,
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

export function computeVisibleBounds(root: T.Object3D): T.Box3 {
  const box = new T.Box3();
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (!obj.visible) return;
    let cur: T.Object3D | null = obj;
    while (cur) {
      if (!cur.visible) return;
      cur = cur.parent;
    }
    if (obj instanceof T.InstancedMesh && obj.geometry) {
      if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
      if (obj.geometry.boundingBox) {
        const instMat = new T.Matrix4();
        const worldMat = new T.Matrix4();
        for (let idx = 0; idx < obj.count; idx += 1) {
          obj.getMatrixAt(idx, instMat);
          worldMat.multiplyMatrices(obj.matrixWorld, instMat);
          box.union(obj.geometry.boundingBox.clone().applyMatrix4(worldMat));
        }
      }
      return;
    }
    if ((obj instanceof T.Mesh || obj instanceof T.LineSegments) && obj.geometry) {
      if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
      if (obj.geometry.boundingBox) {
        const worldBox = obj.geometry.boundingBox.clone().applyMatrix4(obj.matrixWorld);
        box.union(worldBox);
      }
    }
  });
  return box;
}

function computeStageSceneBounds(handles: Pick<SceneHandles, "serverGroup" | "overlayGroup">): T.Box3 {
  const bbox = computeVisibleBounds(handles.serverGroup);
  if (bbox.isEmpty()) return bbox;
  const overlayBbox = computeVisibleBounds(handles.overlayGroup);
  if (!overlayBbox.isEmpty()) {
    bbox.union(overlayBbox);
  }
  bbox.max.y = Math.max(bbox.max.y, bbox.min.y + 1.05);
  return bbox;
}

export function fitCameraToServer(handles: SceneHandles, preserveCurrentView = false): void {
  const bbox = computeStageSceneBounds(handles);
  if (bbox.isEmpty()) return;
  handles.fittedBbox = bbox.clone();

  const prevTarget = handles.defaultTarget.clone();
  const prevCamOffset = handles.camera.position.clone().sub(prevTarget);
  const center = bbox.getCenter(new T.Vector3());
  const size = bbox.getSize(new T.Vector3());
  const aspect = handles.camera.aspect > 0 ? handles.camera.aspect : 1.35;
  const isTall = size.y > 2.6;

  handles.defaultTarget.set(center.x, center.y, center.z);
  const viewDir = new T.Vector3(
    isTall ? -0.34 : -0.72,
    isTall ? 1.24 : 0.92,
    isTall ? 0.96 : 1.02,
  ).normalize();

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

  const tanHalfVFov = Math.max(0.05, Math.tan(T.MathUtils.degToRad(handles.camera.fov * 0.5)));
  const tanHalfHFov = Math.max(0.05, tanHalfVFov * aspect);
  const margin = 0.88;

  const worldUp = new T.Vector3(0, 1, 0);
  const forward = new T.Vector3();
  const right = new T.Vector3();
  const up = new T.Vector3();
  const dir = new T.Vector3();
  const rel = new T.Vector3();

  const accumulateMinDistanceForDir = (sampleDir: T.Vector3, curDist: number): number => {
    forward.copy(sampleDir).negate();
    right.crossVectors(forward, worldUp);
    if (right.lengthSq() < 1e-6) {
      right.set(1, 0, 0);
    } else {
      right.normalize();
    }
    up.crossVectors(right, forward).normalize();
    let d = curDist;
    for (const c of corners) {
      rel.subVectors(c, handles.defaultTarget);
      const xCam = Math.abs(rel.dot(right));
      const yCam = Math.abs(rel.dot(up));
      const towardCam = rel.dot(sampleDir);
      d = Math.max(
        d,
        towardCam + xCam / (margin * tanHalfHFov),
        towardCam + yCam / (margin * tanHalfVFov),
        towardCam + 0.8,
      );
    }
    return d;
  };

  let dist = accumulateMinDistanceForDir(viewDir, 2.6);
  const maxPolar = handles.controls.maxPolarAngle || Math.PI * 0.47;
  // Guarantee every permitted OrbitControls azimuth/polar view fits within margin <= 0.88 (< 0.95)
  for (const polar of [0.18, 0.45, 0.78, 1.12, maxPolar]) {
    const sinP = Math.sin(polar);
    const cosP = Math.cos(polar);
    for (let step = 0; step < 24; step += 1) {
      const az = (step * Math.PI * 2) / 24;
      dir.set(sinP * Math.sin(az), cosP, sinP * Math.cos(az)).normalize();
      dist = accumulateMinDistanceForDir(dir, dist);
    }
  }

  handles.camera.far = Math.max(100, dist * 4);
  handles.camera.updateProjectionMatrix();
  handles.controls.maxDistance = Math.max(28, dist * 2.4);
  handles.defaultCamPos.copy(handles.defaultTarget).addScaledVector(viewDir, dist);
  if (preserveCurrentView && prevCamOffset.lengthSq() > 1e-6) {
    handles.camera.position.copy(handles.defaultTarget).addScaledVector(prevCamOffset.normalize(), dist);
  } else {
    handles.camera.position.copy(handles.defaultCamPos);
  }
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

function disposeMaterial(mat: T.Material): void {
  for (const val of Object.values(mat)) {
    if (val && typeof val === "object" && "isTexture" in val && (val as T.Texture).isTexture) {
      (val as T.Texture).dispose();
    }
  }
  mat.dispose();
}

function disposeObjectTree(root: T.Object3D): void {
  const disposedGeos = new Set<T.BufferGeometry>();
  const disposedMats = new Set<T.Material>();
  root.traverse((obj) => {
    const mesh = obj as T.Mesh & Partial<T.InstancedMesh>;
    if (mesh.isInstancedMesh && typeof mesh.dispose === "function") {
      mesh.dispose();
    }
    if (mesh.geometry && !disposedGeos.has(mesh.geometry)) {
      disposedGeos.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      for (const m of mat) {
        if (!disposedMats.has(m)) {
          disposedMats.add(m);
          disposeMaterial(m);
        }
      }
    } else if (mat && !disposedMats.has(mat)) {
      disposedMats.add(mat);
      disposeMaterial(mat);
    }
  });
}

function typedArraysEqual(a: T.TypedArray, b: T.TypedArray): boolean {
  if (a.length !== b.length || a.constructor !== b.constructor) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function geometriesIdentical(a: T.BufferGeometry, b: T.BufferGeometry): boolean {
  if (a === b) return true;
  if (Boolean(a.index) !== Boolean(b.index)) return false;
  if (a.index && b.index && !typedArraysEqual(a.index.array, b.index.array)) return false;
  const keysA = Object.keys(a.attributes).sort();
  const keysB = Object.keys(b.attributes).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i += 1) {
    if (keysA[i] !== keysB[i]) return false;
    const attrA = a.attributes[keysA[i]!] as T.BufferAttribute | undefined;
    const attrB = b.attributes[keysB[i]!] as T.BufferAttribute | undefined;
    if (!attrA || !attrB || !attrA.array || !attrB.array || attrA.itemSize !== attrB.itemSize) return false;
    if (!typedArraysEqual(attrA.array, attrB.array)) return false;
  }
  return true;
}

export function optimizeStaticChassisTree(root: T.Object3D): T.Group {
  root.updateMatrixWorld(true);
  const rootInv = new T.Matrix4().copy(root.matrixWorld).invert();

  interface CollectedMesh {
    mesh: T.Mesh;
    mat: T.Material;
    relMatrix: T.Matrix4;
  }
  const collected: CollectedMesh[] = [];
  const collectVisible = (obj: T.Object3D): void => {
    if (!obj.visible) return;
    const m = obj as T.Mesh & { isSkinnedMesh?: boolean };
    if (m.isMesh && !m.isSkinnedMesh && m.geometry && m.material && !Array.isArray(m.material)) {
      collected.push({
        mesh: m,
        mat: m.material,
        relMatrix: new T.Matrix4().multiplyMatrices(rootInv, m.matrixWorld),
      });
    }
    for (const child of obj.children) collectVisible(child);
  };
  collectVisible(root);

  const outGroup = new T.Group();
  const keptGeos = new Set<T.BufferGeometry>();
  const sourceGeos = new Set<T.BufferGeometry>(collected.map((c) => c.mesh.geometry));
  const used = new Set<number>();

  // 1) Instance repeated geometry + material meshes (coolers, NPUs, IHS, CPUs)
  const bucketBySig = new Map<string, number[]>();
  for (let i = 0; i < collected.length; i += 1) {
    const geo = collected[i]!.mesh.geometry;
    const mat = collected[i]!.mat;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const minTag = bb ? `${bb.min.x.toFixed(3)},${bb.min.y.toFixed(3)},${bb.min.z.toFixed(3)}` : "";
    const maxTag = bb ? `${bb.max.x.toFixed(3)},${bb.max.y.toFixed(3)},${bb.max.z.toFixed(3)}` : "";
    const posCnt = geo.attributes.position?.count ?? 0;
    const idxCnt = geo.index?.count ?? -1;
    const sig = `${mat.uuid}|${posCnt}|${idxCnt}|${minTag}|${maxTag}`;
    const list = bucketBySig.get(sig);
    if (list) list.push(i);
    else bucketBySig.set(sig, [i]);
  }

  for (const idxs of bucketBySig.values()) {
    if (idxs.length < 2) continue;
    const first = collected[idxs[0]!]!;
    const matching = idxs.filter((idx) =>
      geometriesIdentical(first.mesh.geometry, collected[idx]!.mesh.geometry),
    );
    if (matching.length < 2) continue;
    const inst = new T.InstancedMesh(first.mesh.geometry, first.mat, matching.length);
    matching.forEach((mIdx, k) => {
      used.add(mIdx);
      inst.setMatrixAt(k, collected[mIdx]!.relMatrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingBox();
    inst.computeBoundingSphere();
    keptGeos.add(first.mesh.geometry);
    outGroup.add(inst);
  }

  // 2) Batch remaining single-occurrence static chassis meshes by material and vertex layout
  const batchByMat = new Map<string, CollectedMesh[]>();
  for (let i = 0; i < collected.length; i += 1) {
    if (used.has(i)) continue;
    const item = collected[i]!;
    const attrKey = Object.keys(item.mesh.geometry.attributes).sort().join(",");
    const key = `${item.mat.uuid}|${attrKey}`;
    const list = batchByMat.get(key);
    if (list) list.push(item);
    else batchByMat.set(key, [item]);
  }

  for (const items of batchByMat.values()) {
    const mat = items[0]!.mat;
    if (items.length === 1) {
      const single = items[0]!;
      const cloned = single.mesh.geometry.clone();
      cloned.applyMatrix4(single.relMatrix);
      keptGeos.add(cloned);
      outGroup.add(new T.Mesh(cloned, mat));
      continue;
    }
    const prepared: T.BufferGeometry[] = [];
    for (const item of items) {
      const rawGeo = item.mesh.geometry;
      const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo.clone();
      g.applyMatrix4(item.relMatrix);
      prepared.push(g);
    }
    const merged = mergeGeometries(prepared, false);
    for (const pg of prepared) pg.dispose();
    if (merged) {
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      keptGeos.add(merged);
      outGroup.add(new T.Mesh(merged, mat));
    } else {
      for (const item of items) {
        const cloned = item.mesh.geometry.clone();
        cloned.applyMatrix4(item.relMatrix);
        keptGeos.add(cloned);
        outGroup.add(new T.Mesh(cloned, mat));
      }
    }
  }

  for (const sg of sourceGeos) {
    if (!keptGeos.has(sg)) sg.dispose();
  }
  return outGroup;
}

export interface TroubleshootHardwareStageProps {
  readonly report: LogAnalysisReport;
  readonly defaultCardId?: AscendCalcCardId | undefined;
  readonly selectedRank: number | null;
  readonly onSelectEvidence: (rank: number, lineNumber: number | null) => void;
}
export interface SceneHandles {
  scene: T.Scene;
  camera: T.PerspectiveCamera;
  renderer: T.WebGLRenderer;
  controls: OrbitControls;
  serverGroup: T.Group;
  overlayGroup: T.Group;
  npuSlots: T.Object3D[];
  slotTopY: number[];
  activeAssetReady: boolean;
  defaultCamPos: T.Vector3;
  defaultTarget: T.Vector3;
  fittedBbox: T.Box3 | null;
  requestRender: () => void;
}

function addBrokenCrossBadge(
  parent: T.Group,
  s: number,
  pickMeta: { pickRank: number; evidenceLineNumber: number },
): void {
  for (const angle of [Math.PI / 4, -Math.PI / 4] as const) {
    const backBar = new T.Mesh(
      new T.BoxGeometry(0.185 * s, 0.048 * s, 0.032 * s),
      new T.MeshStandardMaterial({ color: 0x7c231b, roughness: 0.32, metalness: 0.08 }),
    );
    backBar.position.set(0, 0, 0.014 * s);
    backBar.rotation.z = angle;
    backBar.userData = pickMeta;
    parent.add(backBar);

    const accentBar = new T.Mesh(
      new T.BoxGeometry(0.165 * s, 0.026 * s, 0.044 * s),
      new T.MeshStandardMaterial({
        color: 0xfff0e9,
        emissive: 0x7c231b,
        emissiveIntensity: 0.38,
        roughness: 0.25,
      }),
    );
    accentBar.position.set(0, 0, 0.018 * s);
    accentBar.rotation.z = angle;
    accentBar.userData = pickMeta;
    parent.add(accentBar);
  }
}

function addTransportInitBeacon(
  parent: T.Group,
  anchor: T.Vector3,
  peerAnchor: T.Vector3 | undefined,
  portOffsetZ: number,
  markerScale: number,
  localStackIndex: number,
  pickMeta: { pickRank: number; evidenceLineNumber: number },
): void {
  const s = markerScale;
  const beaconGroup = new T.Group();
  beaconGroup.position
    .copy(anchor)
    .add(new T.Vector3(0, (0.22 + localStackIndex * 0.24) * s, portOffsetZ * 0.65));

  const diamond = new T.Mesh(
    new T.OctahedronGeometry(0.115 * s, 0),
    new T.MeshStandardMaterial({
      color: 0xe68a00,
      emissive: 0x92400e,
      emissiveIntensity: 0.35,
      roughness: 0.28,
      metalness: 0.12,
    }),
  );
  diamond.userData = pickMeta;
  beaconGroup.add(diamond);

  const exclStem = new T.Mesh(
    new T.BoxGeometry(0.042 * s, 0.13 * s, 0.042 * s),
    new T.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xb45309,
      emissiveIntensity: 0.3,
      roughness: 0.25,
    }),
  );
  exclStem.position.set(0, 0.175 * s, 0);
  exclStem.userData = pickMeta;
  beaconGroup.add(exclStem);

  parent.add(beaconGroup);

  if (peerAnchor) {
    const arcLift = localStackIndex * 0.22 * s;
    const p0 = anchor.clone().add(new T.Vector3(0, 0.12 + arcLift * 0.35, portOffsetZ * 0.3));
    const p1 = peerAnchor.clone().add(new T.Vector3(0, 0.12 + arcLift * 0.35, portOffsetZ * 0.3));
    const mid = p0.clone().lerp(p1, 0.5);
    mid.y = Math.max(p0.y, p1.y) + 0.38 + Math.min(0.4, p0.distanceTo(p1) * 0.12) + arcLift;
    const curve = new T.QuadraticBezierCurve3(p0, mid, p1);
    for (const t of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      const bead = new T.Mesh(
        new T.SphereGeometry(0.032 * s, 10, 10),
        new T.MeshStandardMaterial({ color: 0xe68a00, emissive: 0x92400e, emissiveIntensity: 0.25 }),
      );
      bead.position.copy(curve.getPoint(t));
      bead.userData = pickMeta;
      parent.add(bead);
    }
  }
}

function addNicBindFaultBeacon(
  parent: T.Group,
  anchor: T.Vector3,
  peerAnchor: T.Vector3 | undefined,
  portOffsetZ: number,
  markerScale: number,
  localStackIndex: number,
  pickMeta: { pickRank: number; evidenceLineNumber: number },
): void {
  const s = markerScale;
  const group = new T.Group();
  group.position.copy(anchor).add(new T.Vector3(0, (0.2 + localStackIndex * 0.24) * s, portOffsetZ * 0.72));
  group.rotation.order = "YXZ";
  group.rotation.y = -0.45;
  group.rotation.x = -0.35;

  const ring = new T.Mesh(
    new T.TorusGeometry(0.11 * s, 0.026 * s, 10, 18),
    new T.MeshStandardMaterial({
      color: 0xd9483b,
      emissive: 0x7c231b,
      emissiveIntensity: 0.32,
      roughness: 0.3,
      metalness: 0.12,
    }),
  );
  ring.userData = pickMeta;
  group.add(ring);

  const core = new T.Mesh(
    new T.BoxGeometry(0.08 * s, 0.08 * s, 0.045 * s),
    new T.MeshStandardMaterial({
      color: 0xfff0e9,
      emissive: 0x9b2c2c,
      emissiveIntensity: 0.28,
      roughness: 0.26,
    }),
  );
  core.rotation.z = Math.PI / 4;
  core.userData = pickMeta;
  group.add(core);
  parent.add(group);

  if (peerAnchor) {
    const arcLift = localStackIndex * 0.22 * s;
    const p0 = anchor.clone().add(new T.Vector3(0, 0.1 + arcLift * 0.35, portOffsetZ * 0.3));
    const p1 = peerAnchor.clone().add(new T.Vector3(0, 0.1 + arcLift * 0.35, portOffsetZ * 0.3));
    const mid = p0.clone().lerp(p1, 0.5);
    mid.y = Math.max(p0.y, p1.y) + 0.36 + Math.min(0.4, p0.distanceTo(p1) * 0.12) + arcLift;
    const curve = new T.QuadraticBezierCurve3(p0, mid, p1);
    for (const t of [0.22, 0.4, 0.6, 0.78]) {
      const dash = new T.Mesh(
        new T.BoxGeometry(0.055 * s, 0.032 * s, 0.032 * s),
        new T.MeshStandardMaterial({ color: 0xd9483b, emissive: 0x7c231b, emissiveIntensity: 0.25 }),
      );
      dash.position.copy(curve.getPoint(t));
      dash.lookAt(curve.getPoint(Math.min(1, t + 0.04)));
      dash.userData = pickMeta;
      parent.add(dash);
    }
  }
}

function addBrokenLinkMarker(
  parent: T.Group,
  anchor: T.Vector3,
  peerAnchor: T.Vector3 | undefined,
  portOffsetZ: number,
  markerScale: number,
  localStackIndex: number,
  mark: DerivedLinkFaultMark,
): void {
  const pickMeta = { pickRank: mark.logicalRank ?? mark.rank, evidenceLineNumber: mark.lineNumber };
  if (mark.kind === "transport-init") {
    addTransportInitBeacon(parent, anchor, peerAnchor, portOffsetZ, markerScale, localStackIndex, pickMeta);
    return;
  }
  if (mark.kind === "nic-bind-or-route") {
    addNicBindFaultBeacon(parent, anchor, peerAnchor, portOffsetZ, markerScale, localStackIndex, pickMeta);
    return;
  }

  const s = markerScale;
  const stubColor = 0x8f291f;

  if (peerAnchor) {
    const arcLift = localStackIndex * 0.22 * s;
    const pStart = anchor.clone().add(new T.Vector3(0, 0.08 + arcLift * 0.35, portOffsetZ * 0.35));
    const pEnd = peerAnchor.clone().add(new T.Vector3(0, 0.08 + arcLift * 0.35, portOffsetZ * 0.35));
    const dist = pStart.distanceTo(pEnd);
    const arcMid = pStart.clone().lerp(pEnd, 0.5);
    arcMid.y = Math.max(pStart.y, pEnd.y) + 0.42 + Math.min(0.45, dist * 0.12) + arcLift;
    const fullCurve = new T.QuadraticBezierCurve3(pStart, arcMid, pEnd);

    const buildSubPoints = (fromT: number, toT: number): T.Vector3[] => {
      const pts: T.Vector3[] = [];
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        pts.push(fullCurve.getPoint(fromT + ((toT - fromT) * i) / steps));
      }
      return pts;
    };

    for (const [a, b] of [
      [0, 0.41],
      [0.59, 1],
    ] as const) {
      const subCurve = new T.CatmullRomCurve3(buildSubPoints(a, b));
      const tubeMesh = new T.Mesh(
        new T.TubeGeometry(subCurve, 12, 0.022 * s, 8, false),
        new T.MeshStandardMaterial({ color: stubColor, roughness: 0.34, metalness: 0.1 }),
      );
      tubeMesh.userData = pickMeta;
      parent.add(tubeMesh);
    }

    const crossGroup = new T.Group();
    crossGroup.position.copy(fullCurve.getPoint(0.5));
    crossGroup.rotation.order = "YXZ";
    crossGroup.rotation.y = -0.45;
    crossGroup.rotation.x = -0.44;
    addBrokenCrossBadge(crossGroup, s, pickMeta);
    parent.add(crossGroup);
    return;
  }

  const markerGroup = new T.Group();
  markerGroup.position.copy(anchor).add(new T.Vector3(0, 0.07 + localStackIndex * 0.24 * s, portOffsetZ));
  // Angle toward the default front-left-top isometric camera so severed stubs and '×' read crisply on first view.
  markerGroup.rotation.order = "YXZ";
  markerGroup.rotation.y = -0.45;
  markerGroup.rotation.x = -0.44;

  for (const side of [-1, 1] as const) {
    const stubMesh = new T.Mesh(
      new T.BoxGeometry(0.105 * s, 0.052 * s, 0.056 * s),
      new T.MeshStandardMaterial({ color: stubColor, roughness: 0.34, metalness: 0.1 }),
    );
    stubMesh.position.set(side * 0.145 * s, 0, 0);
    stubMesh.userData = pickMeta;
    markerGroup.add(stubMesh);

    const collarMesh = new T.Mesh(
      new T.BoxGeometry(0.022 * s, 0.068 * s, 0.066 * s),
      new T.MeshStandardMaterial({
        color: 0xfff0e9,
        emissive: 0x451712,
        emissiveIntensity: 0.25,
        roughness: 0.28,
        metalness: 0.05,
      }),
    );
    collarMesh.position.set(side * 0.09 * s, 0, 0);
    collarMesh.userData = pickMeta;
    markerGroup.add(collarMesh);
  }

  addBrokenCrossBadge(markerGroup, s, pickMeta);
  parent.add(markerGroup);
}

function syncOverlayGeometry(
  handles: SceneHandles,
  frame: DerivedHardwareFaultFrame,
  selectedRank: number | null,
): void {
  disposeObjectTree(handles.overlayGroup);
  handles.overlayGroup.clear();

  const { spec, rankUnits, waitingArcs, linkFaultMarks } = frame;
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
    const isLogicalOnly = frame.mappingMode === "logical-only";
    const pickLogicalRank = isLogicalOnly ? null : unit.logicalRank;
    body.userData =
      isLogicalOnly || pickLogicalRank === null
        ? {}
        : { pickRank: pickLogicalRank, evidenceLineNumber: unit.evidenceLineNumber };
    group.add(body);

    const isSelected =
      !isLogicalOnly &&
      ((pickLogicalRank !== null && selectedRank === pickLogicalRank) ||
        frame.activeStage.focusRank === unit.rank);
    const boxEdgeSource = new T.BoxGeometry(
      colW + (isSelected ? 0.05 : 0.014),
      pal.height + (isSelected ? 0.04 : 0.01),
      colD + (isSelected ? 0.05 : 0.014),
    );
    const edgeGeo = new T.EdgesGeometry(boxEdgeSource);
    boxEdgeSource.dispose();
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

  const portOffsetZ = colD * 0.5 + (isDualNpu ? 0.14 : 0.18);
  const markerScale = isDualNpu ? 1.15 : 1.45;
  const localMarkCountByUnit = new Map<number, number>();
  const peerPairCount = new Map<string, number>();
  for (const mark of linkFaultMarks) {
    const anchor = worldAnchors.get(mark.rank);
    if (!anchor) continue;
    const peerAnchor = mark.peerRank !== null ? worldAnchors.get(mark.peerRank) : undefined;
    let stackIdx: number;
    if (peerAnchor && mark.peerRank !== null) {
      const pairKey = `${Math.min(mark.rank, mark.peerRank)}:${Math.max(mark.rank, mark.peerRank)}`;
      stackIdx = peerPairCount.get(pairKey) ?? 0;
      peerPairCount.set(pairKey, stackIdx + 1);
    } else {
      stackIdx = localMarkCountByUnit.get(mark.rank) ?? 0;
      localMarkCountByUnit.set(mark.rank, stackIdx + 1);
    }
    addBrokenLinkMarker(handles.overlayGroup, anchor, peerAnchor, portOffsetZ, markerScale, stackIdx, mark);
  }

  handles.requestRender();
}

export function syncAndFitStageOverlay(
  handles: SceneHandles,
  frame: DerivedHardwareFaultFrame,
  selectedRank: number | null,
  preserveCurrentView: boolean,
): void {
  syncOverlayGeometry(handles, frame, selectedRank);
  const curBounds = computeStageSceneBounds(handles);
  if (!curBounds.isEmpty() && (!handles.fittedBbox || !handles.fittedBbox.equals(curBounds))) {
    fitCameraToServer(handles, preserveCurrentView);
    handles.requestRender();
  }
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
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hasActivated, setHasActivated] = useState(false);
  const [assetReady, setAssetReady] = useState<string | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const handlesRef = useRef<SceneHandles | null>(null);
  const onSelectRef = useRef(onSelectEvidence);
  const prevReportRef = useRef(report);

  const frame = useMemo(
    () => deriveHardwareFaultFrame(report, cardId, stepIndex),
    [report, cardId, stepIndex],
  );
  const hardwareModel = frame.spec.hardwareModel;
  const latestOverlayRef = useRef({ frame, selectedRank });

  useEffect(() => {
    onSelectRef.current = onSelectEvidence;
  }, [onSelectEvidence]);

  useEffect(() => {
    latestOverlayRef.current = { frame, selectedRank };
  }, [frame, selectedRank]);

  useEffect(() => {
    if (prevReportRef.current === report) return;
    prevReportRef.current = report;
    const nextInit = deriveHardwareFaultFrame(report, cardId, 999);
    setStepIndex(nextInit.stages.length - 1);
    setPlaying(false);
  }, [report, cardId]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      const reduced = mq.matches;
      setReducedMotion(reduced);
      if (reduced) setPlaying(false);
      if (handlesRef.current) {
        handlesRef.current.controls.enableDamping = !reduced;
      }
    };
    syncMotion();
    mq.addEventListener("change", syncMotion);
    return () => mq.removeEventListener("change", syncMotion);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setHasActivated(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setHasActivated(true);
        } else {
          setPlaying(false);
        }
      },
      { rootMargin: "0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!playing || assetReady === "loading") return;
    if (stepIndex >= frame.stages.length - 1) {
      setPlaying(false);
      return;
    }
    const onVis = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", onVis);
    const intervalMs = reducedMotion ? 1600 : 1150;
    const maxStepIndex = Math.max(0, frame.stages.length - 1);
    const timer = window.setInterval(() => {
      setStepIndex((cur) => Math.min(maxStepIndex, cur + 1));
    }, intervalMs);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [playing, assetReady, reducedMotion, stepIndex, frame.stages.length]);

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

    let resizeRafId = 0;
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
    const ro = new ResizeObserver(() => {
      if (disposed || resizeRafId) return;
      resizeRafId = window.requestAnimationFrame(() => {
        resizeRafId = 0;
        if (!disposed) resize();
      });
    });
    ro.observe(host);

    const raycaster = new T.Raycaster();
    const pointer = new T.Vector2();
    const onPointerUp = (ev: PointerEvent) => {
      if (
        !handlesRef.current?.activeAssetReady ||
        latestOverlayRef.current.frame.mappingMode === "logical-only"
      ) {
        return;
      }
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

    controls.enableDamping = !(
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );

    const handles: SceneHandles = {
      scene,
      camera,
      renderer,
      controls,
      serverGroup,
      overlayGroup,
      npuSlots: [],
      slotTopY: [],
      activeAssetReady: false,
      defaultCamPos,
      defaultTarget,
      fittedBbox: null,
      requestRender,
    };
    handlesRef.current = handles;

    return () => {
      disposed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (resizeRafId) window.cancelAnimationFrame(resizeRafId);
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

    handles.activeAssetReady = false;
    handles.fittedBbox = null;
    handles.npuSlots = [];
    handles.slotTopY = [];
    disposeObjectTree(handles.serverGroup);
    handles.serverGroup.clear();
    disposeObjectTree(handles.overlayGroup);
    handles.overlayGroup.clear();
    handles.requestRender();
    setAssetReady(null);

    const url = `${import.meta.env.BASE_URL}experiences/whole/assets/${hardwareModel}.glb`;
    new GLTFLoader().load(
      url,
      (gltf) => {
        if (cancelled || handlesRef.current !== handles) {
          disposeObjectTree(gltf.scene);
          return;
        }
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

        root.updateMatrixWorld(true);
        const rootInv = new T.Matrix4().copy(root.matrixWorld).invert();
        const npuEntries = parts
          .filter((o) => o.userData.kind === "npu")
          .map((o) => {
            const m = o.name.match(/(?:npu|card)(\d+)$/i);
            return { part: o, idx: m ? Number(m[1]) : 999 };
          })
          .sort((a, b) => a.idx - b.idx);

        handles.slotTopY = npuEntries.map((e) => computePartLocalTopY(e.part));
        const optimizedGroup = optimizeStaticChassisTree(root);
        const keptMats = new Set<T.Material>();
        optimizedGroup.traverse((obj) => {
          const mat = (obj as T.Mesh).material;
          if (Array.isArray(mat)) {
            for (const m of mat) keptMats.add(m);
          } else if (mat) {
            keptMats.add(mat);
          }
        });
        gltf.scene.traverse((obj) => {
          const mesh = obj as T.Mesh;
          if (!mesh.isMesh) return;
          if (!obj.visible || mesh.geometry) {
            // Hidden parts (lid/cooling) were excluded from optimizeStaticChassisTree; release unreferenced resources
            let vis = true;
            let cur: T.Object3D | null = mesh;
            while (cur) {
              if (!cur.visible) {
                vis = false;
                break;
              }
              cur = cur.parent;
            }
            if (!vis && mesh.geometry) mesh.geometry.dispose();
          }
          const mat = mesh.material;
          if (Array.isArray(mat)) {
            for (const m of mat) {
              if (!keptMats.has(m)) disposeMaterial(m);
            }
          } else if (mat && !keptMats.has(mat)) {
            disposeMaterial(mat);
          }
        });

        const slotAnchors = npuEntries.map((e) => {
          const anchor = new T.Group();
          const rel = new T.Matrix4().multiplyMatrices(rootInv, e.part.matrixWorld);
          rel.decompose(anchor.position, anchor.quaternion, anchor.scale);
          anchor.name = e.part.name;
          optimizedGroup.add(anchor);
          return anchor;
        });

        handles.serverGroup.add(optimizedGroup);
        handles.serverGroup.updateMatrixWorld(true);
        handles.npuSlots = slotAnchors;
        handles.activeAssetReady = true;
        handles.fittedBbox = null;
        const cur = latestOverlayRef.current;
        syncAndFitStageOverlay(handles, cur.frame, cur.selectedRank, false);
        handles.renderer.render(handles.scene, handles.camera);
        setAssetReady(hardwareModel);
      },
      undefined,
      () => {
        if (cancelled || handlesRef.current !== handles) return;
        handles.activeAssetReady = false;
        handles.fittedBbox = null;
        handles.npuSlots = [];
        handles.slotTopY = [];
        disposeObjectTree(handles.serverGroup);
        handles.serverGroup.clear();
        disposeObjectTree(handles.overlayGroup);
        handles.overlayGroup.clear();
        handles.requestRender();
        setAssetReady("error");
      },
    );

    return () => {
      cancelled = true;
    };
  }, [hasActivated, hardwareModel]);

  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles || !handles.activeAssetReady || assetReady !== hardwareModel) return;
    syncAndFitStageOverlay(handles, frame, selectedRank, true);
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
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-scene-ready={
        webglUnavailable
          ? "webgl-fallback"
          : assetReady === frame.spec.hardwareModel
            ? "true"
            : assetReady === "error"
              ? "error"
              : "loading"
      }
      style={{ marginTop: 12, padding: "14px 16px", boxSizing: "border-box", maxWidth: "100%" }}
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
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: 14,
          marginTop: 10,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            position: "relative",
            minWidth: 0,
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
          ) : assetReady === "error" ? (
            <div
              data-testid="troubleshoot-3d-asset-error"
              role="status"
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
              <strong>3D 机箱模型资源加载失败（{hardwareModel}.glb）</strong>
              <span>
                已清空上一机型残留几何体与拾取命中，避免误标槽位；右侧多卡状态矩阵、故障时间轴与原行定位仍完整可用。
              </span>
            </div>
          ) : (
            <button
              type="button"
              className="wt-preset-btn"
              data-testid="troubleshoot-3d-reset-view"
              disabled={assetReady !== hardwareModel}
              onClick={handleResetCamera}
              style={{ position: "absolute", top: 8, right: 8, background: "rgba(252,251,247,0.9)" }}
            >
              复位视角
            </button>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 10,
            minWidth: 0,
          }}
        >
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
                overflowWrap: "anywhere",
              }}
            >
              阶段 {frame.activeStage.index} / {maxStep}：{frame.activeStage.title}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 128px), 1fr))",
                gap: 6,
                marginTop: 8,
              }}
            >
              {frame.rankUnits.map((u: DerivedRankUnitState) => {
                const pal = STATE_PALETTE[u.state];
                const isUnmappedSlot = frame.mappingMode === "logical-only" || u.logicalRank === null;
                const pickLogicalRank = isUnmappedSlot ? null : u.logicalRank;
                const isSel =
                  !isUnmappedSlot &&
                  ((pickLogicalRank !== null && selectedRank === pickLogicalRank) ||
                    frame.activeStage.focusRank === u.rank);
                return (
                  <button
                    key={u.rank}
                    type="button"
                    disabled={isUnmappedSlot}
                    aria-disabled={isUnmappedSlot}
                    data-testid={`troubleshoot-3d-slot-${u.rank}`}
                    data-slot-state={u.state}
                    data-fault-mechanism={u.faultMechanism}
                    onClick={() => {
                      if (!isUnmappedSlot && pickLogicalRank !== null) {
                        onSelectEvidence(pickLogicalRank, u.evidenceLineNumber);
                      }
                    }}
                    style={{
                      textAlign: "left",
                      padding: "6px 8px",
                      borderRadius: "var(--radius-field)",
                      border: `${isSel ? "2px" : "1px"} solid ${pal.badgeBorder}`,
                      background: pal.badgeBg,
                      color: pal.badgeText,
                      cursor: isUnmappedSlot ? "default" : "pointer",
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
                disabled={maxStep === 0 || assetReady === "loading"}
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
                <strong style={{ color: "#8f291f" }}>✕</strong> RoCE 物理端口断链（端口/光模块实证）
              </span>
              <span>
                <strong style={{ color: "#d9483b" }}>◎</strong> 网卡绑定 / 路由异常（RaSocketBind / IP /
                路由）
              </span>
              <span>
                <strong style={{ color: "#d97706" }}>◆</strong> 传输/Ranktable 初始化异常（EI0004 / EI0009 /
                EJ0001）
              </span>
              <span>
                <strong style={{ color: "#9a4b86" }}>■</strong> 次生等待超时
              </span>
              <span>
                <strong style={{ color: "#9a4b86" }}>⌒</strong> 示意等待依赖（非物理网线包序）
              </span>
              <span>
                <strong style={{ color: "#c78300" }}>■</strong> 待核超时 / 建链拒连
              </span>
              <span>
                <strong style={{ color: "#087f73" }}>■</strong> 参与运行
              </span>
              <span>
                <strong style={{ color: "#8f968e" }}>□</strong> 未参与 / 可见待命
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
