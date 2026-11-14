export const EXAMPLE_WEIGHT = [
  [1, 3, -1, 2],
  [2, -1, 2, -2],
] as const;
export function splitProjection(x: readonly number[]) {
  const partial = EXAMPLE_WEIGHT.map((row, i) => row.map((w) => w * x[i]!));
  const complete = partial[0]!.map((v, i) => v + partial[1]![i]!);
  return { partial, complete, columns: [complete.slice(0, 2), complete.slice(2)] };
}
export function parallelGroups(mode: "tp" | "pp" | "dp") {
  const size = mode === "tp" ? 8 : 4;
  return Array.from({ length: 16 / size }, (_, group) =>
    Array.from({ length: size }, (_, i) => group * size + i),
  );
}
export function pipelineCell(stage: number, tick: number, batches: number) {
  const batch = tick - stage;
  return batch >= 0 && batch < batches ? batch : null;
}
