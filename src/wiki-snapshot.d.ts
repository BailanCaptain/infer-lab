declare module "virtual:wiki-reader-snapshot" {
  const snapshot: import("./content/wiki/schema").ReaderManifest;
  export const loadPage: (id: string) => Promise<import("./content/wiki/schema").ReaderPage>;
  export const loadSearchIndex: () => Promise<import("./content/wiki/schema").ReaderSearchIndex>;
  export const loadPageEvidence: (
    id: string,
    revision: string,
  ) => Promise<import("./content/wiki/evidence-schema").ReaderPageEvidence>;
  export const loadWikiGraph: () => Promise<import("./content/wiki/schema").ReaderGraph>;
  export default snapshot;
}
