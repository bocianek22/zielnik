import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getUser } from '@/lib/auth';
import { betaGroupUrl } from '@/lib/beta';
import { VERSION } from '@/lib/version';
import { WHATS_NEW } from '@/lib/whats-new';
import Header from '../components/Header';
import Icon from '../components/Icon';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pomoc' };

// Pytania i odpowiedzi; {app} to nazwa aplikacji (w trybie dyskretnym „Notatnik”)
const faq = (app) => [
  ['Czym jest tryb dyskretny?', `Ustawienie na tym urządzeniu (Mój profil, „Tryb dyskretny”). Karta przeglądarki nazywa się wtedy „Notatnik”, a nazwy pozycji na listach są rozmyte, dopóki ich nie dotkniesz. Ikona i nazwa na ekranie głównym telefonu nie zmieniają się, bo ustawia je system. Szybkie przełączanie: dwa szybkie dotknięcia logo w nagłówku.`],
  ['Gdzie są moje dane i kto je widzi?', `Dane trzymamy na serwerze ${app}. Domyślnie wszystko widzisz tylko Ty. Oceny, opinie i testy możesz udostępnić znajomym lub wszystkim zalogowanym, a stany, zużycie, zakupy i recepty są zawsze prywatne. Zgłoszenia z formularza „Zgłoś uwagę” widzi tylko administrator.`],
  ['Jak pobrać swoje dane?', 'Mój profil, sekcja „Moje dane”: „Pobierz dane (JSON)” zawiera wszystko, co o Tobie przechowujemy (także Twoje zgłoszenia do administratora). Dziennik w CSV otworzysz w Excelu.'],
  ['Jak usunąć konto?', 'Mój profil, na dole, sekcja „Usuń konto” (wymaga hasła; konta administratora nie można usunąć samodzielnie). Konto i wszystkie Twoje dane znikają bezpowrotnie, razem ze zgłoszeniami do administratora. Warto wcześniej pobrać eksport.'],
  ['Do czego służy blokada PIN?', 'To zabezpieczenie przed przypadkowym wglądem, gdy ktoś weźmie Twój telefon lub komputer. Ustawisz ją w profilu (w przeglądarce PIN, w aplikacji na Androidzie odcisk palca lub blokada ekranu). PIN jest zapisany tylko na tym urządzeniu. Jeśli go zapomnisz, zaloguj się ponownie hasłem.'],
  ['Zapomniałem hasła.', 'Na ekranie logowania wybierz „Nie pamiętam hasła”. Jeśli nie podałeś adresu e-mail w profilu, poproś administratora o nowe hasło tymczasowe.'],
];

export default async function Pomoc() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const discreet = (await cookies()).get('zielnik_discreet')?.value === '1';
  const app = discreet ? 'Notatnika' : 'Zielnika';
  const group = betaGroupUrl();

  return (
    <>
      <Header user={user} />
      <main className="page read" id="top">
        <h1>Pomoc</h1>
        <div className="alert note read-note" role="note">
          <Icon name="info" size={20} />
          <p>Aplikacja jest w wersji testowej (beta): coś może jeszcze nie działać jak trzeba. Twoje uwagi bardzo pomagają, więc zgłaszaj je śmiało.</p>
        </div>

        <nav aria-label="Spis treści">
          <h2 className="section-label">Spis treści</h2>
          <ul className="list toc">
            {[['start', 'Jak zacząć'], ['instalacja', 'Instalacja na telefonie'], ['zgloszenia', 'Jak zgłaszać uwagi'], ['ograniczenia', 'Znane ograniczenia'], ['faq', 'Najczęstsze pytania'], ['co-nowego', 'Co nowego']].map(([id, title]) => (
              <li key={id}><a className="list-row" href={`#${id}`}><span className="lr-main">{title}</span><Icon name="chevronRight" size={20} className="lr-chev" /></a></li>
            ))}
          </ul>
        </nav>

        <section id="start" className="read-article">
          <h2>Jak zacząć</h2>
          <ol className="steps">
            <li>Dodaj pierwszą pozycję przyciskiem „Dodaj odmianę” na ekranie głównym (albo wybierz ją z katalogu).</li>
            <li>Zapisuj stan, ocenę i zużycie. „Zużyłem” i „Wykupiłem” mają przycisk „Cofnij”, więc pomyłka nie boli.</li>
            <li>Raz dziennie wpisz, jak się czujesz (zakładka „Więcej”, „Dziennik objawów”). Po kilku tygodniach zobaczysz wykresy.</li>
            <li>Przed wizytą u lekarza otwórz „Raport dla lekarza” i zapisz w nim pytania „Do omówienia”.</li>
          </ol>
          <p className="muted">Kreator pierwszego uruchomienia możesz pominąć. Wszystko da się ustawić później w profilu.</p>
        </section>

        <section id="instalacja" className="read-article">
          <h2>Instalacja na telefonie</h2>
          <h3>Android: aplikacja (APK)</h3>
          <p>Link do pliku APK dostajesz w zaproszeniu{group ? ' lub w grupie testerów' : ''}. Otwórz go na telefonie, pobierz plik i zainstaluj. Android może zapytać o zgodę na instalację z tego źródła: to normalne przy wersji testowej. Aplikacja ma blokadę odciskiem palca i powiadomienia.</p>
          <h3>Android: z przeglądarki (PWA)</h3>
          <p>W Chrome otwórz adres aplikacji, wybierz menu z trzema kropkami, potem „Zainstaluj aplikację” albo „Dodaj do ekranu głównego”. Ikona pojawi się wśród innych aplikacji.</p>
          <h3>iPhone: Safari</h3>
          <p>Otwórz adres aplikacji w Safari (nie w Chrome). Dotknij „Udostępnij” (kwadrat ze strzałką), przewiń listę i wybierz „Do ekranu początkowego”, potem „Dodaj”. Powiadomienia działają tylko po dodaniu do ekranu początkowego i wymagają iOS 16.4 lub nowszego.</p>
        </section>

        <section id="zgloszenia" className="read-article">
          <h2>Jak zgłaszać uwagi</h2>
          <p>Wybierz „Zgłoś uwagę” w zakładce „Więcej” (albo na ekranie błędu), wskaż rodzaj i opisz własnymi słowami, co się stało lub co by pomogło. Do zgłoszenia dołączamy tylko numer wersji, nazwę ekranu bez numerów, rodzaj urządzenia (aplikacja, PWA lub przeglądarka) i motyw. Nie wpisuj danych zdrowotnych ani osobowych. Status swoich zgłoszeń zobaczysz na tej samej stronie.</p>
          <p><Link className="btn" href="/uwagi?ekran=%2Fpomoc">Zgłoś uwagę</Link></p>
          {group && <p><a className="btn ghost" href={group} target="_blank" rel="noopener noreferrer">Grupa testerów<Icon name="share" size={18} /></a></p>}
        </section>

        <section id="ograniczenia" className="read-article">
          <h2>Znane ograniczenia</h2>
          <ul className="steps">
            <li>iPhone: powiadomienia tylko po dodaniu do ekranu początkowego i od iOS 16.4.</li>
            <li>Widżet na ekran główny jest tylko w aplikacji na Androida (APK).</li>
            <li>Przypomnienia (o wpisie, o wizycie, o kończącym się zapasie) działają po włączeniu powiadomień na tym urządzeniu i po skonfigurowaniu ich przez administratora. Bez tego ustawienia w profilu są ukryte lub nic nie wysyłają.</li>
            <li>Ikony i nazwy na ekranie głównym telefonu nie zmieniają się w trybie dyskretnym.</li>
            <li>Bez internetu można zapisywać zużycie i zakupy: wpisy czekają w kolejce i wysyłają się po odzyskaniu połączenia.</li>
          </ul>
        </section>

        <section id="faq" className="read-article">
          <h2>Najczęstsze pytania</h2>
          <ul className="list terp-list">
            {faq(app).map(([q, a]) => (
              <li key={q}>
                <details className="terp">
                  <summary className="list-row">
                    <span className="lr-main"><span className="terp-name">{q}</span></span>
                    <Icon name="chevronDown" size={20} className="lr-chev" />
                  </summary>
                  <p className="faq-a">{a}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>

        <section id="co-nowego" className="read-article">
          <h2>Co nowego</h2>
          <p className="muted">Aktualna wersja: {VERSION} (beta).</p>
          {WHATS_NEW.map((e) => (
            <div key={e.version}>
              <h3>Wersja {e.version}</h3>
              <ul className="steps">{e.items.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          ))}
          <a className="to-top" href="#top">Do spisu treści</a>
        </section>
      </main>
    </>
  );
}
