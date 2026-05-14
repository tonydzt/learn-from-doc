import { OpenAICodexAdapter } from './openai-codex';
import { PlaywrightDevAdapter } from './playwright-dev';
import { ReactDevAdapter } from './react-dev';

export const SiteAdapters = [ReactDevAdapter, PlaywrightDevAdapter, OpenAICodexAdapter];
