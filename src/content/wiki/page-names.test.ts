import { expect, it } from "vitest";
import { findPageByName } from "./page-names";

it("canonical IDs take precedence over other pages' aliases; fuzzy matches remain missing", () => {
  const pages = [
    { id: "a", title: "A", aliases: ["rmsnorm", " Head dim "] },
    { id: "rmsnorm", title: "RMS norm", aliases: [] },
  ];
  expect(findPageByName(pages, " RMSNORM ")?.id).toBe("rmsnorm");
  expect(findPageByName(pages, "head dim")?.id).toBe("a");
  expect(findPageByName(pages, "RMS norm")?.id).toBe("rmsnorm");
  expect(findPageByName(pages, "head-dim")).toBeUndefined();
  expect(findPageByName(pages, " ")).toBeUndefined();
});
