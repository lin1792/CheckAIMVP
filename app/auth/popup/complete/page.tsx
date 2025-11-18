'use client';

import { useEffect } from 'react';

export default function PopupCompletePage() {
  useEffect(() => {
    try {
      // Inform opener to refresh session, then close the popup
      if (window.opener) {
        try {
          window.opener.postMessage({ type: 'nextauth:signin-complete' }, '*');
        } catch {}
      }
    } finally {
      window.close();
    }
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <p style={{ fontSize: 14, color: '#475569' }}>登录完成，正在返回…</p>
      <a href="/" style={{ fontSize: 13, color: '#2F80ED' }}>如未自动关闭，请点击这里返回</a>
    </div>
  );
}
