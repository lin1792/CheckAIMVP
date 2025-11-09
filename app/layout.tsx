import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CheckAI MVP',
  description: 'Rapid fact-checking assistant with doc ingestion and evidence verification.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
