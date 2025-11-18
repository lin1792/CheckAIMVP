'use client';

import { useEffect } from 'react';
import { signIn } from 'next-auth/react';

export default function PopupAuthPage() {
  useEffect(() => {
    const origin = window.location.origin;
    // After successful auth, land on a small page that closes the popup
    const callbackUrl = `${origin}/auth/popup/complete`;
    signIn('google', { callbackUrl });
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <p style={{ fontSize: 14, color: '#475569' }}>正在打开 Google 授权…</p>
    </div>
  );
}

