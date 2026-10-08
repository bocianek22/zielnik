import { Fraunces, Figtree } from 'next/font/google';
// Kolejność ma znaczenie: tokeny i komponenty bazowe, potem ekrany, na końcu wydruk/tryb dyskretny/natywna powłoka
import './globals.css';
import './styles/nav.css';
import './styles/strains.css';
import './styles/detail.css';
import './styles/profile.css';
import './styles/auth.css';
import './styles/screens.css';
import './styles/catalog.css';
import './styles/rankings.css';
import './styles/forms.css';
import './styles/history.css';
import './styles/diary.css';
import './styles/admin.css';
import './styles/system.css';
import './styles/social.css';
import './styles/content.css';
import './styles/home.css';
import './styles/platform.css';
import './styles/proposals.css';
import { cookies, headers } from 'next/headers';
import { isNativeApp } from '@/lib/client';
import RegisterSW from './components/RegisterSW';
import DiscreetGuard from './components/DiscreetGuard';
import NativeShell from './components/NativeShell';
import WebLock from './components/WebLock';
import { BOOT_SCRIPT } from '@/lib/applock';

const display = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-display', display: 'swap' });
const body = Figtree({ subsets: ['latin', 'latin-ext'], variable: '--font-body' });

// W aplikacji natywnej bez powiększania dwoma palcami i podwójnym dotknięciem (jak w aplikacjach systemowych);
// w przeglądarce powiększanie zostaje (dostępność).
export async function generateViewport() {
  const native = isNativeApp(await headers());
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: '#1d3b27',
    ...(native && { maximumScale: 1, userScalable: false }),
  };
}

// Jawna ikona karty: bez niej przeglądarka pyta o /favicon.ico (404 w konsoli)
const icons = { icon: '/icon-192.png' };
// tryb dyskretny: neutralna ikona karty (liść zdradzałby aplikację)
const discreetIcons = { icon: '/notatnik.svg' };

// Tryb dyskretny (ciasteczko ustawia przełącznik w profilu): neutralny tytuł karty
export async function generateMetadata() {
  const discreet = (await cookies()).get('zielnik_discreet')?.value === '1';
  return discreet
    ? { title: 'Notatnik', description: 'Notatnik.', icons: discreetIcons }
    : { title: 'Zielnik', description: 'Dziennik odmian medycznej konopi: stan, oceny i spostrzeżenia.', icons };
}

export default async function RootLayout({ children }) {
  const discreet = (await cookies()).get('zielnik_discreet')?.value === '1';
  // klasa aplikacji natywnej już z serwera, żeby styl aplikacji nie „doskakiwał” po załadowaniu strony
  const h = await headers();
  const native = isNativeApp(h);
  // nonce z middleware.js (CSP): bez niego przeglądarka zablokuje skrypt motywu
  const nonce = h.get('x-nonce') || undefined;
  return (
    <html lang="pl" data-discreet={discreet ? '1' : undefined} className={`${display.variable} ${body.variable}${native ? ' native-app' : ''}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('zielnik.theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}try{if(localStorage.getItem('zielnik.big')==='1')document.documentElement.classList.add('big-ui')}catch(e){}try{if(localStorage.getItem('zielnik.discreet')==='1'&&document.documentElement.dataset.discreet!=='1'){document.documentElement.dataset.discreet='1';document.cookie='zielnik_discreet=1; path=/; max-age=31536000; SameSite=Lax'}}catch(e){}" }} />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body>{children}<RegisterSW /><DiscreetGuard /><NativeShell /><WebLock /></body>
    </html>
  );
}
