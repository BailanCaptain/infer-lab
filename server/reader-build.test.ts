import { expect, it } from "vitest";
import { getPage, getReaderState, listPages } from "../src/content/wiki/index";
import { readReaderSnapshot } from "./snapshot";

it("the build reader and API expose the same knowledge revision, pages and content", async () => {
  const snapshot = await readReaderSnapshot(process.cwd());
  expect(getReaderState()).toMatchObject({ revision: snapshot.revision, mode: "build" });
  expect(
    listPages()
      .map((p) => p.id)
      .sort(),
  ).toEqual(snapshot.registry.pages.map((p) => p.id).sort());
  for (const page of snapshot.registry.pages) {
    expect(getPage(page.id)?.fm).toEqual(page);
    expect(snapshot.pageTexts.find((p) => p.file === page.file)?.text).toContain(getPage(page.id)!.body);
  }
});
