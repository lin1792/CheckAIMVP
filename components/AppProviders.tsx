'use client';

import { SessionProvider } from 'next-auth/react';
import { LanguageProvider } from './LanguageProvider';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </SessionProvider>
  );
}
