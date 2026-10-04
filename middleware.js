import { NextResponse } from 'next/server';
import { buildCsp, crossSiteRequest, makeNonce } from './lib/security-headers';

// 1) API: metody zmieniające stan tylko z tej samej witryny (CSRF, druga warstwa obok SameSite=Lax).
// 2) Strony: CSP z nonce na każde żądanie. Next.js odczytuje nonce z nagłówka CSP żądania i dokleja go do swoich
//    skryptów; layout bierze go z `x-nonce` dla skryptu motywu. CSP_REPORT_ONLY=1 przełącza na tryb raportowania
//    (awaryjne wyłączenie egzekwowania bez zmiany kodu).
export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/')) {
    if (crossSiteRequest(req.method, req.headers, req.headers.get('host') || req.nextUrl.host)) {
      return NextResponse.json({ error: 'Żądanie z innej witryny zostało odrzucone.' }, { status: 403 });
    }
    return NextResponse.next();
  }
  const nonce = makeNonce();
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV === 'development' });
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set(process.env.CSP_REPORT_ONLY === '1' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy', csp);
  return res;
}

export const config = {
  // pliki statyczne bez middleware (nie potrzebują nonce); prefetch stron też dostaje CSP, bo to te same trasy
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.webmanifest|offline\\.html|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)'],
};
