import type { ReactNode } from 'react';
import type { LanguageCode } from '../../../../src/settings/app-settings';
import { ModuleNav } from './ModuleNav';
import { WorkspaceHeader } from './WorkspaceHeader';
import type { PageKey } from '../types';

type OptionsShellProps = {
  children: ReactNode;
  language: LanguageCode;
  page: PageKey;
  pageTitle: string;
  refresh(): void;
  selectPage(page: PageKey): void;
};

export function OptionsShell(props: OptionsShellProps) {
  return (
    <main className="page app-shell">
      <ModuleNav language={props.language} page={props.page} selectPage={props.selectPage} />
      <section className="workspace">
        <WorkspaceHeader language={props.language} pageTitle={props.pageTitle} refresh={props.refresh} />
        {props.children}
      </section>
    </main>
  );
}
