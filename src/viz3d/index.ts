export { Clock } from "./Clock";
export { CameraDirector, LAB_FOV } from "./camera/CameraDirector";
export { type CameraPose, CameraRig, type CameraRigProps } from "./camera/CameraRig";
export { CAMERA_VIEWS, LAB_FOV as VIEW_FOV, type ViewPreset, viewPreset } from "./camera/views";
export { LABEL_FONT, LABEL_SIZE, Label, type LabelProps, MONO_FONT } from "./labels/Label";
export { LabelProbe, type LabelProbeWindow } from "./labels/LabelProbe";
export {
  boundsOverlap,
  collectLabelBounds,
  type LabelBounds,
  labelCount,
  registerLabel,
} from "./labels/registry";
export { CellWindow, MAX_WINDOW_CELLS } from "./primitives/CellWindow";
export { displayNotes } from "./primitives/notes";
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
export { StepScene } from "./scenes/StepScene";
export {
  getSceneLayout,
  type ResolvedScene,
  resolveScene,
  type SceneLayout,
  type SlotSpec,
  sceneLayout,
} from "./scenes/sceneLayout";
export { resetVizTheme, type VizColorName, type VizTheme, vizTheme } from "./theme";
