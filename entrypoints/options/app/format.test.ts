import { fmtDate } from './format';

describe('options formatting', () => {
  it('formats dates using the selected display language', () => {
    const dateTimeFormat = vi.spyOn(Intl, 'DateTimeFormat');

    fmtDate(0, 'zh-CN');

    expect(dateTimeFormat).toHaveBeenCalledWith('zh-CN', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  });
});
