import { syncFailureProjection } from "./wiki/persistent-extract";
import { WorkflowStore } from "./wiki/workflow";

const command = process.argv[2] ?? "list";
const store = new WorkflowStore(process.cwd());
if (command === "list") console.log(JSON.stringify(store.list(), null, 2));
else if (command === "recover") {
  const recovered = await store.recover();
  await syncFailureProjection(store);
  console.log(
    JSON.stringify(
      { recovered, message: "中断任务标记失败；未启动 agent。使用 ingest --retry-failed 显式重试。" },
      null,
      2,
    ),
  );
} else {
  console.error("用法：pnpm wiki:jobs [list|recover]");
  process.exitCode = 2;
}
