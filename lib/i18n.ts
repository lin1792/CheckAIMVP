export type Locale = 'zh' | 'en';

const zh = {
  'app.badge': 'CheckAI MVP',
  'home.title': '事实核查工作台',
  'home.subtitle': '支持 .docx 上传、可核查陈述识别、外部检索与 NLI 判定，生成完整 Markdown 报告。',
  'upload.hint': '支持上传 .docx 文档',
  'upload.dragHint': '拖拽 Word 文档到此处，或点击选择',
  'upload.placeholder': '或直接粘贴原文...',
  'upload.validation': '请上传 .docx 或输入文本',
  'upload.button.start': '开始核查',
  'upload.button.loading': '解析中...',
  'upload.button.stop': '停止解析',
  'errors.verifyFailed': '部分陈述验证失败，请稍后重试',
  'errors.claimsFailed': '陈述识别失败',
  'errors.parseFailed': '无法解析文档',
  'errors.uploadFailed': '上传或解析失败',
  'errors.exportFailed': '导出失败',
  'errors.stopped': '解析已停止',
  'summary.claims': '陈述：{{count}}',
  'summary.verified': '已判定：{{count}}',
  'summary.supported': '支持：{{count}}',
  'summary.refuted': '驳斥：{{count}}',
  'summary.disputed': '争议：{{count}}',
  'summary.insufficient': '不足：{{count}}',
  'summary.export': '导出 Markdown 报告',
  'summary.exporting': '生成中...',
  'filters.all': '全部',
  'labels.SUPPORTED': '支持',
  'labels.REFUTED': '驳斥',
  'labels.DISPUTED': '存争议',
  'labels.INSUFFICIENT': '证据不足',
  'claims.empty': '暂无可核查陈述',
  'claims.badge.pending': '待验证',
  'claims.evidenceCount': '证据 {{count}} 条',
  'claims.confidenceValue': '置信度 {{value}}',
  'claims.confidencePending': '置信度 采集中',
  'docPreview.empty': '上传文档后，这里会高亮可核查陈述',
  'docPreview.paragraph': '段落 {{index}}',
  'drawer.title': '证据抽屉',
  'drawer.noClaim': '未选中陈述',
  'drawer.close': '关闭',
  'drawer.verdict': '判定',
  'drawer.confidence': '置信度 {{value}}%',
  'drawer.noEvidence': '暂无证据，请稍候...',
  'drawer.authority': '权威度 {{value}}%',
  'sources.web': '网页',
  'sources.wikipedia': '维基百科',
  'sources.wikidata': '维基数据',
  'language.switchLabel': '语言',
  'language.zh': '中文',
  'language.en': 'English'
} as const;

export type TranslationKey = keyof typeof zh;
type TranslationRecord = Record<TranslationKey, string>;

const en: TranslationRecord = {
  'app.badge': 'CheckAI MVP',
  'home.title': 'Fact-Checking Workbench',
  'home.subtitle': 'Upload .docx files, extract checkable claims, search evidence and run NLI to export Markdown reports.',
  'upload.hint': 'Upload a .docx document',
  'upload.dragHint': 'Drag your Word file here or click to browse',
  'upload.placeholder': 'Or paste the original text here...',
  'upload.validation': 'Please upload a .docx file or enter text',
  'upload.button.start': 'Start checking',
  'upload.button.loading': 'Processing...',
  'upload.button.stop': 'Stop',
  'errors.verifyFailed': 'Some claims failed to verify. Please try again later.',
  'errors.claimsFailed': 'Claim extraction failed',
  'errors.parseFailed': 'Unable to parse the document',
  'errors.uploadFailed': 'Upload or parsing failed',
  'errors.exportFailed': 'Export failed',
  'errors.stopped': 'Processing was stopped',
  'summary.claims': 'Claims: {{count}}',
  'summary.verified': 'Verified: {{count}}',
  'summary.supported': 'Supported: {{count}}',
  'summary.refuted': 'Refuted: {{count}}',
  'summary.disputed': 'Disputed: {{count}}',
  'summary.insufficient': 'Insufficient: {{count}}',
  'summary.export': 'Export Markdown report',
  'summary.exporting': 'Generating...',
  'filters.all': 'All',
  'labels.SUPPORTED': 'Supported',
  'labels.REFUTED': 'Refuted',
  'labels.DISPUTED': 'Disputed',
  'labels.INSUFFICIENT': 'Insufficient',
  'claims.empty': 'No claims to display',
  'claims.badge.pending': 'Pending',
  'claims.evidenceCount': 'Evidence: {{count}}',
  'claims.confidenceValue': 'Confidence {{value}}',
  'claims.confidencePending': 'Confidence pending',
  'docPreview.empty': 'Upload a document to highlight checkable claims here',
  'docPreview.paragraph': 'Paragraph {{index}}',
  'drawer.title': 'Evidence',
  'drawer.noClaim': 'No claim selected',
  'drawer.close': 'Close',
  'drawer.verdict': 'Verdict',
  'drawer.confidence': 'Confidence {{value}}%',
  'drawer.noEvidence': 'No evidence yet. Please wait...',
  'drawer.authority': 'Authority {{value}}%',
  'sources.web': 'Web',
  'sources.wikipedia': 'Wikipedia',
  'sources.wikidata': 'Wikidata',
  'language.switchLabel': 'Language',
  'language.zh': '中文',
  'language.en': 'English'
};

const TRANSLATIONS: Record<Locale, Record<TranslationKey, string>> = {
  zh,
  en
};

export function translate(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  const template = TRANSLATIONS[locale][key] ?? TRANSLATIONS.zh[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{\{(.*?)\}\}/g, (_, raw) => {
    const value = vars[raw.trim()];
    return value === undefined ? '' : String(value);
  });
}
