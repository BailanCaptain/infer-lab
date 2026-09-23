import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HANDBOOK_H2, HANDBOOK_H3 } from "./handbook";

/** 能切出全部切片的最小手册；H3 切片按真实位置放在「页面格式」下。 */
export function handbookFixture(): string {
  return Object.values(HANDBOOK_H2)
    .map((h) =>
      h === HANDBOOK_H2.pageFormat
        ? `## ${h}\n\nfixture\n${Object.values(HANDBOOK_H3)
            .map((sub) => `\n### ${sub}\n\nfixture\n`)
            .join("")}`
        : `## ${h}\n\nfixture\n`,
    )
    .join("\n");
}

/** Small local repositories only; tests never fetch the real upstream or invoke an agent. */
export function wikiFixture() {
  const root = mkdtempSync(join(tmpdir(), "wiki-foundation-"));
  const write = (file: string, text: string) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  };
  const git = (args: string[], dir = "repo") =>
    execFileSync("git", ["-c", "core.autocrlf=false", ...args], {
      cwd: join(root, dir),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  mkdirSync(join(root, "repo"));
  git(["init", "-b", "main"]);
  git(["config", "user.name", "Wiki fixture"]);
  git(["config", "user.email", "fixture@example.test"]);
  const commit = (message: string) => {
    git(["add", "."]);
    git(["commit", "-m", message]);
    return git(["rev-parse", "HEAD"]);
  };
  const cli = (name: string, args: string[]) => {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        import.meta.resolve("tsx"),
        fileURLToPath(new URL(`../${name}.ts`, import.meta.url)),
        ...args,
      ],
      {
        cwd: root,
        encoding: "utf8",
        // Use tsx's source/config-keyed cache; each child still reads fresh fixture data.
        windowsHide: true,
        timeout: 20_000,
        maxBuffer: 2 << 20,
      },
    );
    if (result.error)
      throw new Error(`CLI ${name} 启动或执行失败：${result.error.message}`, { cause: result.error });
    return result;
  };
  const cleanup = () => {
    const within = relative(resolve(tmpdir()), resolve(root));
    if (!within.startsWith("wiki-foundation-") || within.includes(".."))
      throw new Error("Invalid fixture root");
    rmSync(root, { recursive: true, force: true });
  };
  return { root, write, git, commit, cli, cleanup };
}
