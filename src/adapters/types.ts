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
  requiresIndexingLoadWait?: boolean;
  requiresStableInitialArticle?: boolean;
  // `requiresIndexingLoadWait` 会在后台等待整个标签页 load 完成；Docker Docs 的页面可能长期不进入 complete，
  // 所以需要在内容脚本已定位正文后，仅等待 adapter 自己关心的资源（例如正文图片）再测量。
  waitForIndexMeasurement?(): Promise<void>;
  // Adapter 是“站点专用解析器”：核心逻辑不猜 DOM 结构，只问当前站点 adapter 去哪里找导航和正文。
  matches(url: URL): boolean;
  matchesIndexedScopeForUrl?(url: URL, scope: Pick<DocScope, 'host' | 'scopeKey'>): boolean;
  detect?(): FrameworkDetection | null;
  getDocScopeForUrl(url: URL): DocScope | null;
  getDocScope(): DocScope | null;
  expandLazyNavigation(): Promise<void>;
  getSidebarLinks(): SidebarLink[];
  getArticleRoot(): HTMLElement | null;
  isPageIndexable?(): boolean;
  getProgressInsertionTargets(): ProgressInsertionTargets | null;
};
