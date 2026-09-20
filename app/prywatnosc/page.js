export const metadata = { title: 'Regulamin i polityka prywatności | Zielnik' };

export default function Prywatnosc() {
  return (
    <main className="page" style={{ maxWidth: 780 }}>
      <h1>Regulamin i polityka prywatności</h1>
      <div className="alert note">Projekt roboczy. Przed publicznym uruchomieniem serwisu dla obcych osób wymaga przeglądu przez prawnika (RODO, przepisy o reklamie produktów leczniczych).</div>
      <div className="card knowledge">
        <h2>Regulamin</h2>
        <p>Zielnik to prywatny dziennik pacjentów stosujących medyczną konopię: służy do zapisywania własnych stanów, ocen i spostrzeżeń oraz, za Twoją zgodą, do dzielenia się nimi z wybranymi osobami. Serwis nie zastępuje porady lekarskiej, nie jest sklepem ani pośrednikiem w obrocie i nie służy do reklamy produktów. Zakazane jest oferowanie sprzedaży, wymiany lub przekazywania produktów oraz zachęcanie do ich używania. Konto może założyć wyłącznie osoba pełnoletnia z kodem zaproszenia. Administrator może usunąć treści lub konta naruszające regulamin.</p>
        <h2>Jakie dane przetwarzamy</h2>
        <p>Nazwę użytkownika, hasło (w postaci skrótu), opcjonalny opis profilu, awatar i linki oraz wpisy, które sam dodajesz: odmiany, oceny, stany, zużycie, zakupy, testy i zdjęcia. Informacje o stosowaniu medycznej konopii mogą być danymi dotyczącymi zdrowia, dlatego są przetwarzane wyłącznie na podstawie Twojej zgody.</p>
        <h2>Kto to widzi</h2>
        <p>Domyślnie wszystko jest widoczne tylko dla Ciebie. Oceny, opinie i testy możesz udostępnić: znajomym, znajomym znajomych albo wszystkim zalogowanym. Stany posiadania, ilości do wykupienia, zużycie i zakupy są zawsze prywatne.</p>
        <h2>Twoje prawa</h2>
        <p>Możesz w każdej chwili zmienić widoczność, pobrać swoje dane (Eksport CSV), wycofać zgodę i usunąć konto razem z danymi w zakładce Mój profil. Skargę możesz złożyć do Prezesa Urzędu Ochrony Danych Osobowych.</p>
      </div>
    </main>
  );
}
