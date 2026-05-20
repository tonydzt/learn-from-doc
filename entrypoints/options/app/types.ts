import type { AppSettings } from '../../../src/settings/app-settings';
import type { SiteSettings } from '../../../src/settings/site-settings';
import type { IndexOverview, SiteSnapshot } from '../../../src/shared/messages';

export type PageKey = 'settings' | 'sites' | 'siteDetail';
export type DetailTab = 'overview' | 'pages' | 'progress';

export type ManagerState =
  | { status: 'loading' }
  | {
    status: 'ready';
    page: PageKey;
    detailTab: DetailTab;
    overviews: IndexOverview[];
    selected?: SiteSnapshot;
    siteSettings?: SiteSettings;
    settings: AppSettings;
  }
  | { status: 'error'; message: string };
