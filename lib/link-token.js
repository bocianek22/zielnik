// Token z linku e-mail (#t=...): odczyt i natychmiastowe usunięcie z paska adresu i historii przeglądarki.
export function readLinkToken() {
  if (typeof window === 'undefined') return '';
  const m = /(?:^#|&)t=([A-Za-z0-9_-]{20,100})/.exec(window.location.hash);
  if (window.location.hash) {
    try { window.history.replaceState(null, '', window.location.pathname); } catch { /* bez historii */ }
  }
  return m ? m[1] : '';
}
