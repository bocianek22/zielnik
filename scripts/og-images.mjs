// Obrazki podglądu linków (Open Graph, 1200×630) do public/og/: ogólny, zaproszenie i profil. Statyczne pliki,
// bez danych użytkownika; po zmianie treści: node scripts/og-images.mjs i commit PNG. Teksty i adresy: lib/og.js.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';

const font = (f) => readFileSync(new URL(`../public/fonts/${f}`, import.meta.url));
const fonts = [
  { name: 'Figtree', data: font('Figtree-Regular.ttf'), weight: 400, style: 'normal' },
  { name: 'Figtree', data: font('Figtree-Bold.ttf'), weight: 700, style: 'normal' },
];

// liść jak w app/components/Leaf.js
const BLADES = [[0, 40], [-28, 34], [28, 34], [-56, 27], [56, 27], [-80, 18], [80, 18]];
const leafSvg = (color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="${color}">${BLADES.map(([a, ry]) =>
  `<ellipse cx="50" cy="${86 - ry}" rx="${ry > 30 ? 6 : 5}" ry="${ry}" transform="rotate(${a} 50 86)"/>`).join('')}<rect x="48.6" y="84" width="2.8" height="14" rx="1.4"/></svg>`;
const leaf = (color) => `data:image/svg+xml;base64,${Buffer.from(leafSvg(color)).toString('base64')}`;

const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children: children.flat() } });
const img = (src, size, style = {}) => ({ type: 'img', props: { src, width: size, height: size, style } });

function card({ badge, title, lead, chips }) {
  return h('div', { width: 1200, height: 630, position: 'relative', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px',
    background: 'linear-gradient(135deg, #0a2e24 0%, #0f6b52 100%)', color: '#ffffff', fontFamily: 'Figtree' },
  img(leaf('rgba(255,255,255,0.07)'), 560, { position: 'absolute', right: -70, bottom: -90 }),
  h('div', { alignItems: 'center', gap: 20 },
    h('div', { width: 76, height: 76, borderRadius: 22, background: '#ffffff', alignItems: 'center', justifyContent: 'center' }, img(leaf('#0f6b52'), 56)),
    h('div', { fontSize: 40, fontWeight: 700, letterSpacing: -0.5 }, 'Zielnik'),
    badge ? h('div', { marginLeft: 8, fontSize: 24, fontWeight: 700, padding: '8px 18px', borderRadius: 999, background: '#4fd1a5', color: '#0a2e24' }, badge) : []),
  h('div', { flexDirection: 'column', gap: 18, maxWidth: 900 },
    h('div', { fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.5 }, title),
    h('div', { fontSize: 32, lineHeight: 1.35, color: '#d9f0e7' }, lead)),
  h('div', { gap: 14 }, chips.map((c) => h('div', { fontSize: 24, padding: '10px 22px', borderRadius: 999, border: '2px solid rgba(255,255,255,0.35)', color: '#ffffff' }, c))));
}

export const CARDS = {
  zielnik: { title: 'Prywatny dziennik terapii', lead: 'Zapas, recepty, objawy i raport dla lekarza w jednym miejscu.', chips: ['Zapas i recepty', 'Dziennik objawów', 'Raport dla lekarza'] },
  zaproszenie: { badge: 'Zaproszenie', title: 'Dołącz do Zielnika', lead: 'Załóż konto z kodem zaproszenia. Twoje dane widzisz tylko Ty.', chips: ['Zamknięta społeczność', 'Bez reklam', 'Dane prywatne'] },
  profil: { badge: 'Profil', title: 'Profil w Zielniku', lead: 'Zaloguj się, żeby zobaczyć profil, oceny i opinie.', chips: ['Oceny i opinie', 'Znajomi', 'Widoczność ustawiasz sam'] },
};

mkdirSync(new URL('../public/og/', import.meta.url), { recursive: true });
for (const [name, c] of Object.entries(CARDS)) {
  const png = Buffer.from(await new ImageResponse(card(c), { width: 1200, height: 630, fonts }).arrayBuffer());
  writeFileSync(new URL(`../public/og/${name}.png`, import.meta.url), png);
  console.log(`public/og/${name}.png ${Math.round(png.length / 1024)} KB`);
}
