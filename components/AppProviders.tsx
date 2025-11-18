'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import { LanguageProvider } from './LanguageProvider';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      // Popup notifies main window when sign-in completes
      if (e?.data && typeof e.data === 'object' && (e as any).data.type === 'nextauth:signin-complete') {
        router.refresh();
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [router]);

  return (
    <SessionProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </SessionProvider>
  );
}
