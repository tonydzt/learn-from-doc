import type { AppSettings } from '../../../src/settings/app-settings';
import type { AccountSession } from '../../../src/settings/account-session';
import type { SiteSettings } from '../../../src/settings/site-settings';
import type { IndexOverview, SiteSnapshot } from '../../../src/shared/messages';

export type PageKey = 'account' | 'settings' | 'sites' | 'siteDetail';
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
    accountSession: AccountSession | null;
  }
  | { status: 'error'; message: string };
