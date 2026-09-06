/**
 * Canvas 内唯一的时钟：每帧把真实经过时间交给 timeline/progress.advance。
 * 不渲染任何东西，也不触发 React 状态更新；换步由 advance 内部调用 store.next() 完成。
 */
import { useFrame } from "@react-three/fiber";
import { advance } from "../timeline/progress";

/** 单帧最大步进（s）：切标签页回来时不要一口气跳过多步 */
const MAX_FRAME_S = 0.1;

export function Clock() {
  useFrame((_, delta) => {
    advance(Math.min(delta, MAX_FRAME_S) * 1000);
  });
  return null;
}
