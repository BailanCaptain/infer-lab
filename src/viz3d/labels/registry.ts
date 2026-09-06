/**
 * 标签边界注册表（dev 用）：把场景内每个标签的投影 AABB 收集起来，
 * 供 Playwright 断言「两两不相交且都在视口内」。运行时不做碰撞检测，
 * 不遮挡靠的是各图元预留的标签车道（lane），这里只是机械校验。
 */
import type { Box3, Camera, Object3D } from "three";
import { Vector3 } from "three";

export interface LabelBounds {
  id: string;
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Entry {
  obj: Object3D;
  text: string;
}

const entries = new Map<string, Entry>();

/** 注册一个标签；返回注销函数。同 id 覆盖。 */
export function registerLabel(id: string, obj: Object3D, text: string): () => void {
  entries.set(id, { obj, text });
  return () => {
    if (entries.get(id)?.obj === obj) entries.delete(id);
  };
}

export function labelCount(): number {
  return entries.size;
}

const v = new Vector3();

/** 世界坐标 → 屏幕像素（左上原点） */
function project(p: Vector3, camera: Camera, size: { width: number; height: number }): [number, number] {
  v.copy(p).project(camera);
  return [((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height];
}

/** 把每个标签的局部包围盒 8 个角投影到屏幕，取轴对齐外接矩形（偏保守）。 */
export function collectLabelBounds(camera: Camera, size: { width: number; height: number }): LabelBounds[] {
  const out: LabelBounds[] = [];
  for (const [id, { obj, text }] of entries) {
    const bb = (obj as Object3D & { geometry?: { boundingBox?: Box3 | null } }).geometry?.boundingBox;
    if (!bb) continue;
    obj.updateWorldMatrix(true, false);
    let x0 = Number.POSITIVE_INFINITY;
    let y0 = Number.POSITIVE_INFINITY;
    let x1 = Number.NEGATIVE_INFINITY;
    let y1 = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < 8; i++) {
      const c = new Vector3(
        i & 1 ? bb.max.x : bb.min.x,
        i & 2 ? bb.max.y : bb.min.y,
        i & 4 ? bb.max.z : bb.min.z,
      ).applyMatrix4(obj.matrixWorld);
      const [px, py] = project(c, camera, size);
      x0 = Math.min(x0, px);
      y0 = Math.min(y0, py);
      x1 = Math.max(x1, px);
      y1 = Math.max(y1, py);
    }
    if (!Number.isFinite(x0)) continue;
    out.push({ id, text, x0, y0, x1, y1 });
  }
  return out;
}

export function boundsOverlap(a: LabelBounds, b: LabelBounds, pad = 0): boolean {
  return a.x0 - pad < b.x1 && b.x0 - pad < a.x1 && a.y0 - pad < b.y1 && b.y0 - pad < a.y1;
}
