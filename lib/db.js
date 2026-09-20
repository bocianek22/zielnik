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
  if (!ready) ready = init().catch((e) => { ready = null; throw e; });
  return ready;
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
            SELECT 1 FROM friendships f1 JOIN friendships f2 ON f1.status = 'accepted' AND f2.status = 'accepted'
            WHERE (CASE WHEN f1.requester = p_viewer THEN f1.addressee WHEN f1.addressee = p_viewer THEN f1.requester END)
                = (CASE WHEN f2.requester = p_owner THEN f2.addressee WHEN f2.addressee = p_owner THEN f2.requester END)))
      ))
  $$ LANGUAGE SQL STABLE`;

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

  // Etap 7: dziennik zużycia
  await q`CREATE TABLE IF NOT EXISTS usage_log (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strain_id INT NOT NULL REFERENCES strains(id) ON DELETE CASCADE,
    grams NUMERIC(8,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE INDEX IF NOT EXISTS usage_log_user_idx ON usage_log (user_id, created_at)`;

  for (const v of DEFAULT_PRODUCERS) {
    await q`INSERT INTO options (kind, value) VALUES ('producer', ${v}) ON CONFLICT DO NOTHING`;
  }
  for (const v of DEFAULT_TYPES) {
    await q`INSERT INTO options (kind, value) VALUES ('type', ${v}) ON CONFLICT DO NOTHING`;
  }

  for (const v of DEFAULT_TERPENES) {
    await q`INSERT INTO options (kind, value) VALUES ('terpene', ${v}) ON CONFLICT DO NOTHING`;
  }

  // Konto admina "Bocian"
  const existing = await q`SELECT id, password_hash, must_change_password FROM users WHERE lower(username) = 'bocian'`;
  const pwd = process.env.BOCIAN_INITIAL_PASSWORD;
  if (existing.length === 0) {
    if (!pwd || pwd.length < 8) {
      throw new Error('Ustaw BOCIAN_INITIAL_PASSWORD (min. 8 znaków), aby utworzyć konto admina.');
    }
    const hash = await bcrypt.hash(pwd, 10);
    await q`INSERT INTO users (username, password_hash, is_admin, must_change_password)
            VALUES ('Bocian', ${hash}, TRUE, TRUE) ON CONFLICT DO NOTHING`;
  } else if (existing[0].must_change_password && pwd && pwd.length >= 8) {
    // Dopóki Bocian nie ustawił własnego hasła, hasło startowe ze zmiennej środowiskowej jest nadrzędne
    if (!(await bcrypt.compare(pwd, existing[0].password_hash))) {
      await q`UPDATE users SET password_hash = ${await bcrypt.hash(pwd, 10)} WHERE id = ${existing[0].id}`;
    }
  }
}
