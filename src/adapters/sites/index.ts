import { DockerDocsAdapter } from './docker-docs';
import { GitHubDocsAdapter } from './github-docs';
import { MdnAdapter } from './mdn';
import { OpenAICodexAdapter } from './openai-codex';
import { PlaywrightDevAdapter } from './playwright-dev';
import { ReactDevAdapter } from './react-dev';

export const SiteAdapters = [
  ReactDevAdapter,
  PlaywrightDevAdapter,
  OpenAICodexAdapter,
  MdnAdapter,
  DockerDocsAdapter,
  GitHubDocsAdapter,
];
