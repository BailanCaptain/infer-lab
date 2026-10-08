import { createServer } from "node:http";
import { expect, it } from "vitest";
import { handbookFixture, wikiFixture } from "../scripts/wiki/test-fixture";
import { handleDrop } from "./drop";

it("requires local same-origin writes, persists partial input failures and never starts a model during intake", async () => {
  const f = wikiFixture();
  f.write("wiki/HANDBOOK.md", handbookFixture());
  let calls = 0;
  const server = createServer(async (req, res) => {
    if (
      !(await handleDrop(req, res, f.root, {
        runAgent: async () => {
          calls++;
          throw new Error("unexpected");
        },
      }))
    ) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("port");
  const base = `http://127.0.0.1:${address.port}/api/wiki/drops`;
  const body = {
    key: "http",
    items: [
      { name: "first.md", text: "普通资料正文" },
      { name: "broken.pdf", text: "unsupported" },
    ],
  };
  const post = (url: string, data: unknown, headers: Record<string, string> = {}) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-wiki-review": "1", ...headers },
      body: JSON.stringify(data),
    });
  try {
    expect((await post(base, body, { origin: "https://evil.example" })).status).toBe(403);
    expect((await post(base, { ...body, arbitraryPath: "C:/private" })).status).toBe(400);
    const response = await post(base, body);
    expect(response.status).toBe(201);
    const { batch } = (await response.json()) as { batch: import("../src/content/wiki/drop").DropBatch };
    expect(batch.issues).toHaveLength(1);
    expect(batch.sources).toHaveLength(1);
    expect(calls).toBe(0);
    expect((await post(`${base}/${batch.id}/run`, {})).status).toBe(409);
    expect((await post(`${base}/${batch.id}/edit`, { remove: [1] })).status).toBe(200);
    const { batches } = (await (await fetch(base)).json()) as {
      batches: import("../src/content/wiki/drop").DropBatch[];
    };
    expect(batches[0].issues).toEqual([]);
    expect(calls).toBe(0);
    expect((await post(`${base}/${batch.id}/cancel`, { unexpected: true })).status).toBe(400);
    expect((await post(`${base}/${batch.id}/cancel`, {})).status).toBe(200);
  } finally {
    await new Promise<void>((r, e) => server.close((err) => (err ? e(err) : r())));
    f.cleanup();
  }
});
