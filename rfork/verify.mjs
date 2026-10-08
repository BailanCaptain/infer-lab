// Read-only verification; --git also reconstructs the full tree in a temporary Git index.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const home = dirname(fileURLToPath(import.meta.url));
const root = dirname(home);
const manifest = JSON.parse(readFileSync(join(home, "manifest.json"), "utf8"));
const config = parse(readFileSync(resolve(root, manifest.seedFile), "utf8"));
const repo = config.repos[manifest.repo];
const pin = repo.refs[manifest.ref];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const check = (condition, message) => { if (!condition) throw new Error(message); };
function verifyFile(path, expected) {
  const bytes = readFileSync(join(home, path));
  check(hash(bytes) === expected, `SHA256 mismatch: ${path}`);
  return bytes;
}
for (const [path, expected] of Object.entries(manifest.sourceFiles)) verifyFile(`source/${path}`, expected);
const actual = readdirSync(join(home, "source"), { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile())
  .map(entry => relative(join(home, "source"), join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
  .sort();
check(JSON.stringify(actual) === JSON.stringify(Object.keys(manifest.sourceFiles).sort()), "Source file inventory differs from manifest");
for (const patch of manifest.patches) verifyFile(`patches/${patch.file}`, patch.sha256);
verifyFile(`reconciliation/${manifest.reconciliation.file}`, manifest.reconciliation.sha256);
console.log(`OK local integrity: ${actual.length} source files, ${manifest.patches.length} original patches + reconciliation`);

if (process.argv.includes("--git")) {
  const cwd = resolve(root, repo.path);
  const git = (...args) => execFileSync("git", args, { cwd, maxBuffer: 32 << 20 });
  for (const [path, expected] of Object.entries(manifest.sourceFiles)) {
    check(hash(git("show", `${pin}:${path}`)) === expected, `Pinned source differs: ${path}`);
  }
  for (const patch of manifest.patches) {
    check(Boolean(patch.sourceCommit) === Boolean(patch.sourcePath), `Incomplete provenance: ${patch.file}`);
    if (patch.sourceCommit) {
      check(hash(git("show", `${patch.sourceCommit}:${patch.sourcePath}`)) === patch.sha256, `Original patch differs: ${patch.file}`);
    } else {
      check(typeof patch.origin === "string" && patch.origin.trim(), `Missing local patch origin: ${patch.file}`);
    }
  }
  const temp = mkdtempSync(join(tmpdir(), "rfork-verify-"));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: join(temp, "index") };
    const indexedGit = (...args) => execFileSync("git", args, { cwd, env, maxBuffer: 32 << 20 }).toString().trim();
    indexedGit("read-tree", manifest.baseCommit);
    const series = [
      ...manifest.patches.slice(0, 6).map(p => join(home, "patches", p.file)),
      join(home, "reconciliation", manifest.reconciliation.file),
      ...manifest.patches.slice(6).map(p => join(home, "patches", p.file)),
    ];
    for (const patch of series) {
      indexedGit("apply", "--cached", "--check", patch);
      indexedGit("apply", "--cached", patch);
    }
    const rebuilt = indexedGit("write-tree");
    const expected = git("rev-parse", `${pin}^{tree}`).toString().trim();
    check(rebuilt === expected, `Reconstructed tree ${rebuilt} != pinned tree ${expected}`);
    console.log(`OK original bytes and full-tree reconstruction: ${pin} tree=${rebuilt}`);
  } finally {
    check(resolve(temp).startsWith(`${resolve(tmpdir())}${sep}`), "Temporary index directory outside temp root");
    rmSync(temp, { recursive: true, force: true });
  }
}
