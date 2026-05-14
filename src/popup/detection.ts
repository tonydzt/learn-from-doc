import { getScopeForUrl } from '../adapters';
import type { PageAdapterContext } from '../shared/messages';

export type PopupDetectionState =
  | { status: 'supported'; context: PageAdapterContext }
  | { status: 'needs-manual-detect' }
  | { status: 'unsupported' };

export function initialDetectionState(url: string | undefined): PopupDetectionState {
  if (!url) return { status: 'unsupported' };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: 'unsupported' };
  }
  if (parsed.protocol !== 'https:') return { status: 'unsupported' };

  const scope = getScopeForUrl(url);
  if (!scope) return { status: 'needs-manual-detect' };
  return {
    status: 'supported',
    context: {
      supported: true,
      ...scope,
      adapterKind: 'site',
      indexable: true,
    },
  };
}

export function detectionResultState(context: PageAdapterContext): PopupDetectionState {
  return context.supported ? { status: 'supported', context } : { status: 'unsupported' };
}
