/** Coalesce tiny stream chunks, with an explicit flush for completion, stop and errors. */
export function textBatch(append: (text: string) => void) {
  let pending = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (!pending) return;
    const text = pending;
    pending = "";
    append(text);
  };
  return {
    push(text: string) {
      pending += text;
      timer ??= setTimeout(flush, 50);
    },
    flush,
  };
}
