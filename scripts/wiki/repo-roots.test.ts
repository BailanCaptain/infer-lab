import { join } from "node:path";
import { expect, it } from "vitest";
import { configuredRepoRoots } from "./repo-roots";
import { wikiFixture } from "./test-fixture";

it("uses all seed mappings by default and rejects conflicting roots", () => {
  const f = wikiFixture();
  try {
    const seed = (name: string, path: string) =>
      `repos:\n  ${name}:\n    url: https://github.com/example/${name}\n    path: ${path}\n    refs: { main: abcdef12 }\nfeatures: []\n`;
    f.write("wiki/seeds/a.yaml", seed("a", "repo-a"));
    f.write("wiki/seeds/b.yaml", seed("b", "repo-b"));
    expect(configuredRepoRoots(f.root)).toEqual({ a: join(f.root, "repo-a"), b: join(f.root, "repo-b") });
    expect(configuredRepoRoots(f.root, "wiki/seeds/a.yaml")).toEqual({ a: join(f.root, "repo-a") });
    f.write("wiki/seeds/c.yaml", seed("a", "other"));
    expect(() => configuredRepoRoots(f.root)).toThrow("不一致");
  } finally {
    f.cleanup();
  }
});
