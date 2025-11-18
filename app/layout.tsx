import type { Metadata } from 'next';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import AppProviders from '@/components/AppProviders';

export const metadata: Metadata = {
  title: 'ProofKit · 证据工作台',
  description:
    'ProofKit 证据工作台，支持 Word/文本上传，一键提炼可核查陈述、搜索权威证据并生成 .doc 核查报告。',
  keywords: [
    'ProofKit',
    '证据工作台',
    '事实核查',
    'AI 查证',
    'Word 报告'
  ],
  openGraph: {
    title: 'ProofKit · 证据工作台',
    description:
      '上传文档、自动提炼陈述、匹配权威证据并导出核查报告，ProofKit 让事实核查更高效。'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppProviders>{children}</AppProviders>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
