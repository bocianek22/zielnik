// Podgląd linków (Open Graph i Twitter/X) dla Messengera, WhatsAppa, Telegrama, Signala, Discorda i SMS.
// Wszystkie trasy z danymi wymagają logowania, więc podgląd jest ogólny: bez danych użytkownika, bez kodu zaproszenia,
// bez nazw z bazy. Opisy celowo bez słów o konopiach (link trafia do rozmów grupowych). Obrazki: scripts/og-images.mjs.
// Next.js scala openGraph płytko (dziecko zastępuje całość rodzica), dlatego każda trasa buduje komplet przez ogMeta().

export const SHARES = {
  app: { title: 'Zielnik', description: 'Prywatny dziennik terapii: zapas, recepty, objawy i raport dla lekarza w jednym miejscu.', image: 'zielnik', alt: 'Zielnik: prywatny dziennik terapii' },
  invite: { title: 'Zaproszenie do Zielnika', description: 'Masz zaproszenie do Zielnika. Załóż konto z kodem zaproszenia: prywatny dziennik terapii, Twoje dane widzisz tylko Ty.', image: 'zaproszenie', alt: 'Zaproszenie do Zielnika' },
  profile: { title: 'Profil w Zielniku', description: 'Zaloguj się, żeby zobaczyć profil, oceny i opinie. Widoczność profilu ustawia jego właściciel.', image: 'profil', alt: 'Profil w Zielniku' },
};

// Adres bezwzględny dla og:image. APP_URL (własna domena) ma pierwszeństwo, potem produkcyjny adres Vercel.
// Bez VERCEL_URL: podglądy wdrożeń bywają za logowaniem Vercel i robot dostałby 401 na obrazek.
export function siteUrl() {
  for (const v of [process.env.APP_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]) {
    try { if (v) { const u = new URL(v); if (u.protocol === 'https:' || u.hostname === 'localhost') return new URL(u.origin); } } catch { /* zły adres */ }
  }
  return new URL(`http://localhost:${process.env.PORT || 3000}`);
}

export const DISCREET_META = { title: 'Notatnik', description: 'Notatnik.' };

export function ogMeta(kind = 'app') {
  const s = SHARES[kind] || SHARES.app;
  const image = { url: `/og/${s.image}.png`, width: 1200, height: 630, alt: s.alt, type: 'image/png' };
  return {
    title: s.title,
    description: s.description,
    openGraph: { type: 'website', siteName: 'Zielnik', locale: 'pl_PL', title: s.title, description: s.description, images: [image] },
    twitter: { card: 'summary_large_image', title: s.title, description: s.description, images: [image.url] },
  };
}
