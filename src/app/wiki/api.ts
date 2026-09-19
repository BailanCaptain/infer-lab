export async function wikiRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `/api/wiki/${path}`,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json", "x-wiki-review": "1" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `服务返回 ${response.status}`);
  return data as T;
}
