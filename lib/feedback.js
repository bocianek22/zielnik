import { alertPath, sendAlert } from './alerts';
import { background } from './mail';
import { PLATFORMS } from './feedback-consts';

// BETA-A: uwagi testerów. Treść zostaje w bazie; na zewnątrz (webhook, e-mail) wychodzi tylko kategoria i numer.
export { KINDS, STATUSES, BODY_MAX, NOTE_MAX, HOURLY_LIMIT, PLATFORMS } from './feedback-consts';
const THEMES = ['light', 'dark', 'auto'];

// Dane techniczne z przeglądarki zawężamy do białej listy, żeby do bazy nie trafiło nic poza tym, po co formularz istnieje.
// Ścieżka: tylko znane segmenty tras, identyfikatory i nazwy kont zamaskowane (alertPath).
export function cleanMeta(raw) {
  const m = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const path = typeof m.path === 'string' && m.path.startsWith('/') ? alertPath(m.path) : null;
  return {
    version: typeof m.version === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(m.version) ? m.version : null,
    path,
    platform: PLATFORMS.includes(m.platform) ? m.platform : null,
    theme: THEMES.includes(m.theme) ? m.theme : null,
    discreet: m.discreet === true,
    viewport: typeof m.viewport === 'string' && /^\d{2,5}x\d{2,5}$/.test(m.viewport) ? m.viewport : null,
  };
}

// Powiadomienie dla admina po odpowiedzi: bez treści i bez nazwy autora (webhook to usługa zewnętrzna).
export function notifyFeedback(id, kind) {
  background(() => sendAlert(`[Zielnik] Nowe zgłoszenie #${id}`, [`Kategoria: ${kind}.`]));
}
