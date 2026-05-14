export type DocScope = {
  host: string;
  scopeKey: string;
  scopeTitle: string;
  frameworkName?: string;
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

export type FrameworkDetection = {
  frameworkName: string;
  confidence: 'high' | 'medium';
  indexable: boolean;
};

export type DocSiteAdapter = {
  id: string;
  kind?: 'site' | 'framework';
  frameworkName?: string;
  requiresHydrationWait?: boolean;
  // Adapter 是“站点专用解析器”：核心逻辑不猜 DOM 结构，只问当前站点 adapter 去哪里找导航和正文。
  matches(url: URL): boolean;
  detect?(): FrameworkDetection | null;
  getDocScopeForUrl(url: URL): DocScope | null;
  getDocScope(): DocScope | null;
  expandLazyNavigation(): Promise<void>;
  getSidebarLinks(): SidebarLink[];
  getArticleRoot(): HTMLElement | null;
  isPageIndexable?(): boolean;
  getProgressInsertionTargets(): ProgressInsertionTargets | null;
};
