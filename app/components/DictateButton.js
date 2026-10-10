'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { isNative } from './native/bridge';
import { joinDictation, transcriptOf, dictateError, DICTATE_NOTICE } from '@/lib/dictate';

// POM-43: dyktowanie do pola notatki przez Web Speech API (SpeechRecognition, pl-PL). Przycisk pojawia się tylko tam, gdzie
// przeglądarka ma to API; w aplikacji Android (WebView zwykle go nie ma) jest ukryty. Tekst jest dopisywany do tego, co już
// wpisano, na żywo (wyniki wstępne), a po ciszy sesja kończy się sama. Przy pierwszym użyciu krótka informacja o prywatności
// (zapamiętana w localStorage). Jeśli przeglądarka umie rozpoznawanie na urządzeniu (SpeechRecognition.available/processLocally)
// i ma polski pakiet, korzystamy z niego. Zielnik nigdzie nie wysyła nagrania ani tekstu poza zapisem samej notatki.
const SEEN_KEY = 'zielnik.dictate.notice';
const getSR = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);
const seen = () => { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } };
const remember = () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch {} };

// value / onChange: sterowane pole; max: limit znaków pola
export default function DictateButton({ value, onChange, max }) {
  const [ok, setOk] = useState(false);
  const [state, setState] = useState('idle'); // idle | asking | listening
  const [err, setErr] = useState('');
  const [said, setSaid] = useState(false); // czy ostatnia sesja coś dopisała (komunikat dla czytnika ekranu)
  const rec = useRef(null);
  const busy = useRef(false); // start w toku (await przed r.start): drugie dotknięcie nie uruchamia drugiej sesji
  const mounted = useRef(true);
  const latest = useRef({ value, onChange, max });
  useEffect(() => { latest.current = { value, onChange, max }; });

  useEffect(() => {
    mounted.current = true;
    setOk(Boolean(getSR()) && !isNative());
    return () => { mounted.current = false; try { rec.current?.abort(); } catch {} };
  }, []);

  async function start() {
    const SR = getSR();
    if (!SR || busy.current) return;
    busy.current = true;
    setErr(''); setSaid(false);
    const r = new SR();
    r.lang = 'pl-PL';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    try { if (typeof SR.available === 'function' && (await SR.available({ langs: ['pl-PL'], processLocally: true })) === 'available') r.processLocally = true; } catch {}
    // komponent zniknął w trakcie await: nie włączamy mikrofonu, którego nikt by nie zatrzymał
    if (!mounted.current) { busy.current = false; return; }
    const base = latest.current.value || '';
    let got = false;
    r.onresult = (e) => {
      const { text } = transcriptOf(e.results);
      if (!text) return;
      got = true;
      latest.current.onChange(joinDictation(base, text, latest.current.max));
    };
    r.onerror = (e) => { const m = dictateError(e?.error); if (m) setErr(m); };
    r.onend = () => { if (rec.current === r) rec.current = null; setState('idle'); setSaid(got); };
    rec.current = r;
    try { r.start(); setState('listening'); } catch { rec.current = null; setState('idle'); setErr(dictateError('other')); }
    busy.current = false;
  }

  function click() {
    if (state === 'listening') { try { rec.current?.stop(); } catch {} return; }
    if (!seen()) { setState('asking'); return; }
    start();
  }
  function confirm() { remember(); setState('idle'); start(); }

  if (!ok) return null;
  const on = state === 'listening';
  return (
    <div className="dictate">
      <button type="button" className={`btn ghost dictate-btn${on ? ' on' : ''}`} aria-pressed={on} onClick={click}>
        <Icon name="mic" size={18} />{on ? 'Słucham… dotknij, aby zakończyć' : 'Dyktuj'}
      </button>
      <span className="sr-only" role="status" aria-live="polite">{on ? 'Słucham. Mów teraz.' : said ? 'Dopisano podyktowany tekst.' : ''}</span>
      {state === 'asking' && (
        <div className="dictate-notice" role="group" aria-label="Informacja o rozpoznawaniu mowy">
          <p className="muted small">{DICTATE_NOTICE}</p>
          <div className="dictate-actions">
            <button type="button" className="btn" onClick={confirm}>Rozumiem, dyktuj</button>
            <button type="button" className="btn ghost" onClick={() => setState('idle')}>Anuluj</button>
          </div>
        </div>
      )}
      {err && <p className="field-err" role="alert">{err}</p>}
    </div>
  );
}
