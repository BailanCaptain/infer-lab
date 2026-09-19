import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { materializeSnapshot, readKnowledgeSnapshot } from "../server/snapshot";
import { checkEvalSnapshot, verifyEvalSuite } from "./wiki/eval";
import { createBlobReader } from "./wiki/git";

// Preparation only: never imports an agent runner, compiles sources or publishes wiki pages.
try {
  const { values } = parseArgs({
    options: {
      repo: { type: "string", default: "tools/repos/vllm-ascend" },
      phase: { type: "string", default: "before" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "wiki:eval [--repo <本地 vllm-ascend 克隆>] [--phase before|after]：零模型调用，验证固定六场景、来源散列和知识快照；不是语义验收通过。",
    );
  } else {
    if (values.phase !== "before" && values.phase !== "after")
      throw new Error("phase 必须是 before 或 after");
    const read = createBlobReader();
    const suite = verifyEvalSuite(
      JSON.parse(readFileSync(new URL("./wiki/eval-suite.json", import.meta.url), "utf8")),
      (commit, path) => read(values.repo, commit, path),
    );
    const snapshot = await readKnowledgeSnapshot(process.cwd());
    checkEvalSnapshot(suite, snapshot, values.phase);
    const location = await materializeSnapshot(process.cwd(), snapshot);
    console.log(
      JSON.stringify(
        {
          status: "prepared-only",
          phase: values.phase,
          suiteRevision: suite.revision,
          knowledgeRevision: snapshot.revision,
          location,
          pages: snapshot.pageTexts.length,
          cases: suite.cases.map((c) => ({ id: c.id, kind: c.kind, status: "尚未验证" })),
          verifiedEvidence: suite.evidence.length,
          modelCalls: 0,
          costUsd: 0,
          note: "来源存在、散列及行号已核对；不等于回答事实正确、引用支持或前后改善已通过。",
        },
        null,
        2,
      ),
    );
  }
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
