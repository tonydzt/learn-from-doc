const SCROLLABLE_OVERFLOW = /auto|scroll|overlay/;

// 判断一个元素本身是否可能产生滚动。
// 需要同时满足两个条件：CSS overflow 允许滚动，且实际内容高度大于可视高度。
function isScrollable(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  // 同时看 overflowY 和 overflow，是为了兼容站点只设置其中一个属性的情况。
  const overflow = `${style.overflowY} ${style.overflow}`;
  return SCROLLABLE_OVERFLOW.test(overflow) && element.scrollHeight > element.clientHeight;
}

// 从正文元素向上查找所有可滚动祖先容器。
// 有些文档站不是 window 滚动，而是某个中间 div 滚动；content script 需要监听这些容器的 scroll。
export function scrollableAncestors(element: HTMLElement): HTMLElement[] {
  const ancestors: HTMLElement[] = [];
  let current = element.parentElement;

  // body/documentElement 对应页面级滚动，调用方已经单独监听 window/document，这里只返回中间容器。
  while (current && current !== document.body && current !== document.documentElement) {
    if (isScrollable(current)) ancestors.push(current);
    current = current.parentElement;
  }

  return ancestors;
}
