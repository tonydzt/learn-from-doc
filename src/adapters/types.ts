export type DocScope = {
  host: string;
  scopeKey: string;
  scopeTitle: string;
};

export type SidebarLink = {
  url: string;
  title: string;
  element: HTMLAnchorElement;
};

export type ProgressInsertionTargets = {
  sidebarRoot: Element;
  totalProgressBefore: Element | null;
  pageLinkTargets: Array<{
    url: string;
    title: string;
    anchor: HTMLAnchorElement;
  }>;
};

export type DocSiteAdapter = {
  id: string;
  matches(url: URL): boolean;
  getDocScope(): DocScope | null;
  expandLazyNavigation(): Promise<void>;
  getSidebarLinks(): SidebarLink[];
  getArticleRoot(): HTMLElement | null;
  getProgressInsertionTargets(): ProgressInsertionTargets | null;
};
