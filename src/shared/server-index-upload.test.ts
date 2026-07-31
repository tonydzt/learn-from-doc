import { uploadServerIndexes } from './server-index-upload';

describe('uploadServerIndexes', () => {
  it('uploads every scope in order', async () => {
    const calls: string[] = [];
    let finishFirst: (() => void) | undefined;
    const sendMessage = vi.fn((message: { siteId: string }) => {
      calls.push(message.siteId);
      if (message.siteId === 'docs') {
        return new Promise<void>((resolve) => {
          finishFirst = resolve;
        });
      }
      return Promise.resolve();
    });

    const upload = uploadServerIndexes(['docs', 'api'], sendMessage);
    expect(calls).toEqual(['docs']);

    finishFirst!();
    await upload;

    expect(calls).toEqual(['docs', 'api']);
  });
});
