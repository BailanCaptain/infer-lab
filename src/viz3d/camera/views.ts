/**
 * 相机预设：按 step.camera.view 的 8 个取值给「看的方向」，距离由场景包围盒算（layout.frameDistance），
 * 不写死坐标。方向是单位向量的近似，CameraDirector 会归一化。
 */
/** 单台透视相机的竖直视场（近正交，保留深度线索） */
export const LAB_FOV = 22;

export interface ViewPreset {
  /** 从目标点指向相机的方向 */
  dir: [number, number, number];
  /** 取景余量（1 = 刚好装下） */
  margin: number;
}

export const CAMERA_VIEWS: Record<string, ViewPreset> = {
  embed: { dir: [0, 0.1, 1], margin: 1.1 },
  norm: { dir: [0, 0.1, 1], margin: 1.1 },
  matmul: { dir: [0.14, 0.2, 0.97], margin: 1.08 },
  heads: { dir: [0.36, 0.22, 0.9], margin: 1.1 },
  attention: { dir: [0.28, 0.2, 0.94], margin: 1.1 },
  mlp: { dir: [0.1, 0.15, 0.98], margin: 1.08 },
  residual: { dir: [0, 0.12, 1], margin: 1.1 },
  kv: { dir: [0.3, 0.3, 0.9], margin: 1.12 },
};

export const DEFAULT_VIEW: ViewPreset = { dir: [0, 0.1, 1], margin: 1.1 };

export function viewPreset(view: string | undefined): ViewPreset {
  return (view && CAMERA_VIEWS[view]) || DEFAULT_VIEW;
}
