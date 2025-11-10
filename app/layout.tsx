import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from '@/components/LanguageProvider';

export const metadata: Metadata = {
  title: 'CheckAI MVP',
  description: 'Rapid fact-checking assistant with doc ingestion and evidence verification.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
