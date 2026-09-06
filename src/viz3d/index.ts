export { Clock } from "./Clock";
export { type CameraPose, CameraRig, type CameraRigProps } from "./camera/CameraRig";
export { LABEL_FONT, LABEL_SIZE, Label, type LabelProps } from "./labels/Label";
export { LabelProbe, type LabelProbeWindow } from "./labels/LabelProbe";
export {
  boundsOverlap,
  collectLabelBounds,
  type LabelBounds,
  labelCount,
  registerLabel,
} from "./labels/registry";
export { CellWindow, MAX_WINDOW_CELLS } from "./primitives/CellWindow";
export { TensorGrid, type TensorGridProps } from "./primitives/TensorGrid";
export { TensorPlane, textureShape } from "./primitives/TensorPlane";
export {
  displayAspect,
  fmtAspect,
  fmtCell,
  MASK_SENTINEL,
  type PlaneBox,
  type PlaneSize,
  planeSize,
  type Rect,
  rectUv,
  robustScale,
  sampleAxis,
  windowRect,
} from "./scale";
export { resetVizTheme, type VizColorName, type VizTheme, vizTheme } from "./theme";
