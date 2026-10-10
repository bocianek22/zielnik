// Dyktowanie notatek (POM-43): funkcje czyste, bez przeglądarki. Komponent: app/components/DictateButton.js.

// Dopisuje podyktowany tekst do tego, co już jest w polu: jedna spacja na styku (nowa linia i spacja na końcu zostają
// bez dodatkowej spacji), przycięcie do limitu pola. Pusty dyktat zostawia pole bez zmian.
export function joinDictation(base = '', spoken = '', max = Infinity) {
  const said = String(spoken).replace(/\s+/g, ' ').trim();
  if (!said) return base;
  const sep = !base || /\s$/.test(base) ? '' : ' ';
  const out = base + sep + said;
  return out.length > max ? out.slice(0, max).trimEnd() : out;
}

// Składa transkrypt z wyników rozpoznawania (event.results): { text, final } z całej sesji
export function transcriptOf(results) {
  let text = '';
  let final = true;
  for (let i = 0; i < (results?.length ?? 0); i++) {
    const alt = results[i]?.[0];
    if (!alt) continue;
    text += (text ? ' ' : '') + String(alt.transcript || '').trim();
    if (!results[i].isFinal) final = false;
  }
  return { text, final };
}

// Komunikaty błędów SpeechRecognition (event.error); null = bez komunikatu (świadome przerwanie)
export function dictateError(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Brak zgody na użycie mikrofonu. Zezwól na mikrofon w ustawieniach przeglądarki dla tej strony.';
    case 'audio-capture': return 'Nie znaleziono mikrofonu.';
    case 'no-speech': return 'Nie usłyszałem mowy. Spróbuj jeszcze raz.';
    case 'network': return 'Rozpoznawanie mowy wymaga połączenia z internetem.';
    case 'language-not-supported': return 'Przeglądarka nie rozpoznaje mowy po polsku.';
    case 'aborted': return null;
    default: return 'Nie udało się rozpoznać mowy. Spróbuj jeszcze raz.';
  }
}

export const DICTATE_NOTICE = 'Rozpoznawanie mowy wykonuje przeglądarka i może do tego korzystać z usług swojego dostawcy (np. Google w Chrome, Apple w Safari). Zielnik nie wysyła nagrania; zapisuje tylko gotową notatkę.';
