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

  for (const v of DEFAULT_PRODUCERS) {
    await q`INSERT INTO options (kind, value) VALUES ('producer', ${v}) ON CONFLICT DO NOTHING`;
  }
  for (const v of DEFAULT_TYPES) {
    await q`INSERT INTO options (kind, value) VALUES ('type', ${v}) ON CONFLICT DO NOTHING`;
  }

  // Konto admina "Bocian"
  const existing = await q`SELECT id FROM users WHERE lower(username) = 'bocian'`;
  if (existing.length === 0) {
    const pwd = process.env.BOCIAN_INITIAL_PASSWORD;
    if (!pwd || pwd.length < 8) {
      throw new Error('Ustaw BOCIAN_INITIAL_PASSWORD (min. 8 znaków), aby utworzyć konto admina.');
    }
    const hash = await bcrypt.hash(pwd, 10);
    await q`INSERT INTO users (username, password_hash, is_admin, must_change_password)
            VALUES ('Bocian', ${hash}, TRUE, TRUE) ON CONFLICT DO NOTHING`;
  }
}
