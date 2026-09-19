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
