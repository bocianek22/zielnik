import { Fraunces, Figtree } from 'next/font/google';
import './globals.css';

const display = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-display', axes: ['SOFT'] });
const body = Figtree({ subsets: ['latin', 'latin-ext'], variable: '--font-body' });

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1d3b27',
};

export const metadata = {
  title: 'Zielnik',
  description: 'Dziennik odmian medycznej konopi: stan, oceny i spostrzeżenia.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pl" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('zielnik.theme');if(t==='dark')document.documentElement.dataset.theme='dark'}catch(e){}" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
