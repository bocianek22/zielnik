// Nagłówki bezpieczeństwa (PLA-8) dla wszystkich odpowiedzi. Strony dostają pełny CSP z nonce z middleware.js (nadpisuje
// ten nagłówek); tu zostaje frame-ancestors dla API i plików statycznych.
// HSTS bez includeSubDomains, dopóki nie ma własnej domeny (flagi nie da się szybko wycofać z przeglądarek).
// camera=(self): zdjęcia dodaje się przez <input type="file">, który nie podlega tej polityce, ale nie blokujemy aparatu na zapas.
import path from 'node:path';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false, // bez nagłówka X-Powered-By (nie zdradzamy technologii)
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Tylko lokalnie (scripts/dev/build-local.sh): sterownik Neon zastąpiony przez `pg` z lokalnego PostgreSQL.
  // Bez ZIELNIK_LOCAL_PG=1 (czyli na Vercel) konfiguracja nie ma żadnego aliasu.
  ...(process.env.ZIELNIK_LOCAL_PG === '1' && {
    webpack(config) {
      config.resolve.alias['@neondatabase/serverless'] = path.resolve('tests/db/neon-shim.mjs');
      return config;
    },
  }),
};
export default nextConfig;
