import { Fraunces, Figtree } from 'next/font/google';
import './globals.css';

const display = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-display', axes: ['SOFT'] });
const body = Figtree({ subsets: ['latin', 'latin-ext'], variable: '--font-body' });

export const metadata = {
  title: 'Zielnik',
  description: 'Dziennik odmian medycznej konopi: stan, oceny i spostrzeżenia.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pl" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
