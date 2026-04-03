import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'HLB 보컬스튜디오 — 당신의 목소리를 깨워드립니다',
  description: '7년 경력 보컬 트레이너의 커리큘럼과 AI가 결합된 나만의 보컬 코치',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // BUG-1 수정: middleware.ts가 request 헤더에 주입한 nonce를 읽어
  // <Script>에 nonce 속성으로 전달합니다.
  // 이 nonce가 없으면 CSP 'strict-dynamic' 정책이 Next.js 번들 스크립트를 차단합니다.
  const nonce = (await headers()).get('x-nonce') ?? '';

  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@400;500;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        {/* Next.js 번들 스크립트에 nonce 주입 — CSP strict-dynamic 허용을 위해 필수 */}
        <Script
          id="__nonce_carrier"
          strategy="beforeInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: '' }}
        />
      </body>
    </html>
  );
}
