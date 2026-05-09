export type IndexLink = {
  url: string;
  title: string;
};

export function indexLinksForMode<T extends IndexLink>(links: T[], debug: boolean): T[] {
  return debug ? links.slice(0, 1) : links;
}

export function shouldOpenMeasuredTabActive(debug: boolean): boolean {
  return debug;
}

export function shouldKeepMeasuredTabOpen(debug: boolean): boolean {
  return debug;
}
