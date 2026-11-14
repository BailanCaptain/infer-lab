const subscripts = "₀₁₂₃₄₅₆₇₈₉";

/** i is the input position; n abbreviates component 4095 in the small scene. */
export const requestVector = (kind: "e" | "h" | "z", i: number) => [
  `${kind}${subscripts[i]}₀`,
  `${kind}${subscripts[i]}₁`,
  "…",
  `${kind}${subscripts[i]}ₙ`,
];

export type RequestCell = {
  value: string;
  key: string;
  identity: string;
  tone: number;
  row: number;
  col: number;
};

function identity(value: string) {
  if (/^[pyd][₀-₉][′?]*$/.test(value)) return value;
  const component = /^[ehz]([₀-₉])[₀-₉ₙ]$/.exec(value);
  if (component) return `p${component[1]}`;
  if (/^[vℓ][₀-₉ₖ]$/.test(value)) return value.replace("ℓ", "v");
  return "";
}

/** Identity follows the data, independent of which row or column currently displays it. */
export function requestCells(values: string[][]): RequestCell[] {
  const owners = values.map((row) => row.map(identity));
  const columnOwners = owners.find((row) => new Set(row.filter(Boolean)).size > 1);
  const allOwners = [...new Set(owners.flat().filter(Boolean))];
  const occurrences = new Map<string, number>();
  return values.flatMap((row, r) =>
    row.map((value, c) => {
      const own =
        owners[r]![c] ||
        (columnOwners ? columnOwners[c] : owners[r]!.find(Boolean)) ||
        (allOwners.length === 1 ? allOwners[0]! : "");
      const normalized = value.replace("⋮", "…");
      const key = `${own}:${normalized}`;
      const occurrence = occurrences.get(key) ?? 0;
      occurrences.set(key, occurrence + 1);
      return {
        value,
        key: `${key}:${occurrence}`,
        identity: own,
        tone: own.startsWith("p")
          ? subscripts.indexOf(own[1]!)
          : own.startsWith("y")
            ? 4
            : own.startsWith("d")
              ? 5
              : own.startsWith("v")
                ? 6
                : -1,
        row: r,
        col: c,
      };
    }),
  );
}

export function requestCellPairs(source: RequestCell[], target: RequestCell[]) {
  const destinations = new Map(target.map((cell, index) => [cell.key, index]));
  return source.flatMap((cell, from) => {
    const to = destinations.get(cell.key);
    return to === undefined ? [] : [{ from, to }];
  });
}
