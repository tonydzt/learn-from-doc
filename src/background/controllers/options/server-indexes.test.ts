import {
  getServerIndexAvailability,
  pullReviewServerIndex,
  pullServerIndex,
  uploadServerIndex,
} from '../../services/server-indexes';
import { handleOptionsMessages } from './index-management';

vi.mock('../../services/server-indexes', () => ({
  getServerIndexAvailability: vi.fn(),
  pullReviewServerIndex: vi.fn(),
  pullServerIndex: vi.fn(),
  uploadServerIndex: vi.fn(),
}));

describe('server index options controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes server index availability checks', () => {
    vi.mocked(getServerIndexAvailability).mockReturnValue({ available: true } as never);

    expect(handleOptionsMessages({
      type: 'GET_SERVER_INDEX_AVAILABILITY',
      siteId: 'react.dev::learn',
    }, {} as never, {} as never)).toEqual({ available: true });

    expect(getServerIndexAvailability).toHaveBeenCalledWith('react.dev::learn');
  });

  it('routes server index pull and upload requests', () => {
    vi.mocked(pullServerIndex).mockReturnValue({ importedCount: 1 } as never);
    vi.mocked(pullReviewServerIndex).mockReturnValue({ importedCount: 1 } as never);
    vi.mocked(uploadServerIndex).mockReturnValue({ ok: true } as never);

    expect(handleOptionsMessages({
      type: 'PULL_SERVER_INDEX',
      siteId: 'react.dev::learn',
      overwrite: true,
    }, {} as never, {} as never)).toEqual({ importedCount: 1 });
    expect(handleOptionsMessages({
      type: 'PULL_REVIEW_SERVER_INDEX',
      siteId: 'react.dev::learn',
      overwrite: true,
    }, {} as never, {} as never)).toEqual({ importedCount: 1 });
    expect(handleOptionsMessages({
      type: 'UPLOAD_SERVER_INDEX',
      siteId: 'react.dev::learn',
    }, {} as never, {} as never)).toEqual({ ok: true });

    expect(pullServerIndex).toHaveBeenCalledWith('react.dev::learn', true);
    expect(pullReviewServerIndex).toHaveBeenCalledWith('react.dev::learn', true);
    expect(uploadServerIndex).toHaveBeenCalledWith('react.dev::learn');
  });
});
