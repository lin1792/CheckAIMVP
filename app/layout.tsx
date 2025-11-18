import type { Metadata } from 'next';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Script from 'next/script';
import AppProviders from '@/components/AppProviders';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

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
        <Script
          id="scroll-restoration"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try { if ('scrollRestoration' in history) { history.scrollRestoration = 'manual'; } } catch (e) {}`
          }}
        />
        <AppProviders>
          <SiteHeader />
          <div className="pt-16 md:pt-20">
            {children}
            <SiteFooter />
          </div>
        </AppProviders>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
