import {
  getAccountSessionForBackground,
  loginAccountForBackground,
  logoutAccountForBackground,
  refreshAccountPermissionsForBackground,
} from '../../services/account';
import { handleAccountMessages } from './account';
import type { BackgroundContext, RuntimeMessageSender } from '../../types';

vi.mock('../../services/account', () => ({
  getAccountSessionForBackground: vi.fn(),
  loginAccountForBackground: vi.fn(),
  logoutAccountForBackground: vi.fn(),
  refreshAccountPermissionsForBackground: vi.fn(),
}));

const context = {} as BackgroundContext;
const sender = {} as RuntimeMessageSender;

describe('account options controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes account session reads', () => {
    vi.mocked(getAccountSessionForBackground).mockReturnValue(null as never);

    expect(handleAccountMessages({ type: 'GET_ACCOUNT_SESSION' }, sender, context)).toBeNull();

    expect(getAccountSessionForBackground).toHaveBeenCalled();
  });

  it('routes account login requests with credentials', () => {
    vi.mocked(loginAccountForBackground).mockReturnValue({ ok: true } as never);

    expect(handleAccountMessages({
      type: 'LOGIN_ACCOUNT',
      email: 'reader@example.com',
      password: 'secret',
    }, sender, context)).toEqual({ ok: true });

    expect(loginAccountForBackground).toHaveBeenCalledWith('reader@example.com', 'secret');
  });

  it('routes logout and permission refresh requests', () => {
    vi.mocked(logoutAccountForBackground).mockReturnValue(null as never);
    vi.mocked(refreshAccountPermissionsForBackground).mockReturnValue({ ok: true } as never);

    expect(handleAccountMessages({ type: 'LOGOUT_ACCOUNT' }, sender, context)).toBeNull();
    expect(handleAccountMessages({ type: 'REFRESH_ACCOUNT_PERMISSIONS' }, sender, context)).toEqual({ ok: true });

    expect(logoutAccountForBackground).toHaveBeenCalled();
    expect(refreshAccountPermissionsForBackground).toHaveBeenCalled();
  });
});
