import { Fraunces, Figtree } from 'next/font/google';
import './globals.css';
import { cookies } from 'next/headers';
import RegisterSW from './components/RegisterSW';
import DiscreetGuard from './components/DiscreetGuard';
import NativeShell from './components/NativeShell';

const display = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-display', display: 'swap' });
const body = Figtree({ subsets: ['latin', 'latin-ext'], variable: '--font-body' });

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1d3b27',
};

// Tryb dyskretny (ciasteczko ustawia przełącznik w profilu): neutralny tytuł karty
export async function generateMetadata() {
  const discreet = (await cookies()).get('zielnik_discreet')?.value === '1';
  return discreet
    ? { title: 'Notatnik', description: 'Notatnik.' }
    : { title: 'Zielnik', description: 'Dziennik odmian medycznej konopi: stan, oceny i spostrzeżenia.' };
}

export default async function RootLayout({ children }) {
  const discreet = (await cookies()).get('zielnik_discreet')?.value === '1';
  return (
    <html lang="pl" data-discreet={discreet ? '1' : undefined} className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('zielnik.theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}try{if(localStorage.getItem('zielnik.discreet')==='1'&&document.documentElement.dataset.discreet!=='1'){document.documentElement.dataset.discreet='1';document.cookie='zielnik_discreet=1; path=/; max-age=31536000; SameSite=Lax'}}catch(e){}" }} />
      </head>
      <body>{children}<RegisterSW /><DiscreetGuard /><NativeShell /></body>
    </html>
  );
}
