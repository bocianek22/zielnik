// Nagłówki bezpieczeństwa (PLA-8) dla wszystkich odpowiedzi. Strony dostają pełny CSP z nonce z middleware.js (nadpisuje
// ten nagłówek); tu zostaje frame-ancestors dla API i plików statycznych.
// HSTS bez includeSubDomains, dopóki nie ma własnej domeny (flagi nie da się szybko wycofać z przeglądarek).
// camera=(self): zdjęcia dodaje się przez <input type="file">, który nie podlega tej polityce, ale nie blokujemy aparatu na zapas.
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
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
export default nextConfig;
