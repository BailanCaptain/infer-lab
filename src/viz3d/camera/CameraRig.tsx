/**
 * 相机装置：把相机平滑推到目标机位（maath/easing.damp3），无动效时瞬移。
 * CameraDirector（按 step.camera.view 查预设）在此之上，本文件只负责运镜本身。
 */
import { useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";
import { useRef } from "react";
import { Vector3 } from "three";

export interface CameraPose {
  pos: [number, number, number];
  target: [number, number, number];
}

export interface CameraRigProps {
  pose: CameraPose;
  /** 无动效 / reduced motion：直接到位 */
  instant?: boolean;
  /** 阻尼时间（秒），越小越快 */
  smoothTime?: number;
}

export function CameraRig({ pose, instant = false, smoothTime = 0.45 }: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const target = useRef(new Vector3(...pose.target));

  useFrame((_, dt) => {
    if (instant) {
      camera.position.set(...pose.pos);
      target.current.set(...pose.target);
    } else {
      easing.damp3(camera.position, pose.pos, smoothTime, dt);
      easing.damp3(target.current, pose.target, smoothTime, dt);
    }
    camera.lookAt(target.current);
  });

  return null;
}
