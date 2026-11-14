/**
 * 页签条的键盘操作（WAI-ARIA tabs）：← → 循环切换，Home / End 跳到第一个 / 最后一个。
 * 返回要切到的页签下标；不是这几个键就返回 undefined，交给浏览器默认处理。
 */
export function tabIndexAfterKey(key: string, current: number, count: number): number | undefined {
  if (count <= 0) return undefined;
  switch (key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current + count - 1) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return undefined;
  }
}
