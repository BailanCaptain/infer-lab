import { parseArgs } from "node:util";
import { readSyncConfig, syncConfigSchema, syncWiki } from "./wiki/sync";

try {
  const { values } = parseArgs({ options: { config: { type: "string" }, plan: { type: "boolean" } } });
  const config = values.config ? readSyncConfig(values.config) : syncConfigSchema.parse({});
  if (values.plan)
    console.log(
      JSON.stringify(
        {
          config,
          phases: [
            "fetch-if-enabled",
            "parameter-diff",
            "github-incremental-if-initialized",
            "patrol",
            "bounded-reconcile-if-enabled",
            "bounded-drift-if-enabled",
            "bounded-worker-if-enabled",
          ],
          automaticBulkImport: false,
        },
        null,
        2,
      ),
    );
  else {
    const result = await syncWiki(process.cwd(), config);
    console.log(JSON.stringify(result, null, 2));
    if (result.patrol.findings.length || result.deferred) process.exitCode = 1;
  }
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
