import { DockerDocsAdapter } from './docker-docs';

describe('DockerDocsAdapter', () => {
  afterEach(() => {
    jsdom.reconfigure({ url: 'https://react.dev/learn' });
  });

  it('assigns Docker pages to their shared navigation tree', () => {
    const scopes = [
      ['/get-started/', 'docker-get-started', 'Docker: Get started'],
      ['/get-started/get-docker/mac/', 'docker-get-started', 'Docker: Get started'],
      ['/get-started/docker-concepts/running-containers/', 'docker-get-started', 'Docker: Get started'],
      ['/manuals/', 'docker-manuals', 'Docker: Manuals'],
      ['/desktop/install/mac-install/', 'docker-manuals', 'Docker: Manuals'],
      ['/engine/storage/', 'docker-manuals', 'Docker: Manuals'],
      ['/compose/how-tos/', 'docker-manuals', 'Docker: Manuals'],
      ['/support/', 'docker-manuals', 'Docker: Manuals'],
      ['/extensions/extensions-sdk/', 'docker-manuals', 'Docker: Manuals'],
      ['/platform-release-notes/', 'docker-manuals', 'Docker: Manuals'],
      ['/release-lifecycle/', 'docker-manuals', 'Docker: Manuals'],
      ['/tcc/', 'docker-manuals', 'Docker: Manuals'],
      ['/guides/nodejs/', 'docker-guides', 'Docker: Guides'],
      ['/reference/cli/docker/', 'docker-reference', 'Docker: Reference'],
    ];

    for (const [path, scopeKey, scopeTitle] of scopes) {
      expect(DockerDocsAdapter.getDocScopeForUrl(new URL(`https://docs.docker.com${path}`))).toEqual({
        host: 'docs.docker.com', scopeKey, scopeTitle,
      });
    }
    expect(DockerDocsAdapter.getDocScopeForUrl(new URL('https://docs.docker.com/'))).toBeNull();
    expect(DockerDocsAdapter.requiresIndexingLoadWait).toBeUndefined();
  });

  it('collects cross-prefix Manuals links from Docker\'s shared navigation', () => {
    jsdom.reconfigure({ url: 'https://docs.docker.com/desktop/install/mac-install/' });
    document.body.innerHTML = `
      <main>
        <div>
          <nav class="navbar-font">
            <a href="/get-started/get-docker/">Get Docker</a>
            <a href="/manuals/">Manuals</a>
            <button aria-expanded="false">Expand</button>
            <a href="/desktop/">Docker Desktop</a>
            <a href="/engine/">Docker Engine</a>
            <a href="/engine/storage/">Storage</a>
            <a href="/engine/storage/">Duplicate</a>
            <a href="/guides/">Guides</a>
          </nav>
        </div>
        <div><article class="prose">Docker article</article></div>
      </main>
    `;

    expect(DockerDocsAdapter.getSidebarLinks().map((link) => [link.url, link.title])).toEqual([
      ['https://docs.docker.com/manuals', 'Manuals'],
      ['https://docs.docker.com/desktop', 'Docker Desktop'],
      ['https://docs.docker.com/engine', 'Docker Engine'],
      ['https://docs.docker.com/engine/storage', 'Storage'],
    ]);
    expect(DockerDocsAdapter.getArticleRoot()?.textContent).toBe('Docker article');
    expect(DockerDocsAdapter.isPageIndexable?.()).toBe(true);
  });

  it('collects Guides cards when that section has no sidebar tree', () => {
    jsdom.reconfigure({ url: 'https://docs.docker.com/guides/' });
    document.body.innerHTML = `
      <main>
        <div><a href="/guides/">Guides</a></div>
        <div>
          <a href="/get-started/">Get started</a>
          <a href="/guides/nodejs/">Node.js</a>
          <a href="/guides/python/">Python</a>
          <a href="/guides/nodejs/">Duplicate</a>
        </div>
      </main>
    `;

    expect(DockerDocsAdapter.getSidebarLinks().map((link) => [link.url, link.title])).toEqual([
      ['https://docs.docker.com/guides', 'Guides'],
      ['https://docs.docker.com/guides/nodejs', 'Node.js'],
      ['https://docs.docker.com/guides/python', 'Python'],
    ]);
    expect(DockerDocsAdapter.getProgressInsertionTargets()?.sidebarRoot).toBe(document.querySelector('main > div:nth-child(2)'));
    expect(DockerDocsAdapter.getProgressInsertionTargets()?.pageLinkTargets).toHaveLength(2);
    expect(DockerDocsAdapter.isPageIndexable?.()).toBe(true);
  });

  it('indexes Guides content pages and renders their total progress without card badges', () => {
    jsdom.reconfigure({ url: 'https://docs.docker.com/guides/nodejs/' });
    document.body.innerHTML = `
      <main>
        <div>Mobile navigation</div>
        <div><article class="prose">Node.js guide</article></div>
      </main>
    `;

    expect(DockerDocsAdapter.isPageIndexable?.()).toBe(true);
    expect(DockerDocsAdapter.getProgressInsertionTargets()?.sidebarRoot).toBe(document.querySelector('main > div:nth-child(2)'));
    expect(DockerDocsAdapter.getProgressInsertionTargets()?.pageLinkTargets).toEqual([]);
  });

  it('waits for Docker article images before indexing', async () => {
    jsdom.reconfigure({ url: 'https://docs.docker.com/guides/nodejs/' });
    document.body.innerHTML = '<main><div></div><div><article class="prose"><img loading="lazy"></article></div></main>';
    const image = document.querySelector('img')!;
    Object.defineProperty(image, 'loading', { configurable: true, value: 'lazy', writable: true });

    const waiting = DockerDocsAdapter.waitForIndexMeasurement?.();
    image.dispatchEvent(new Event('load'));

    await expect(waiting).resolves.toBeUndefined();
    expect(image.loading).toBe('eager');
  });

});
