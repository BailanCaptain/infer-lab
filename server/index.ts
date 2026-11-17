/** Local wiki HTTP entry point. Shared handlers own parsing and workflow contracts. */
import { resolve } from "node:path";
import { createWikiServer } from "./app";
import { readReaderSnapshot } from "./snapshot";

const root = resolve(process.cwd());
const port = Number(process.env.WIKI_SERVER_PORT ?? 8790);
const server = createWikiServer(root);
server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  console.log(
    `wiki server → http://127.0.0.1:${typeof address === "object" && address ? address.port : port}`,
  );
  setImmediate(() => {
    void readReaderSnapshot(root).catch((error) =>
      console.warn("知识库预热未完成，下次读取会重试：", String(error)),
    );
  });
});
