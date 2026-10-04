import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

let _sql;
export function sql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Brak zmiennej DATABASE_URL');
    _sql = neon(url);
  }
  return _sql;
}

export const DEFAULT_PRODUCERS = [
  'Canopy Growth', 'Aurora', 'Tilray', 'S-Lab', 'Synoptis', 'Phytopur Bio',
  'Cosma', 'Four 20 Pharma', 'Cantourage', 'Suprobion', 'Bliss Pharma', 'Medalchemy',
];
export const DEFAULT_TYPES = ['haze', 'kush', 'hybryda'];
export const DEFAULT_TERPENES = ['Mircen', 'Limonen', 'Kariofilen', 'Linalol', 'Pinen', 'Humulen', 'Terpinolen', 'Ocymen', 'Bisabolol', 'Nerolidol', 'Farnezen', 'Gwajol'];

let ready = null;
export function ensureDb() {
  if (!ready) ready = migrate().catch((e) => { ready = null; throw e; });
  return ready;
}

// Suma kontrolna migracji: zmienia się sama przy każdej zmianie SQL w init() (lub list domyślnych),
// więc nie trzeba pamiętać o podbijaniu wersji schematu. Liczona z treści szablonów sql`...` bez wstawek
// ${...}, bo nazwy zmiennych i funkcji po minifikacji różnią się między paczkami funkcji Vercel,
// a treść szablonów zostaje bez zmian - każda paczka musi wyliczyć tę samą sumę.
// SCHEMA_REV: podnieś ręcznie przy zmianie samej logiki JS w init() (warunki, wartości we wstawkach ${...}),
// której suma z treści SQL nie zauważy.
const SCHEMA_REV = 1;
export const SCHEMA_HASH = createHash('sha256')
  .update(`rev:${SCHEMA_REV}\n`)
  .update((init.toString().match(/`(?:[^`\\]|\\.)*`/g) || []).map((t) => t.replace(/\$\{[^}]*\}/g, '${}')).join('\n'))
  .update(JSON.stringify([DEFAULT_PRODUCERS, DEFAULT_TYPES, DEFAULT_TERPENES]))
  .digest('hex');

// Zimny start funkcji: gdy baza ma już schemat zgodny z bieżącym kodem, zamiast ~85 zapytań migracji
// wystarcza jedno (suma kontrolna + stan konta admina). Pełne init() tylko przy niezgodności.
async function migrate() {
  const q = sql();
  const fast = await readMeta(q);
  if (fast?.hash === SCHEMA_HASH) return syncAdmin(q, fast.admin);
  // kilka instancji naraz może się zderzyć (np. równoległe CREATE TABLE IF NOT EXISTS na świeżej bazie
  // kończy się błędem unikalności w pg_type); migracje są idempotentne, więc ponawiamy z losową przerwą
  for (let attempt = 1; ; attempt++) {
    try {
      await init();
      // suma zapisywana tylko po udanej migracji
      await q`CREATE TABLE IF NOT EXISTS schema_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await q`INSERT INTO schema_meta (key, value) VALUES ('schema', ${SCHEMA_HASH})
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
      return;
    } catch (e) {
      if (attempt >= 4) throw e;
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 200 * attempt));
      // inna instancja mogła w tym czasie dokończyć migrację
      if ((await readMeta(q))?.hash === SCHEMA_HASH) return;
    }
  }
}

// null, gdy schematu jeszcze nie ma (brak tabel) - wtedy pełna migracja
async function readMeta(q) {
  try {
    const [r] = await q`SELECT (SELECT value FROM schema_meta WHERE key = 'schema') AS hash,
                               u.id, u.password_hash, u.must_change_password
                        FROM (SELECT 1) one LEFT JOIN users u ON lower(u.username) = 'bocian'`;
    return { hash: r.hash, admin: r.id == null ? null : r };
  } catch {
    return null;
  }
}

// Konto admina "Bocian": utworzenie przy pierwszym starcie, a dopóki Bocian nie ustawił własnego hasła,
// hasło startowe ze zmiennej środowiskowej jest nadrzędne (bcrypt tylko w tym stanie)
async function syncAdmin(q, existing) {
  const pwd = process.env.BOCIAN_INITIAL_PASSWORD;
  if (!existing) {
    if (!pwd || pwd.length < 8) {
      throw new Error('Ustaw BOCIAN_INITIAL_PASSWORD (min. 8 znaków), aby utworzyć konto admina.');
    }
    const hash = await bcrypt.hash(pwd, 10);
    await q`INSERT INTO users (username, password_hash, is_admin, must_change_password)
            VALUES ('Bocian', ${hash}, TRUE, TRUE) ON CONFLICT DO NOTHING`;
  } else if (existing.must_change_password && pwd && pwd.length >= 8) {
    if (!(await bcrypt.compare(pwd, existing.password_hash))) {
      // awaryjne odzyskanie konta: nowe hasło startowe wylogowuje też wszystkie dotychczasowe sesje
      await q`UPDATE users SET password_hash = ${await bcrypt.hash(pwd, 10)}, session_version = session_version + 1 WHERE id = ${existing.id}`;
    }
  }
}

async function init() {
  const q = sql();

  await q`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (lower(username))`;

  // Listy wyboru (producent, typ) - użytkownicy mogą dopisywać własne opcje
  await q`CREATE TABLE IF NOT EXISTS options (
    id SERIAL PRIMARY KEY,
    kind TEXT NOT NULL,
    value TEXT NOT NULL,
    UNIQUE (kind, value)
  )`;

  // Pola wspólne dla wszystkich użytkowników
  await q`CREATE TABLE IF NOT EXISTS strains (
    id SERIAL PRIMARY KEY,
    producer TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    final_rating NUMERIC(3,1),
    taste TEXT NOT NULL DEFAULT '',
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  // Pola osobiste: jeden wiersz na parę (odmiana, użytkownik)
  await q`CREATE TABLE IF NOT EXISTS user_strain (
    strain_id INT NOT NULL REFERENCES strains(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating NUMERIC(3,1),
    rated_at TIMESTAMPTZ,
    current_amount NUMERIC(8,2) NOT NULL DEFAULT 0,
    remaining_to_buy NUMERIC(8,2) NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (strain_id, user_id)
  )`;

  // Etap 4: stężenia, rodzaj, terpeny, opis i zdjęcie podglądowe
  await q`ALTER TABLE strains ADD COLUMN IF NOT EXISTS thc NUMERIC(4,1)`;
  await q`ALTER TABLE strains ADD COLUMN IF NOT EXISTS cbd NUMERIC(4,1)`;
  await q`ALTER TABLE strains ADD COLUMN IF NOT EXISTS kind TEXT`;
  await q`ALTER TABLE strains ADD COLUMN IF NOT EXISTS terpenes JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await q`ALTER TABLE strains ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`;
  await q`CREATE TABLE IF NOT EXISTS strain_photos (
    strain_id INT PRIMARY KEY REFERENCES strains(id) ON DELETE CASCADE,
    mime TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  // Etap 5: jedna pula "do wykupienia" dla odmian o tym samym producencie oraz stężeniu THC i CBD (jedna recepta)
  await q`CREATE OR REPLACE FUNCTION pool_key(p_id INT, p_producer TEXT, p_thc NUMERIC, p_cbd NUMERIC) RETURNS TEXT AS $$
    SELECT CASE WHEN p_thc IS NULL THEN 'strain:' || p_id
                ELSE lower(trim(p_producer)) || '|' || p_thc::text || '|' || coalesce(p_cbd, 0.0)::text END
  $$ LANGUAGE SQL IMMUTABLE`;
  const hadPool = (await q`SELECT to_regclass('public.user_pool') AS t`)[0].t;
  await q`CREATE TABLE IF NOT EXISTS user_pool (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pool_key TEXT NOT NULL,
    remaining_to_buy NUMERIC(8,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, pool_key)
  )`;
  if (!hadPool) {
    // jednorazowo: przenieś dotychczasowe wartości (z puli bierzemy największą, bez sumowania duplikatów)
    await q`INSERT INTO user_pool (user_id, pool_key, remaining_to_buy)
            SELECT us.user_id, pool_key(s.id, s.producer, s.thc, s.cbd), MAX(us.remaining_to_buy)
            FROM user_strain us JOIN strains s ON s.id = us.strain_id
            WHERE us.remaining_to_buy > 0 GROUP BY 1, 2 ON CONFLICT DO NOTHING`;
  }
  await q`CREATE TABLE IF NOT EXISTS strain_tests (
    id SERIAL PRIMARY KEY,
    strain_id INT NOT NULL REFERENCES strains(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    note TEXT NOT NULL DEFAULT '',
    mime TEXT,
    data TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await q`ALTER TABLE user_strain ADD COLUMN IF NOT EXISTS effects JSONB NOT NULL DEFAULT '{}'::jsonb`;

  // Etap 8: cena, seria, data ważności
  await q`ALTER TABLE strains ADD COLUMN IF NOT EXISTS price_per_g NUMERIC(8,2)`;
  await q`ALTER TABLE strains ADD COLUMN IF NOT EXISTS batch TEXT NOT NULL DEFAULT ''`;
  await q`ALTER TABLE strains ADD COLUMN IF NOT EXISTS expires_on DATE`;

  await q`CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strain_id INT REFERENCES strains(id) ON DELETE SET NULL,
    strain_name TEXT NOT NULL,
    grams NUMERIC(8,2) NOT NULL,
    cost NUMERIC(10,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await q`CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    n INT NOT NULL,
    reset_at TIMESTAMPTZ NOT NULL
  )`;

  await q`CREATE TABLE IF NOT EXISTS backups (
    id SERIAL PRIMARY KEY,
    kind TEXT NOT NULL,
    size INT NOT NULL,
    data TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  // kopia w Vercel Blob: w wierszu zostają tylko metadane (data = ''), ścieżka pliku w blob_path
  await q`ALTER TABLE backups ADD COLUMN IF NOT EXISTS blob_path TEXT`;

  await q`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'`;
  await q`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_until TIMESTAMPTZ`;

  await q`CREATE TABLE IF NOT EXISTS prescriptions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issued_on DATE NOT NULL,
    valid_until DATE,
    grams NUMERIC(8,2) NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await q`ALTER TABLE strain_tests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`;

  await q`CREATE TABLE IF NOT EXISTS symptom_log (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    pain INT, sleep INT, anxiety INT, mood INT,
    note TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, day)
  )`;

  await q`CREATE TABLE IF NOT EXISTS error_log (
    id SERIAL PRIMARY KEY,
    at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    digest TEXT,
    path TEXT
  )`;

  await q`ALTER TABLE strains ADD COLUMN IF NOT EXISTS sources JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await q`ALTER TABLE strains ADD COLUMN IF NOT EXISTS description_auto BOOLEAN NOT NULL DEFAULT FALSE`;
  await q`ALTER TABLE user_strain ADD COLUMN IF NOT EXISTS price_per_g NUMERIC(8,2)`;
  await q`CREATE TABLE IF NOT EXISTS strain_suggestions (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await q`CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    at TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    details TEXT
  )`;

  // Etap 12: konta, profile, znajomi, grupy i widoczność treści
  await q`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT ''`;
  await q`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT ''`;
  await q`ALTER TABLE users ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await q`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`;
  await q`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'friends'`;
  await q`ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ`;
  await q`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`;
  await q`CREATE TABLE IF NOT EXISTS invites (
    code TEXT PRIMARY KEY,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    note TEXT NOT NULL DEFAULT '',
    max_uses INT NOT NULL DEFAULT 1,
    uses INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS friendships (
    requester INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (requester, addressee)
  )`;
  await q`CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair ON friendships (LEAST(requester, addressee), GREATEST(requester, addressee))`;
  await q`CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    owner_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS group_members (
    group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'invited',
    PRIMARY KEY (group_id, user_id)
  )`;
  // istniejące wpisy pozostają widoczne dla wszystkich (dotychczasowe zachowanie), nowe domyślnie są prywatne
  await q`ALTER TABLE user_strain ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'all'`;
  await q`ALTER TABLE user_strain ALTER COLUMN visibility SET DEFAULT 'me'`;
  await q`ALTER TABLE strain_tests ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'all'`;
  await q`ALTER TABLE strain_tests ALTER COLUMN visibility SET DEFAULT 'me'`;
  await q`CREATE TABLE IF NOT EXISTS blocks (
    blocker INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker, blocked)
  )`;
  await q`CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    reporter_id INT REFERENCES users(id) ON DELETE SET NULL,
    target_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    ref INT,
    reason TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  // czy oglądający może zobaczyć treść właściciela (blokada w dowolną stronę ukrywa wszystko) przy danym poziomie widoczności
  await q`CREATE OR REPLACE FUNCTION can_see(p_viewer INT, p_owner INT, p_vis TEXT) RETURNS BOOLEAN AS $$
    SELECT p_viewer = p_owner OR (
      NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = p_viewer AND b.blocked = p_owner) OR (b.blocker = p_owner AND b.blocked = p_viewer))
      AND (p_vis = 'all'
      OR (p_vis IN ('friends', 'fof') AND EXISTS (
            SELECT 1 FROM friendships f WHERE f.status = 'accepted'
              AND ((f.requester = p_viewer AND f.addressee = p_owner) OR (f.requester = p_owner AND f.addressee = p_viewer))))
      OR (p_vis = 'fof' AND EXISTS (
            SELECT 1
            FROM (SELECT CASE WHEN f1.requester = p_viewer THEN f1.addressee ELSE f1.requester END AS mate
                  FROM friendships f1 WHERE f1.status = 'accepted' AND (f1.requester = p_viewer OR f1.addressee = p_viewer)) a
            JOIN (SELECT CASE WHEN f2.requester = p_owner THEN f2.addressee ELSE f2.requester END AS mate
                  FROM friendships f2 WHERE f2.status = 'accepted' AND (f2.requester = p_owner OR f2.addressee = p_owner)) b
              ON a.mate = b.mate))
      ))
  $$ LANGUAGE SQL STABLE`;
  // MOB-10: "znajomi znajomych" wyżej wybierają najpierw znajomości obu osób (indeksy), zamiast łączyć całą
  // tabelę znajomości ze sobą dla każdego wiersza; indeksy pod drugą stronę par i zapytania po użytkowniku
  await q`CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON friendships (addressee)`;
  await q`CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON blocks (blocked)`;
  await q`CREATE INDEX IF NOT EXISTS user_strain_user_idx ON user_strain (user_id)`;

  // Katalog rynkowy: odmiany dostępne w Polsce (aktualizowany z zewnętrznego źródła lub importem admina)
  await q`CREATE TABLE IF NOT EXISTS market_catalog (
    id SERIAL PRIMARY KEY,
    producer TEXT NOT NULL,
    name TEXT NOT NULL,
    thc NUMERIC(4,1),
    cbd NUMERIC(4,1),
    kind TEXT,
    availability TEXT,
    source TEXT NOT NULL,
    run_id TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE UNIQUE INDEX IF NOT EXISTS market_catalog_uq ON market_catalog (lower(producer), lower(name))`;
  // Postać produktu (susz / olej / pen)
  await q`ALTER TABLE strains ADD COLUMN IF NOT EXISTS form TEXT NOT NULL DEFAULT 'susz'`;
  await q`ALTER TABLE market_catalog ADD COLUMN IF NOT EXISTS form TEXT NOT NULL DEFAULT 'susz'`;

  await q`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 0`;
  // Kto dodał wspólne zdjęcie odmiany (może je podmienić lub usunąć); NULL = zdjęcie sprzed tej kolumny
  await q`ALTER TABLE strain_photos ADD COLUMN IF NOT EXISTS uploaded_by INT REFERENCES users(id) ON DELETE SET NULL`;
  // zdjęcia w prywatnym Vercel Blob: ścieżka obiektu (wtedy data = ''), NULL = base64 w kolumnie data
  await q`ALTER TABLE strain_photos ADD COLUMN IF NOT EXISTS blob_path TEXT`;
  // atrybucja zdjęć z wolnych licencji (import z manifestu data/zdjecia.json); NULL = zdjęcie dodane przez użytkownika
  await q`ALTER TABLE strain_photos ADD COLUMN IF NOT EXISTS credit TEXT`;
  await q`ALTER TABLE strain_photos ADD COLUMN IF NOT EXISTS license TEXT`;
  await q`ALTER TABLE strain_photos ADD COLUMN IF NOT EXISTS license_url TEXT`;
  await q`ALTER TABLE strain_photos ADD COLUMN IF NOT EXISTS source_url TEXT`;
  await q`ALTER TABLE strain_tests ADD COLUMN IF NOT EXISTS blob_path TEXT`;
  // Etap 7: dziennik zużycia
  await q`CREATE TABLE IF NOT EXISTS usage_log (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strain_id INT NOT NULL REFERENCES strains(id) ON DELETE CASCADE,
    grams NUMERIC(8,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE INDEX IF NOT EXISTS usage_log_user_idx ON usage_log (user_id, created_at)`;
  // POM-02: idempotencja szybkich zapisów (request_id z klienta, unikalny dla osoby; NULL = starszy klient, bez
  // ograniczenia) i „Cofnij”: o ile faktycznie zmieniono stan / pulę, żeby cofnięcie oddało dokładnie tyle
  // (NULL = wpis sprzed tej zmiany, nie do cofnięcia)
  await q`ALTER TABLE usage_log ADD COLUMN IF NOT EXISTS request_id TEXT`;
  await q`ALTER TABLE usage_log ADD COLUMN IF NOT EXISTS stock_delta NUMERIC(8,2)`;
  await q`CREATE UNIQUE INDEX IF NOT EXISTS usage_log_request_uq ON usage_log (user_id, request_id)`;
  // POM-03: sposób i pora przyjęcia (opcjonalne; NULL = nie podano, pora wtedy wynika z godziny zapisu przez usage_period)
  await q`ALTER TABLE usage_log ADD COLUMN IF NOT EXISTS method TEXT`;
  await q`ALTER TABLE usage_log ADD COLUMN IF NOT EXISTS period TEXT`;
  // rano 5-10, w ciągu dnia 11-16, wieczorem 17-21, w nocy 22-4 (czas polski)
  await q`CREATE OR REPLACE FUNCTION usage_period(p_period TEXT, p_at TIMESTAMPTZ) RETURNS TEXT AS $$
    SELECT COALESCE(p_period, CASE
      WHEN EXTRACT(HOUR FROM p_at AT TIME ZONE 'Europe/Warsaw') BETWEEN 5 AND 10 THEN 'morning'
      WHEN EXTRACT(HOUR FROM p_at AT TIME ZONE 'Europe/Warsaw') BETWEEN 11 AND 16 THEN 'day'
      WHEN EXTRACT(HOUR FROM p_at AT TIME ZONE 'Europe/Warsaw') BETWEEN 17 AND 21 THEN 'evening'
      ELSE 'night' END)
  $$ LANGUAGE SQL STABLE`;
  await q`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS request_id TEXT`;
  await q`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pool_delta NUMERIC(8,2)`;
  await q`CREATE UNIQUE INDEX IF NOT EXISTS purchases_request_uq ON purchases (user_id, request_id)`;

  for (const v of DEFAULT_PRODUCERS) {
    await q`INSERT INTO options (kind, value) VALUES ('producer', ${v}) ON CONFLICT DO NOTHING`;
  }
  for (const v of DEFAULT_TYPES) {
    await q`INSERT INTO options (kind, value) VALUES ('type', ${v}) ON CONFLICT DO NOTHING`;
  }

  for (const v of DEFAULT_TERPENES) {
    await q`INSERT INTO options (kind, value) VALUES ('terpene', ${v}) ON CONFLICT DO NOTHING`;
  }

  // Historia zmian pól wspólnych odmiany (changes: {pole: [stara, nowa]}, tylko zmienione pola)
  await q`CREATE TABLE IF NOT EXISTS strain_edits (
    id SERIAL PRIMARY KEY,
    strain_id INT NOT NULL REFERENCES strains(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT now(),
    changes JSONB NOT NULL
  )`;
  await q`CREATE INDEX IF NOT EXISTS strain_edits_strain_idx ON strain_edits (strain_id, at DESC, id DESC)`;
  // Autor zmiany spoza kont (np. import z katalogu Zielnika); gdy ustawiony, historia pokazuje go zamiast użytkownika
  await q`ALTER TABLE strain_edits ADD COLUMN IF NOT EXISTS actor TEXT`;

  // PAC-3: przypomnienia push. kind: 'webpush' (PWA), 'fcm' (aplikacja natywna), później 'apns';
  // keys: dla webpush { p256dh, auth }, dla natywnych np. { token }
  await q`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'webpush',
    endpoint TEXT NOT NULL UNIQUE,
    keys JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_ok_at TIMESTAMPTZ,
    fails INT NOT NULL DEFAULT 0
  )`;
  await q`CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id)`;
  // notify_hour: godzina wysyłki w czasie polskim; show_details: treść z liczbami na ekranie blokady
  await q`CREATE TABLE IF NOT EXISTS push_prefs (
    user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notify_prescription BOOLEAN NOT NULL DEFAULT TRUE,
    notify_stock BOOLEAN NOT NULL DEFAULT TRUE,
    stock_days INT NOT NULL DEFAULT 5,
    notify_hour INT NOT NULL DEFAULT 9,
    show_details BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  // co i kiedy wysłano (key np. 'rx:12', 'stock'), żeby to samo przypomnienie nie przyszło dwa razy tego samego dnia
  await q`CREATE TABLE IF NOT EXISTS push_sent (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    sent_on DATE NOT NULL,
    PRIMARY KEY (user_id, key, sent_on)
  )`;

  // Jednostki (lib/units.js): susz w gramach, olej i pen w mililitrach; kolumny `grams` przechowują ilość w jednostce odmiany.
  // strain_unit: zakup bez odmiany (usuniętej) liczymy jako gramy.
  await q`CREATE OR REPLACE FUNCTION form_unit(p_form TEXT) RETURNS TEXT AS $$
    SELECT CASE WHEN p_form IN ('olej', 'pen') THEN 'ml' ELSE 'g' END
  $$ LANGUAGE SQL IMMUTABLE`;
  await q`CREATE OR REPLACE FUNCTION strain_unit(p_strain INT) RETURNS TEXT AS $$
    SELECT COALESCE((SELECT form_unit(form) FROM strains WHERE id = p_strain), 'g')
  $$ LANGUAGE SQL STABLE`;
  // Pula „do wykupienia” łączy tylko odmiany tej samej postaci (gramy suszu nie mieszają się z ml oleju).
  // Klucz suszu i odmian bez THC się nie zmienia; olej i pen dostają przyrostek postaci. Wersja 4-argumentowa zostaje
  // dla kodu sprzed tej zmiany (podglądy na wspólnej bazie). Przy pierwszym utworzeniu kopiujemy (bez usuwania) wartości
  // ze starych kluczy olejów i penów pod nowe.
  const hadPool5 = (await q`SELECT to_regprocedure('pool_key(integer,text,numeric,numeric,text)') AS f`)[0].f;
  await q`CREATE OR REPLACE FUNCTION pool_key(p_id INT, p_producer TEXT, p_thc NUMERIC, p_cbd NUMERIC, p_form TEXT) RETURNS TEXT AS $$
    SELECT CASE WHEN p_thc IS NULL OR COALESCE(p_form, 'susz') = 'susz' THEN pool_key(p_id, p_producer, p_thc, p_cbd)
                ELSE pool_key(p_id, p_producer, p_thc, p_cbd) || '|' || p_form END
  $$ LANGUAGE SQL IMMUTABLE`;
  if (!hadPool5) {
    await q`INSERT INTO user_pool (user_id, pool_key, remaining_to_buy)
            SELECT up.user_id, pool_key(s.id, s.producer, s.thc, s.cbd, s.form), up.remaining_to_buy
            FROM user_pool up JOIN strains s ON up.pool_key = pool_key(s.id, s.producer, s.thc, s.cbd)
            WHERE s.form <> 'susz' AND s.thc IS NOT NULL
            ON CONFLICT DO NOTHING`;
  }
  // Recepta na gramy (susz) albo mililitry (olej, pen); wykup liczony tylko z zakupów tej samej jednostki
  await q`ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'g'`;

  // Konto admina "Bocian"
  const [existing] = await q`SELECT id, password_hash, must_change_password FROM users WHERE lower(username) = 'bocian'`;
  await syncAdmin(q, existing);
}
