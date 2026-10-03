// Zachowania „jak w aplikacji” instalowane przez NativeShell (tylko w powłoce natywnej, patrz mobile/README.md).
// Każda funkcja zwraca funkcję sprzątającą. Bez paczek @capacitor/* w bundlu: wtyczki przez bridge.js.
import { haptic } from './bridge';

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- haptyka: zapis i błąd (każde żądanie zmieniające dane, wywołane dotknięciem), przełączniki i wybór ---
const USER_MS = 10000; // żądanie bez niedawnego dotyku (np. odświeżenie tokenu w tle) nie wibruje
const SILENT = /^\/api\/(push|notifications|errors?)\b/;

export function installHaptics() {
  let touched = 0;
  const mark = () => { touched = Date.now(); };
  const onChange = (e) => {
    const t = e.target;
    if (t?.matches?.('input[type="checkbox"], input[type="radio"], input[type="range"], select')) haptic('light');
  };
  const onClick = (e) => {
    const b = e.target.closest?.('.chip, [role="switch"], [role="tab"], [role="radio"]');
    // pola input (np. przełącznik role=switch) wibrują już w onChange: bez podwójnej haptyki
    if (b && !b.disabled && !b.matches('input')) haptic('light');
  };
  document.addEventListener('pointerdown', mark, true);
  document.addEventListener('keydown', mark, true);
  document.addEventListener('change', onChange, true);
  document.addEventListener('click', onClick, true);

  const orig = window.fetch;
  window.fetch = async (input, init) => {
    const method = String(init?.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase();
    const url = typeof input === 'string' ? input : input?.url || '';
    let path = '';
    try { path = new URL(url, window.location.href).pathname; } catch {}
    const track = method !== 'GET' && method !== 'HEAD' && path.startsWith('/api/') && !SILENT.test(path) && Date.now() - touched < USER_MS;
    if (!track) return orig(input, init);
    try {
      const res = await orig(input, init);
      haptic(res.ok ? 'success' : 'error');
      return res;
    } catch (e) {
      haptic('error');
      throw e;
    }
  };
  return () => {
    document.removeEventListener('pointerdown', mark, true);
    document.removeEventListener('keydown', mark, true);
    document.removeEventListener('change', onChange, true);
    document.removeEventListener('click', onClick, true);
    if (window.fetch !== orig) window.fetch = orig;
  };
}

// --- klawiatura: klasa kbd-open (chowa dolny pasek) i przewinięcie aktywnego pola nad klawiaturę ---
// Okno WebView zmniejsza sam Capacitor (SystemBars dodaje do widoku odstęp na klawiaturę), więc klawiaturę poznajemy
// po zmniejszeniu widocznego okna (nie po fokusie: klawiaturę można schować przyciskiem wstecz przy aktywnym polu).
const TEXTUAL = 'textarea, [contenteditable=""], [contenteditable="true"], input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="range"]):not([type="file"]):not([type="color"]):not([type="image"]):not([type="hidden"])';

export function installKeyboard() {
  const root = document.documentElement;
  const vv = window.visualViewport;
  const size = () => ({ w: window.innerWidth, h: vv?.height ?? window.innerHeight });
  let { w: w0, h: max } = size();
  let scroll = 0;
  const check = () => {
    const { w, h } = size();
    if (w !== w0) { w0 = w; max = h; } // obrót ekranu: nowa wysokość odniesienia
    max = Math.max(max, h);
    root.classList.toggle('kbd-open', h < max * 0.75);
  };
  const onIn = (e) => {
    if (!e.target?.matches?.(TEXTUAL)) return;
    clearTimeout(scroll);
    // pole z podpowiedziami (SearchSuggest) jedzie do góry ekranu, żeby lista zmieściła się nad klawiaturą
    const combo = e.target.getAttribute('role') === 'combobox';
    // po animacji klawiatury i zmianie rozmiaru okna pole mogłoby zostać pod nią
    scroll = setTimeout(() => {
      if (document.activeElement === e.target) e.target.scrollIntoView({ block: combo ? 'start' : 'center', behavior: reduceMotion() ? 'auto' : 'smooth' });
    }, 320);
  };
  window.addEventListener('resize', check);
  vv?.addEventListener('resize', check);
  document.addEventListener('focusin', onIn);
  return () => {
    window.removeEventListener('resize', check);
    vv?.removeEventListener('resize', check);
    document.removeEventListener('focusin', onIn);
    clearTimeout(scroll);
    root.classList.remove('kbd-open');
  };
}

// --- przejścia między ekranami (View Transitions API; bez wsparcia albo przy „ogranicz ruch” brak animacji) ---
const supportsVT = () => typeof document.startViewTransition === 'function' && !reduceMotion();
const here = () => window.location.pathname + window.location.search;
const hereFull = () => here() + window.location.hash;

// Czeka, aż adres się zmieni (Next zmienia go przy zatwierdzeniu nawigacji), ale nie dłużej niż ms.
// Zmiana samego hasha (#) też kończy czekanie, żeby przejście nie zamrażało takiej nawigacji.
async function untilNavigated(from, ms) {
  const end = Date.now() + ms;
  while (hereFull() === from && Date.now() < end) await sleep(16);
}

// Odpala przejście: stan „przed” zostaje zrobiony, zanim nawigacja się zatwierdzi, „po” po zmianie adresu.
// back: ten sam efekt w drugą stronę (data-vt na <html> wybiera animację w globals.css)
export function transition(back = false, ms = 700) {
  if (!supportsVT()) return false;
  const root = document.documentElement;
  const from = hereFull();
  root.classList.add('vt-active');
  if (back) root.dataset.vt = 'back';
  try {
    const t = document.startViewTransition(() => untilNavigated(from, ms));
    t.finished.catch(() => {}).finally(() => { root.classList.remove('vt-active'); delete root.dataset.vt; });
    return true;
  } catch {
    root.classList.remove('vt-active'); delete root.dataset.vt;
    return false;
  }
}

// Link wewnętrzny, który naprawdę zmienia stronę (nie nowa karta, pobranie, sama kotwica ani ten sam adres)
export function isPageLink(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = e.target.closest?.('a[href]');
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return false;
  let u;
  try { u = new URL(a.href, window.location.href); } catch { return false; }
  if (u.origin !== window.location.origin || u.pathname.startsWith('/api/')) return false;
  return u.pathname + u.search !== here();
}
