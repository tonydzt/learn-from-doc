import { DocusaurusAdapter } from './docusaurus';
import { FumadocsAdapter } from './fumadocs';
import { MaterialMkDocsAdapter } from './material-mkdocs';
import { NextraAdapter } from './nextra';
import { StarlightAdapter } from './starlight';
import { VitePressAdapter } from './vitepress';

export const FrameworkAdapters = [
  DocusaurusAdapter,
  VitePressAdapter,
  NextraAdapter,
  FumadocsAdapter,
  StarlightAdapter,
  MaterialMkDocsAdapter,
];
