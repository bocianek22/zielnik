import Icon from '../components/Icon';

export const metadata = { title: 'Regulamin i polityka prywatności | Zielnik' };

const SECTIONS = [
  ['regulamin', 'Regulamin', 'Zielnik to prywatny dziennik pacjentów stosujących medyczną konopię: służy do zapisywania własnych stanów, ocen i spostrzeżeń oraz, za Twoją zgodą, do dzielenia się nimi z wybranymi osobami. Serwis nie zastępuje porady lekarskiej, nie jest sklepem ani pośrednikiem w obrocie i nie służy do reklamy produktów. Zakazane jest oferowanie sprzedaży, wymiany lub przekazywania produktów oraz zachęcanie do ich używania. Konto może założyć wyłącznie osoba pełnoletnia z kodem zaproszenia. Administrator może usunąć treści lub konta naruszające regulamin.'],
  ['dane', 'Jakie dane przetwarzamy', 'Nazwę użytkownika, hasło (w postaci skrótu), opcjonalny opis profilu, awatar i linki oraz wpisy, które sam dodajesz: odmiany, oceny, stany, zużycie, zakupy, testy i zdjęcia. Informacje o stosowaniu medycznej konopii mogą być danymi dotyczącymi zdrowia, dlatego są przetwarzane wyłącznie na podstawie Twojej zgody.'],
  ['internet', 'Podpowiedzi z internetu i średnie ceny', 'Funkcja „Uzupełnij z internetu” wysyła do zewnętrznego dostawcy usługi AI wyłącznie nazwę odmiany i producenta (bez danych osobowych). Ceny, które wpisujesz przy odmianach, tworzą średnią cenę widoczną dopiero od 3 zgłoszeń i nigdy nie ujawniają pojedynczych wpisów.'],
  ['widocznosc', 'Kto to widzi', 'Domyślnie wszystko jest widoczne tylko dla Ciebie. Oceny, opinie i testy możesz udostępnić: znajomym, znajomym znajomych albo wszystkim zalogowanym. Stany posiadania, ilości do wykupienia, zużycie i zakupy są zawsze prywatne.'],
  ['prawa', 'Twoje prawa', 'Możesz w każdej chwili zmienić widoczność, pobrać swoje dane (Eksport CSV), wycofać zgodę i usunąć konto razem z danymi w zakładce Mój profil. Skargę możesz złożyć do Prezesa Urzędu Ochrony Danych Osobowych.'],
];

export default function Prywatnosc() {
  return (
    <main className="page read read-narrow" id="top">
      <h1>Regulamin i polityka prywatności</h1>
      <div className="alert note read-note" role="note">
        <Icon name="info" size={20} />
        <p>Projekt roboczy. Przed publicznym uruchomieniem serwisu dla obcych osób wymaga przeglądu przez prawnika (RODO, przepisy o reklamie produktów leczniczych).</p>
      </div>

      <nav aria-label="Spis treści">
        <h2 className="section-label">Spis treści</h2>
        <ul className="list toc">
          {SECTIONS.map(([id, title]) => (
            <li key={id}><a className="list-row" href={`#${id}`}><span className="lr-main">{title}</span><Icon name="chevronRight" size={20} className="lr-chev" /></a></li>
          ))}
        </ul>
      </nav>

      {SECTIONS.map(([id, title, text]) => (
        <section key={id} id={id} className="read-article">
          <h2>{title}</h2>
          <p>{text}</p>
          <a className="to-top" href="#top">Do spisu treści</a>
        </section>
      ))}
    </main>
  );
}
