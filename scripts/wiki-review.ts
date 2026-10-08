import { parseArgs } from "node:util";
import { approveReview, listReviews, readReview, rejectReview, reviewDiff } from "./wiki/review";
import { WorkflowStore } from "./wiki/workflow";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { reason: { type: "string" }, help: { type: "boolean" } },
});
const [command = "list", id] = positionals;
const root = process.cwd();
try {
  if (values.help)
    console.log(
      "wiki:review list | show <revision> | approve <revision> | reject <revision> --reason <原因> | recover <revision>\n整合仅生成待审包；show 查看完整 diff，approve 明确批准该 revision。recover 只续写已经批准的发布，不启动 agent。",
    );
  else if (command === "list" && positionals.length <= 1)
    console.log(
      JSON.stringify(
        listReviews(root).map(({ id, state, reason, payload }) => ({
          id,
          state,
          reason,
          decision: payload.decision,
          files: payload.writes.map((w) => w.path),
        })),
        null,
        2,
      ),
    );
  else if (!id || positionals.length !== 2) throw new Error("需要一个完整 revision；查看 --help");
  else if (command === "show") {
    const review = readReview(root, id);
    console.log(
      JSON.stringify(
        { id, state: review.state, reason: review.reason, decision: review.payload.decision },
        null,
        2,
      ),
    );
    console.log(reviewDiff(root, id));
  } else if (command === "reject")
    console.log(JSON.stringify(await rejectReview(root, id, values.reason ?? "")));
  else if (command === "approve" || command === "recover") {
    if (command === "recover") {
      const review = readReview(root, id);
      if (!["publishing", "published"].includes(review.state))
        throw new Error("recover 不能批准尚未批准的 revision");
      new WorkflowStore(root).recoverLock();
    }
    const review = await approveReview(root, id);
    console.log(JSON.stringify({ id, state: review.state }));
  } else throw new Error("未知命令；查看 --help");
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
