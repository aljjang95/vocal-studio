import { NextRequest, NextResponse } from 'next/server';

// CSP nonce 패턴
// 매 요청마다 cryptographically random nonce를 생성합니다.
//
// 동작 원리:
//   1. middleware에서 nonce를 생성
//   2. NextResponse.next({ request: { headers } })로 request 헤더에 주입
//      → app/layout.tsx에서 headers().get('x-nonce')로 읽을 수 있음
//   3. response 헤더에도 설정 → Content-Security-Policy 브라우저 전달
//
// app/layout.tsx 사용 예시:
//   import { headers } from 'next/headers';
//   const nonce = (await headers()).get('x-nonce') ?? '';
//   return <html><head><Script nonce={nonce} .../></head>...</html>

export function middleware(request: NextRequest) {
  // Edge Runtime 호환: crypto.getRandomValues 사용 (Node.js crypto 모듈 대신)
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const nonce = btoa(String.fromCharCode.apply(null, Array.from(array)));

  const isDev = process.env.NODE_ENV === 'development';

  // 개발 모드: Next.js HMR/인라인 스크립트가 작동하려면 unsafe-eval + unsafe-inline 필요
  // 프로덕션: strict-dynamic + nonce 기반 강력한 CSP
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-eval' 'unsafe-inline'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const connectSrc = isDev
    ? `connect-src 'self' ws://localhost:* http://localhost:*`
    : `connect-src 'self'`;

  const csp = [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: blob: https://images.unsplash.com`,
    connectSrc,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');

  // BUG-1 수정 ①: nonce를 request 헤더에 주입
  // NextResponse.next()만 쓰면 request 헤더가 전달되지 않아
  // layout.tsx의 headers().get('x-nonce')가 null을 반환함
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders }, // ← request 헤더 전달 핵심
  });

  // BUG-1 수정 ②: response 헤더에도 설정 (브라우저 CSP 적용 + 디버깅용)
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce);

  return response;
}

export const config = {
  matcher: [
    // _next/static, _next/image, favicon은 제외 — 정적 에셋에 CSP 불필요
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
