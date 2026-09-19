# Zielnik

Dziennik odmian medycznej konopi: stan, oceny, spostrzeżenia, koło fortuny i rankingi.
Next.js (App Router) + Postgres (Neon) + własne logowanie (JWT w ciasteczku).

## Uruchomienie lokalne
1. `npm install`
2. Skopiuj `.env.example` do `.env.local` i uzupełnij wartości.
3. `npm run dev` (tabele i konto admina `Bocian` tworzą się automatycznie przy pierwszym żądaniu).

## Wdrożenie na Vercel
1. Wypchnij repozytorium na GitHub i zaimportuj je w Vercel (New Project).
2. W Vercel: Storage → Create → Neon (Postgres). Zmienna `DATABASE_URL` doda się sama.
3. W Settings → Environment Variables dodaj `AUTH_SECRET` (`openssl rand -base64 32`) i `BOCIAN_INITIAL_PASSWORD`.
4. Deploy. Zaloguj się jako `Bocian` hasłem startowym, system wymusi zmianę hasła.

## Etapy
- [x] Etap 1: fundament, logowanie, admin, zarządzanie kontami, motyw
- [x] Etap 2: lista odmian, pola wspólne i osobiste, listy wyboru z dopisywaniem opcji
- [x] Etap 3: koło fortuny, rankingi (tydzień / miesiąc / ogółem, wspólne i osobiste)
- [ ] Etap 4: szlify, testy na produkcji
