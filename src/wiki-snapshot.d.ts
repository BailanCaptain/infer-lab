declare module "virtual:wiki-reader-snapshot" {
  const snapshot: import("./content/wiki/schema").ReaderManifest;
  export const loadPage: (id: string) => Promise<import("./content/wiki/schema").ReaderPage>;
  export default snapshot;
}
