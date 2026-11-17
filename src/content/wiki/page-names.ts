/** 课程入口与阅读器共用精确名称匹配；相似检索不代表已有对应讲解。 */
export function findPageByName<
  T extends {
    id: string;
    title: string;
    displayTitle?: string | undefined;
    aliases: readonly string[];
  },
>(pages: readonly T[], text: string): T | undefined {
  const key = text.trim().toLowerCase();
  if (!key) return undefined;
  return (
    pages.find((p) => p.id.toLowerCase() === key) ??
    pages.find((p) =>
      [p.title, ...(p.displayTitle ? [p.displayTitle] : []), ...p.aliases].some(
        (name) => name.trim().toLowerCase() === key,
      ),
    )
  );
}
