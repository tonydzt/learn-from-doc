# developer-docs-progress-tracker

Chrome and Firefox extension for tracking documentation reading progress.

## Stack

- TypeScript
- React
- WXT

## Commands

```bash
npm install
npm run dev
npm run build
npm run build:chrome
npm run build:firefox
npm run zip
npm test
```

Build output:

```text
output/chrome-mv3
output/firefox-mv3
```

Release archives are written to `output/`:

```text
output/developer-docs-progress-tracker-<version>-chrome.zip
output/developer-docs-progress-tracker-<version>-firefox.zip
output/developer-docs-progress-tracker-<version>-sources.zip
```

Development builds use `http://localhost:3000` for account APIs. Production builds and release archives use `https://learn-from-doc-web.vercel.app`.
