import type { RuntimeMessage } from './messages';

type UploadServerIndexMessage = Extract<RuntimeMessage, { type: 'UPLOAD_SERVER_INDEX' }>;

export async function uploadServerIndexes(
  siteIds: string[],
  sendMessage: (message: UploadServerIndexMessage) => Promise<unknown>,
): Promise<void> {
  for (const siteId of siteIds) {
    await sendMessage({ type: 'UPLOAD_SERVER_INDEX', siteId });
  }
}
