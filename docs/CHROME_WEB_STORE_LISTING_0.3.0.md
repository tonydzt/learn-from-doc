# Chrome Web Store Listing - 0.3.0

Developer Docs Progress Tracker saves and restores your reading progress on developer documentation and long technical pages.

Dedicated support is included for React Docs, Playwright Docs, OpenAI Codex Docs, MDN Web Docs, Docker Docs, and GitHub Docs. The extension can also detect common documentation frameworks such as Docusaurus, Fumadocs, Material for MkDocs, Nextra, Retype, Starlight, and VitePress. Because documentation sites can customize their layout, framework-based detection may not work perfectly on every site.

Features:

- Create and rebuild local indexes for supported documentation sites
- Record progress from the article areas that actually enter the viewport
- Restore your previous reading position
- Show total and per-page progress in supported navigation sidebars
- Show an optional right-side reading map
- Pause or resume recording for an individual page or indexed site
- Delete progress for a page, a site, or all indexed sites
- Resume interrupted indexing when the saved page list still matches
- Export and import local indexes, optionally including reading progress
- Choose from 12 interface languages
- Manage multiple documentation scopes under the same host
- Optionally log in to use server-index features enabled for your account

Data and privacy:

Indexes, settings, and reading progress are stored locally by default. The extension does not upload page content. If you choose to log in, your credentials are sent to the Developer Docs Progress Tracker service for authentication and the returned session is stored in extension storage. If you explicitly upload an index, its site metadata, page records, settings, and reading progress are sent to the service. Pulling a server index downloads and replaces the selected local index after confirmation when needed.

This is still an early version. Site layouts can change, and compatibility will continue to improve.
