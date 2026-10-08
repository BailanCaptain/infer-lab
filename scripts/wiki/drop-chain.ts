type DropText = { id: string; source: string; text: string; receivedAt: string };
const wait = /等待.{0,40}(到来|文件|消息)|\b(?:wait|hold)\s+(?:for|until)\b|当.{1,30}时(?:执行|触发)/i;
const execute =
  /(?:现在|然后|接下来)\s*(执行|运行|发送|输出)|\b(?:execute|run|perform)\s+(?:the|this|now|payload)|\b(?:ignore|override|reveal)\b/i;
export function detectDropChain(current: DropText, history: DropText[]) {
  const flags = new Set<string>();
  for (const other of history) {
    const age = Date.parse(current.receivedAt) - Date.parse(other.receivedAt);
    if (other.id === current.id || age < 0 || age > 7 * 86400000) continue;
    if (
      (wait.test(current.text) && execute.test(other.text)) ||
      (execute.test(current.text) && wait.test(other.text))
    )
      flags.add("keyword-chain");
    if (current.text.includes(`drop:${other.id}`) && other.text.includes(`drop:${current.id}`))
      flags.add("mutual-reference");
    const tokens = (text: string) => new Set(text.toLowerCase().match(/[a-z0-9_]+|[\u4e00-\u9fff]/g) ?? []);
    const a = tokens(current.text);
    const b = tokens(other.text);
    const union = new Set([...a, ...b]);
    const similarity = union.size ? [...a].filter((x) => b.has(x)).length / union.size : 0;
    const chapter = (text: string) =>
      /^(?:#+\s*)?(?:第([一二三四五六七八九十0-9]+)[章节篇]|(?:part|chapter)\s+(\d+))/im.exec(text)?.[0];
    const ordinarySeries =
      chapter(current.text) &&
      chapter(other.text) &&
      chapter(current.text) !== chapter(other.text) &&
      !execute.test(`${current.text}\n${other.text}`) &&
      !wait.test(`${current.text}\n${other.text}`);
    if (current.source === other.source && similarity >= 0.8 && !ordinarySeries)
      flags.add("same-source-overlap");
  }
  return [...flags].sort();
}
