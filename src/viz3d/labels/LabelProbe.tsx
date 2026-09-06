/**
 * dev 探针：把当前帧所有标签的屏幕 AABB 挂到 window.__labels()，供 Playwright 断言不遮挡。
 * 只读，不触发渲染；生产页面不挂。
 */
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { collectLabelBounds, type LabelBounds } from "./registry";

export type LabelProbeWindow = Window & { __labels?: (() => LabelBounds[]) | undefined };

export function LabelProbe() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useEffect(() => {
    const w = window as LabelProbeWindow;
    w.__labels = () => collectLabelBounds(camera, size);
    return () => {
      w.__labels = undefined;
    };
  }, [camera, size]);
  return null;
}
