import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type LanguageCode } from '../settings/app-settings';

export type MessageKey =
  | 'common.brand'
  | 'common.on'
  | 'common.off'
  | 'common.refresh'
  | 'common.updated'
  | 'common.updatedLabel'
  | 'common.pagesCount'
  | 'manager.title'
  | 'manager.loading'
  | 'manager.settings'
  | 'manager.account'
  | 'manager.accountDescription'
  | 'manager.tables'
  | 'manager.pluginPreferences'
  | 'manager.indexesAndRecords'
  | 'manager.indexes'
  | 'manager.noIndexes'
  | 'manager.indexSummary'
  | 'manager.tableManagement'
  | 'manager.pluginControls'
  | 'manager.dataTables'
  | 'manager.readingUi'
  | 'manager.rightSideReadingMap'
  | 'manager.readingMapDescription'
  | 'manager.showReadingMap'
  | 'manager.defaultPageReadingProgress'
  | 'manager.defaultPageReadingProgressDescription'
  | 'manager.debugIndexingLogs'
  | 'manager.siteSettings'
  | 'manager.siteSettingsDescription'
  | 'manager.enableSiteReadingProgress'
  | 'manager.backupAndImport'
  | 'manager.portableData'
  | 'manager.portableDataDescription'
  | 'manager.includeReadingProgress'
  | 'manager.exportAll'
  | 'manager.exportSelectedSite'
  | 'manager.importFile'
  | 'manager.confirmImportOverwrite'
  | 'manager.importComplete'
  | 'manager.importFailed'
  | 'manager.exportFailed'
  | 'manager.currentStatus'
  | 'manager.language'
  | 'manager.languageDescription'
  | 'manager.selectIndex'
  | 'manager.tableViews'
  | 'manager.overview'
  | 'manager.sites'
  | 'manager.pages'
  | 'manager.pagesWithProgress'
  | 'manager.progress'
  | 'manager.scope'
  | 'manager.page'
  | 'manager.height'
  | 'manager.url'
  | 'manager.viewed'
  | 'manager.ranges'
  | 'manager.key'
  | 'manager.value'
  | 'manager.selectIndexPages'
  | 'manager.selectIndexProgress'
  | 'manager.selectIndexDetails'
  | 'manager.progressRows'
  | 'manager.totalHeight'
  | 'manager.viewedHeight'
  | 'manager.siteId'
  | 'manager.dangerZone'
  | 'manager.safeDestructiveActions'
  | 'manager.dangerDescription'
  | 'manager.clearSiteProgress'
  | 'manager.clearAllProgress'
  | 'manager.deleteIndex'
  | 'manager.confirmDeleteIndex'
  | 'manager.confirmClearSiteProgress'
  | 'manager.confirmClearAllProgress'
  | 'manager.deletePageProgress'
  | 'manager.confirmDeletePageProgress'
  | 'popup.loading'
  | 'popup.openReactDocs'
  | 'popup.unsupportedPage'
  | 'popup.openManager'
  | 'popup.unsupportedDescription'
  | 'popup.detectFramework'
  | 'popup.detectingFramework'
  | 'popup.noFrameworkDetected'
  | 'popup.totalProgress'
  | 'popup.pagesIndexed'
  | 'popup.createIndexFirst'
  | 'popup.collectingLinks'
  | 'popup.creatingIndex'
  | 'popup.savingIndex'
  | 'popup.scanningSidebar'
  | 'popup.rebuildIndex'
  | 'popup.createIndex'
  | 'popup.resumeIndex'
  | 'popup.indexingPages'
  | 'popup.resumeIndexingPages'
  | 'popup.resumeIndexHint'
  | 'popup.serverIndexAvailable'
  | 'popup.pullFromServer'
  | 'popup.pullingFromServer'
  | 'popup.pullReviewFromServer'
  | 'popup.pullingReviewFromServer'
  | 'popup.uploadToServer'
  | 'popup.uploadingToServer'
  | 'popup.confirmPullOverwrite'
  | 'content.docProgress'
  | 'content.subdirectory'
  | 'content.enablePageProgress'
  | 'content.disablePageProgress'
  | 'content.pageProgressOn'
  | 'content.pageProgressOff'
  | 'content.deletePageProgress';

export type Messages = Record<MessageKey, string>;

export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  ko: '한국어',
  pt: 'Português',
  ru: 'Русский',
  ar: 'العربية',
  hi: 'हिन्दी',
};

export const EN_MESSAGES: Messages = {
  'common.brand': 'Developer Docs Progress Tracker',
  'common.on': 'On',
  'common.off': 'Off',
  'common.refresh': 'Refresh',
  'common.updated': 'Updated {date}',
  'common.updatedLabel': 'Updated',
  'common.pagesCount': '{count} pages',
  'manager.title': 'Manager',
  'manager.loading': 'Loading manager',
  'manager.settings': 'Settings',
  'manager.account': 'Account',
  'manager.accountDescription': 'Login and permissions',
  'manager.tables': 'Sites',
  'manager.pluginPreferences': 'Plugin preferences',
  'manager.indexesAndRecords': 'Site indexes and backups',
  'manager.indexes': 'Indexes',
  'manager.noIndexes': 'No indexes yet.',
  'manager.indexSummary': '{count} pages · {percent}',
  'manager.tableManagement': 'Table management',
  'manager.pluginControls': 'Plugin controls',
  'manager.dataTables': 'Data tables',
  'manager.readingUi': 'Reading UI',
  'manager.rightSideReadingMap': 'Right-side reading map',
  'manager.readingMapDescription': 'Show the slim page map on supported indexed documentation pages.',
  'manager.showReadingMap': 'Show right-side reading map',
  'manager.defaultPageReadingProgress': 'Record new pages by default',
  'manager.defaultPageReadingProgressDescription': 'When off, indexed pages wait for the per-page button before recording reading progress.',
  'manager.debugIndexingLogs': 'Index timing debug logs',
  'manager.siteSettings': 'Site settings',
  'manager.siteSettingsDescription': 'Controls for this indexed documentation site.',
  'manager.enableSiteReadingProgress': 'Enable reading progress',
  'manager.backupAndImport': 'Backup and import',
  'manager.portableData': 'Portable data',
  'manager.portableDataDescription': 'Export local indexes for backup or sharing, or import a compatible Developer Docs Progress Tracker file.',
  'manager.includeReadingProgress': 'Include reading progress',
  'manager.exportAll': 'Export all',
  'manager.exportSelectedSite': 'Export site',
  'manager.importFile': 'Import file',
  'manager.confirmImportOverwrite': 'The import contains {count} site conflict(s). Overwrite those local indexes?',
  'manager.importComplete': 'Import complete. Imported {imported}; skipped {skipped}.',
  'manager.importFailed': 'Import failed.',
  'manager.exportFailed': 'Export failed.',
  'manager.currentStatus': 'Current status: {status}',
  'manager.language': 'Language',
  'manager.languageDescription': 'Choose the display language for extension pages and injected reading UI.',
  'manager.selectIndex': 'Select an index from the left menu.',
  'manager.tableViews': 'Table views',
  'manager.overview': 'Overview',
  'manager.sites': 'Sites',
  'manager.pages': 'Pages',
  'manager.pagesWithProgress': 'Pages with progress',
  'manager.progress': 'Progress',
  'manager.scope': 'Scope',
  'manager.page': 'Page',
  'manager.height': 'Height',
  'manager.url': 'URL',
  'manager.viewed': 'Viewed',
  'manager.ranges': 'Ranges',
  'manager.key': 'Key',
  'manager.value': 'Value',
  'manager.selectIndexPages': 'Select an index to view pages.',
  'manager.selectIndexProgress': 'Select an index to view progress.',
  'manager.selectIndexDetails': 'Select an index to view details.',
  'manager.progressRows': 'Progress rows',
  'manager.totalHeight': 'Total height',
  'manager.viewedHeight': 'Viewed height',
  'manager.siteId': 'Site ID',
  'manager.dangerZone': 'Danger zone',
  'manager.safeDestructiveActions': 'Safe destructive actions',
  'manager.dangerDescription': 'Progress cleanup keeps indexes. Deleting an index removes its site, pages, and progress rows.',
  'manager.clearSiteProgress': 'Clear site progress',
  'manager.clearAllProgress': 'Clear all progress',
  'manager.deleteIndex': 'Delete index',
  'manager.confirmDeleteIndex': 'Delete index for {title}?',
  'manager.confirmClearSiteProgress': 'Clear reading progress for {title}? The index will be kept.',
  'manager.confirmClearAllProgress': 'Clear all reading progress? Indexes will be kept.',
  'manager.deletePageProgress': 'Delete',
  'manager.confirmDeletePageProgress': 'Delete reading progress for this page?',
  'popup.loading': 'Reading map is loading',
  'popup.openReactDocs': 'Open React Docs',
  'popup.unsupportedPage': 'Unsupported page',
  'popup.openManager': 'Open manager',
  'popup.unsupportedDescription': 'This extension currently supports React Docs, Playwright Docs, and OpenAI Codex Docs.',
  'popup.detectFramework': 'Detect docs framework',
  'popup.detectingFramework': 'Detecting framework...',
  'popup.noFrameworkDetected': 'No supported docs framework was detected on this page.',
  'popup.totalProgress': 'Total progress',
  'popup.pagesIndexed': '{count} pages indexed locally',
  'popup.createIndexFirst': 'Create a local index before tracking progress.',
  'popup.collectingLinks': 'Collecting links',
  'popup.creatingIndex': 'Creating index',
  'popup.savingIndex': 'Saving index locally',
  'popup.scanningSidebar': 'Scanning sidebar',
  'popup.rebuildIndex': 'Rebuild index',
  'popup.createIndex': 'Create index',
  'popup.resumeIndex': 'Resume index',
  'popup.indexingPages': 'Indexing pages...',
  'popup.resumeIndexingPages': 'Resuming index...',
  'popup.resumeIndexHint': 'Resume from {current}/{total} pages indexed before interruption.',
  'popup.serverIndexAvailable': 'Server index available · {count} pages',
  'popup.pullFromServer': 'Pull from server',
  'popup.pullingFromServer': 'Pulling...',
  'popup.pullReviewFromServer': 'Pull test index from server',
  'popup.pullingReviewFromServer': 'Pulling test index...',
  'popup.uploadToServer': 'Upload to server',
  'popup.uploadingToServer': 'Uploading...',
  'popup.confirmPullOverwrite': 'Replace the local index for this site with the server copy?',
  'content.docProgress': 'Doc progress',
  'content.subdirectory': 'Subdirectory',
  'content.enablePageProgress': 'Start recording this page',
  'content.disablePageProgress': 'Stop recording this page',
  'content.pageProgressOn': 'Recording',
  'content.pageProgressOff': 'Paused',
  'content.deletePageProgress': 'Delete page progress',
};

const PARTIAL_TRANSLATIONS: Record<Exclude<LanguageCode, 'en'>, Partial<Messages>> = {
  'zh-CN': {
    'common.on': '开',
    'common.off': '关',
    'common.refresh': '刷新',
    'common.updated': '更新于 {date}',
    'common.updatedLabel': '更新于',
    'common.pagesCount': '{count} 页',
    'manager.title': '管理器',
    'manager.loading': '正在加载管理器',
    'manager.settings': '设置',
    'manager.account': '账号',
    'manager.accountDescription': '登录和权限',
    'manager.tables': '站点',
    'manager.pluginPreferences': '插件偏好',
    'manager.indexesAndRecords': '站点索引和备份',
    'manager.indexes': '索引',
    'manager.noIndexes': '还没有索引。',
    'manager.indexSummary': '{count} 页 · {percent}',
    'manager.tableManagement': '表格管理',
    'manager.pluginControls': '插件控制',
    'manager.dataTables': '数据表',
    'manager.readingUi': '阅读界面',
    'manager.rightSideReadingMap': '右侧阅读地图',
    'manager.readingMapDescription': '在支持且已索引的文档页面显示细长页面地图。',
    'manager.showReadingMap': '显示右侧阅读地图',
    'manager.defaultPageReadingProgress': '默认记录新页面',
    'manager.defaultPageReadingProgressDescription': '关闭后，已索引页面会等待你点击单页按钮后才记录阅读进度。',
    'manager.debugIndexingLogs': '索引耗时调试日志',
    'manager.siteSettings': '站点设置',
    'manager.siteSettingsDescription': '当前已索引文档站点的配置。',
    'manager.enableSiteReadingProgress': '启用阅读进度',
    'manager.backupAndImport': '备份和导入',
    'manager.portableData': '便携数据',
    'manager.portableDataDescription': '导出本地索引用于备份或分享，也可以导入兼容的 Developer Docs Progress Tracker 文件。',
    'manager.includeReadingProgress': '包含阅读进度',
    'manager.exportAll': '导出全部',
    'manager.exportSelectedSite': '导出站点',
    'manager.importFile': '导入文件',
    'manager.confirmImportOverwrite': '导入文件里有 {count} 个站点和本地冲突。是否覆盖这些本地索引？',
    'manager.importComplete': '导入完成。已导入 {imported} 个，已跳过 {skipped} 个。',
    'manager.importFailed': '导入失败。',
    'manager.exportFailed': '导出失败。',
    'manager.currentStatus': '当前状态：{status}',
    'manager.language': '语言',
    'manager.languageDescription': '选择扩展页面和注入阅读界面的显示语言。',
    'manager.selectIndex': '从左侧菜单选择一个索引。',
    'manager.tableViews': '表格视图',
    'manager.overview': '概览',
    'manager.sites': '站点',
    'manager.pages': '页面',
    'manager.pagesWithProgress': '有阅读记录的页面',
    'manager.progress': '进度',
    'manager.scope': '范围',
    'manager.page': '页面',
    'manager.height': '高度',
    'manager.viewed': '已阅读',
    'manager.ranges': '区间',
    'manager.key': '键',
    'manager.value': '值',
    'manager.selectIndexPages': '选择一个索引查看页面。',
    'manager.selectIndexProgress': '选择一个索引查看进度。',
    'manager.selectIndexDetails': '选择一个索引查看详情。',
    'manager.progressRows': '进度记录',
    'manager.totalHeight': '总高度',
    'manager.viewedHeight': '已读高度',
    'manager.siteId': '站点 ID',
    'manager.dangerZone': '危险区',
    'manager.safeDestructiveActions': '安全的破坏性操作',
    'manager.dangerDescription': '清理进度会保留索引。删除索引会移除站点、页面和进度记录。',
    'manager.clearSiteProgress': '清空站点进度',
    'manager.clearAllProgress': '清空全部进度',
    'manager.deleteIndex': '删除索引',
    'manager.confirmDeleteIndex': '删除 {title} 的索引？',
    'manager.confirmClearSiteProgress': '清空 {title} 的阅读进度？索引会保留。',
    'manager.confirmClearAllProgress': '清空全部阅读进度？索引会保留。',
    'manager.deletePageProgress': '删除',
    'manager.confirmDeletePageProgress': '删除该页面的阅读进度？',
    'popup.loading': '阅读地图加载中',
    'popup.openReactDocs': '打开 React 文档',
    'popup.unsupportedPage': '不支持的页面',
    'popup.openManager': '打开管理器',
    'popup.unsupportedDescription': '此扩展目前支持 React Docs、Playwright Docs 和 OpenAI Codex Docs。',
    'popup.detectFramework': '检测文档框架',
    'popup.detectingFramework': '正在检测框架...',
    'popup.noFrameworkDetected': '未在当前页面检测到支持的文档框架。',
    'popup.totalProgress': '总进度',
    'popup.pagesIndexed': '本地已索引 {count} 页',
    'popup.createIndexFirst': '跟踪进度前请先创建本地索引。',
    'popup.collectingLinks': '正在收集链接',
    'popup.creatingIndex': '正在创建索引',
    'popup.savingIndex': '正在本地保存索引',
    'popup.scanningSidebar': '正在扫描侧边栏',
    'popup.rebuildIndex': '重建索引',
    'popup.createIndex': '创建索引',
    'popup.resumeIndex': '继续创建索引',
    'popup.indexingPages': '正在索引页面...',
    'popup.resumeIndexingPages': '正在继续创建索引...',
    'popup.resumeIndexHint': '将从中断前已完成的 {current}/{total} 页继续。',
    'popup.serverIndexAvailable': '服务端有索引 · {count} 页',
    'popup.pullFromServer': '从服务端拉取',
    'popup.pullingFromServer': '正在拉取...',
    'popup.pullReviewFromServer': '从服务端拉取测试索引',
    'popup.pullingReviewFromServer': '正在拉取测试索引...',
    'popup.uploadToServer': '上传到服务端',
    'popup.uploadingToServer': '正在上传...',
    'popup.confirmPullOverwrite': '用服务端副本替换当前站点的本地索引？',
    'content.docProgress': '文档进度',
    'content.subdirectory': '子目录',
    'content.enablePageProgress': '开始记录当前页面',
    'content.disablePageProgress': '停止记录当前页面',
    'content.pageProgressOn': '记录中',
    'content.pageProgressOff': '已暂停',
    'content.deletePageProgress': '删除页面进度',
  },
  'zh-TW': {
    'manager.title': '管理器',
    'manager.settings': '設定',
    'manager.tables': '表格',
    'manager.language': '語言',
    'popup.unsupportedPage': '不支援的頁面',
    'popup.totalProgress': '總進度',
    'content.docProgress': '文件進度',
    'content.subdirectory': '子目錄',
  },
  es: {
    'manager.title': 'Administrador',
    'manager.settings': 'Configuración',
    'manager.tables': 'Tablas',
    'manager.language': 'Idioma',
    'popup.unsupportedPage': 'Página no compatible',
    'popup.totalProgress': 'Progreso total',
    'content.docProgress': 'Progreso del documento',
    'content.subdirectory': 'Subdirectorio',
  },
  fr: {
    'manager.title': 'Gestionnaire',
    'manager.settings': 'Paramètres',
    'manager.tables': 'Tableaux',
    'manager.language': 'Langue',
    'popup.unsupportedPage': 'Page non prise en charge',
    'popup.totalProgress': 'Progression totale',
    'content.docProgress': 'Progression du document',
    'content.subdirectory': 'Sous-dossier',
  },
  de: {
    'manager.title': 'Manager',
    'manager.settings': 'Einstellungen',
    'manager.tables': 'Tabellen',
    'manager.language': 'Sprache',
    'popup.unsupportedPage': 'Nicht unterstützte Seite',
    'popup.totalProgress': 'Gesamtfortschritt',
    'content.docProgress': 'Dokumentfortschritt',
    'content.subdirectory': 'Unterverzeichnis',
  },
  ja: {
    'manager.title': 'マネージャー',
    'manager.settings': '設定',
    'manager.tables': 'テーブル',
    'manager.language': '言語',
    'popup.unsupportedPage': '未対応ページ',
    'popup.totalProgress': '合計進捗',
    'content.docProgress': 'ドキュメント進捗',
    'content.subdirectory': 'サブディレクトリ',
  },
  ko: {
    'manager.title': '관리자',
    'manager.settings': '설정',
    'manager.tables': '표',
    'manager.language': '언어',
    'popup.unsupportedPage': '지원되지 않는 페이지',
    'popup.totalProgress': '전체 진행률',
    'content.docProgress': '문서 진행률',
    'content.subdirectory': '하위 디렉터리',
  },
  pt: {
    'manager.title': 'Gerenciador',
    'manager.settings': 'Configurações',
    'manager.tables': 'Tabelas',
    'manager.language': 'Idioma',
    'popup.unsupportedPage': 'Página não suportada',
    'popup.totalProgress': 'Progresso total',
    'content.docProgress': 'Progresso do documento',
    'content.subdirectory': 'Subdiretório',
  },
  ru: {
    'manager.title': 'Менеджер',
    'manager.settings': 'Настройки',
    'manager.tables': 'Таблицы',
    'manager.language': 'Язык',
    'popup.unsupportedPage': 'Неподдерживаемая страница',
    'popup.totalProgress': 'Общий прогресс',
    'content.docProgress': 'Прогресс документа',
    'content.subdirectory': 'Подкаталог',
  },
  ar: {
    'manager.title': 'المدير',
    'manager.settings': 'الإعدادات',
    'manager.tables': 'الجداول',
    'manager.language': 'اللغة',
    'popup.unsupportedPage': 'صفحة غير مدعومة',
    'popup.totalProgress': 'التقدم الكلي',
    'content.docProgress': 'تقدم المستند',
    'content.subdirectory': 'دليل فرعي',
  },
  hi: {
    'manager.title': 'प्रबंधक',
    'manager.settings': 'सेटिंग्स',
    'manager.tables': 'तालिकाएं',
    'manager.language': 'भाषा',
    'popup.unsupportedPage': 'असमर्थित पृष्ठ',
    'popup.totalProgress': 'कुल प्रगति',
    'content.docProgress': 'दस्तावेज़ प्रगति',
    'content.subdirectory': 'उप निर्देशिका',
  },
};

export const MESSAGES: Record<LanguageCode, Messages> = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((language) => [
    language,
    language === 'en'
      ? EN_MESSAGES
      : { ...EN_MESSAGES, ...PARTIAL_TRANSLATIONS[language] },
  ]),
) as Record<LanguageCode, Messages>;

export function t(language: LanguageCode, key: MessageKey, params: Record<string, string | number> = {}): string {
  const template = (MESSAGES[language] ?? MESSAGES[DEFAULT_LANGUAGE])[key] ?? EN_MESSAGES[key];
  return template.replace(/\{(\w+)\}/g, (match, name) => String(params[name] ?? match));
}
