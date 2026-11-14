/** CSS tokens are the single source for the article's 2D and 3D colors. */
export function scenePalette(host: HTMLElement) {
  const css = getComputedStyle(host);
  const read = (name: string) => css.getPropertyValue(`--scene-${name}`).trim();
  return {
    paper: read("paper"),
    ink: read("ink"),
    muted: read("muted"),
    line: read("line"),
    data: read("data"),
    result: read("result"),
    board: read("board"),
    metal: read("metal"),
    chip: read("chip"),
    memory: read("memory"),
    weight: read("weight"),
    weightSoft: read("weight-soft"),
    wire: read("wire"),
    resid: [read("resid"), read("resid-soft")] as [string, string],
    norm: [read("norm"), read("norm-soft")] as [string, string],
    kda: [read("kda"), read("kda-soft")] as [string, string],
    dense: [read("dense"), read("dense-soft")] as [string, string],
    embed: [read("embed"), read("embed-soft")] as [string, string],
  };
}
