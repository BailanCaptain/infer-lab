import { join, resolve } from "node:path";
import { createServer, normalizePath } from "vite";
import { expect, it } from "vitest";
import { saveRawSnapshot } from "../scripts/wiki/raw";
import { wikiReaderPlugin } from "../scripts/wiki/reader-plugin";
import { handbookFixture, wikiFixture } from "../scripts/wiki/test-fixture";
import { readReaderSnapshot } from "./snapshot";

it("the build reader and API expose the same knowledge revision, pages and content", async () => {
  const f = wikiFixture();
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  try {
    f.write("wiki/HANDBOOK.md", handbookFixture());
    const raw = saveRawSnapshot(join(f.root, "wiki"), "两份资料的原文依据。\n");
    const pageText = (id: string, body: string) =>
      `---\nid: ${id}\ntitle: 资料 ${id}\ntype: source\nsummary: 读者构建验收\nsources: [raw:${raw.slice(4)}#L1]\nevidence: I\nupdated: '2026-11-02'\n---\n${body}\n`;
    const bodies = new Map([
      ["a", "## 原有资料\n\n保留版本条件。"],
      ["b", "## 关联资料\n\n参见 [原有资料](a.md)。"],
    ]);
    for (const [id, body] of bodies) f.write(`wiki/sources/${id}.md`, pageText(id, body));
    server = await createServer({
      root: f.root,
      configFile: false,
      cacheDir: join(f.root, ".vite"),
      plugins: [wikiReaderPlugin()],
      server: { middlewareMode: true, watch: null, hmr: false },
      appType: "custom",
    });
    const reader = (await server.ssrLoadModule(
      `/@fs/${normalizePath(resolve("src/content/wiki/index.ts"))}`,
    )) as typeof import("../src/content/wiki/index");
    const snapshot = await readReaderSnapshot(f.root);
    expect(snapshot.skipped).toEqual([]);
    expect(snapshot.registry.pages.map((p) => p.id).sort()).toEqual([...bodies.keys()]);
    expect(reader.getReaderState()).toMatchObject({ revision: snapshot.revision, mode: "build" });
    expect(
      reader
        .listPages()
        .map((p) => p.id)
        .sort(),
    ).toEqual(snapshot.registry.pages.map((p) => p.id).sort());

    // Lazy build imports must stay on their captured revision even after the live Wiki changes.
    f.write("wiki/sources/b.md", pageText("b", "后续发布的新正文。"));
    const live = await readReaderSnapshot(f.root);
    expect(live.revision).not.toBe(snapshot.revision);
    for (const page of snapshot.registry.pages) {
      await reader.ensurePage(page.id);
      expect(reader.getPage(page.id)).toEqual({ fm: page, body: bodies.get(page.id), compiled: snapshot.pageTexts.find((p) => p.file === page.file)?.compiled });
      expect(snapshot.pageTexts.find((p) => p.file === page.file)?.text).toBe(
        pageText(page.id, bodies.get(page.id)!),
      );
    }
    reader.installReaderSnapshot(live);
    expect(reader.getReaderState()).toMatchObject({ revision: live.revision, mode: "local" });
    expect(reader.getPage("b")?.body).toBe("后续发布的新正文。");
  } finally {
    await server?.close();
    f.cleanup();
  }
});
