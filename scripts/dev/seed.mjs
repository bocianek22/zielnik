// Dane testowe do ręcznego sprawdzania wyglądu i działania. Użycie: node scripts/dev/seed.mjs <baza> [--port 4400]
// Serwer musi działać na tej bazie (serve.sh). Konta: ania/ania-haslo-1, bartek/bartek-haslo-1, Bocian/bocian-haslo-1 (admin).
// Skrypt można uruchomić ponownie na tej samej bazie: istniejące konta są logowane, odmiany nie są dublowane.
import pg from 'pg';
import { pngBytes } from '../../tests/db/images.mjs';
import { legalVersion } from '../../lib/legal.js';

const args = process.argv.slice(2);
const pi = args.indexOf('--port');
const PORT = pi >= 0 ? args.splice(pi, 2)[1] : '4400';
const DB = args[0];
if (!DB) { console.error('użycie: node scripts/dev/seed.mjs <baza> [--port 4400]'); process.exit(1); }
const B = `http://localhost:${PORT}`;
const admin = process.env.PG_ADMIN_URL || 'postgres://z:z@localhost/postgres';
const pool = new pg.Pool({ connectionString: `${admin.slice(0, admin.lastIndexOf('/'))}/${DB}` });
const q = async (text, v) => (await pool.query(text, v)).rows;

function client() {
  let cookie = '';
  return async (path, method = 'GET', body) => {
    const r = await fetch(B + path, { method, headers: { 'content-type': 'application/json', cookie, origin: B }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
    const sc = r.headers.getSetCookie?.() || [];
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    const t = await r.text();
    let j; try { j = JSON.parse(t); } catch { j = t.slice(0, 200); }
    return { status: r.status, json: j };
  };
}
const must = (r, what) => { if (r.status >= 400) console.log('BŁĄD', what, r.status, JSON.stringify(r.json)); return r.json; };
const day = (ago) => new Date(Date.now() - ago * 864e5).toISOString().slice(0, 10);

// admin: pierwsze logowanie hasłem startowym, potem zmiana (inaczej konto wymusza zmianę hasła)
const boc = client();
if ((await boc('/api/auth/login', 'POST', { username: 'Bocian', password: 'bocian-haslo-1' })).status >= 400) {
  must(await boc('/api/auth/login', 'POST', { username: 'Bocian', password: process.env.BOCIAN_INITIAL_PASSWORD || 'bocian-start-1' }), 'login Bocian');
  must(await boc('/api/auth/change-password', 'POST', { current: process.env.BOCIAN_INITIAL_PASSWORD || 'bocian-start-1', password: 'bocian-haslo-1' }), 'zmiana hasła Bocian');
  must(await boc('/api/auth/login', 'POST', { username: 'Bocian', password: 'bocian-haslo-1' }), 'login Bocian 2');
}
await q("INSERT INTO invites (code, max_uses) VALUES ('DEV1', 50) ON CONFLICT DO NOTHING");

async function user(username) {
  const c = client(), password = `${username}-haslo-1`;
  const r = await c('/api/auth/register', 'POST', { invite: 'DEV1', username, password, adult: true, consent: true, healthConsent: true });
  if (r.status >= 400) must(await c('/api/auth/login', 'POST', { username, password }), `login ${username}`);
  const [row] = await q('SELECT id FROM users WHERE username = $1', [username]);
  return { c, id: row.id };
}
const ania = await user('ania'), bartek = await user('bartek');
// konta bez zapisanej wersji dokumentów (Bocian z bootstrapu) dostałyby ekran akceptacji i zatrzymały inne testy
await q('UPDATE users SET consent_version = $1, consent_at = COALESCE(consent_at, now()) WHERE consent_version IS NULL', [legalVersion()]);

const SUSZ = [
  { name: 'Lemon Skunk', producer: 'Aurora', type: 'haze', kind: 'sativa', thc: 22, cbd: 0.5, finalRating: 8.5, taste: 'cytrusowy, ziemisty', terpenes: ['Limonen', 'Mircen'], price: 45, batch: 'A2231', description: 'Wyraźnie pobudzająca, dobra na dzień.' },
  { name: 'Pink Kush', producer: 'Canopy Growth', type: 'kush', kind: 'indica', thc: 20, cbd: 0.1, finalRating: 9, taste: 'słodki, kwiatowy', terpenes: ['Mircen', 'Kariofilen', 'Linalol'], price: 52 },
  { name: 'Bediol', producer: 'Tilray', type: 'hybryda', kind: 'hybryda', thc: 6.3, cbd: 8, finalRating: 7, taste: 'łagodny', terpenes: ['Pinen'], price: 38 },
  { name: 'Ghost Train Haze', producer: 'S-Lab', type: 'haze', kind: 'sativa', thc: 27, cbd: 0.2, taste: 'sosnowy', terpenes: ['Terpinolen'] },
];
const OLEJ = { name: 'Extractum Cannabis THC 10', producer: 'Medalchemy', type: 'hybryda', kind: 'hybryda', thc: 10, cbd: 0.5, finalRating: 8, form: 'olej', price: 30, description: 'Olej do podania podjęzykowego.' };

const ids = {};
for (const s of [...SUSZ, OLEJ]) {
  const [ex] = await q('SELECT id FROM strains WHERE name = $1', [s.name]);
  if (ex) { ids[s.name] = ex.id; continue; }
  must(await ania.c('/api/strains', 'POST', s), `odmiana ${s.name}`);
  ids[s.name] = (await q('SELECT id FROM strains WHERE name = $1', [s.name]))[0].id;
}
const [lemon, pink, bediol] = SUSZ.map((s) => ids[s.name]);
const oil = ids[OLEJ.name];

must(await ania.c(`/api/strains/${lemon}/entry`, 'PUT', { rating: 8, current: 6.5, remaining: 10, notes: 'Pomaga rano, bez senności.', visibility: 'friends', price: 45 }), 'wpis lemon');
must(await ania.c(`/api/strains/${pink}/entry`, 'PUT', { rating: 9.5, current: 2, remaining: 0, notes: 'Najlepsza na sen.', visibility: 'friends' }), 'wpis pink');
must(await ania.c(`/api/strains/${bediol}/entry`, 'PUT', { rating: 7, current: 0, remaining: 5 }), 'wpis bediol');
must(await ania.c(`/api/strains/${oil}/entry`, 'PUT', { rating: 8, current: 20, remaining: 10, notes: 'Dobre na noc, 0,5 ml.', visibility: 'friends', price: 30 }), 'wpis olej');
must(await ania.c(`/api/strains/${lemon}/effects`, 'PUT', { effects: { relax: 4, energy: 8, sleep: 2, pain: 6, appetite: 5 } }), 'efekty lemon');
must(await ania.c(`/api/strains/${pink}/effects`, 'PUT', { effects: { relax: 9, energy: 2, sleep: 9, pain: 7, appetite: 7 } }), 'efekty pink');
must(await bartek.c(`/api/strains/${lemon}/entry`, 'PUT', { rating: 7.5, current: 3, notes: 'Trochę za mocna wieczorem.', visibility: 'friends' }), 'wpis bartka');

// zużycie i zakupy z 90 dni (bezpośrednio w bazie, żeby mieć daty wstecz; g dla suszu, ml dla oleju)
await q('DELETE FROM usage_log WHERE user_id = $1', [ania.id]);
await q('DELETE FROM purchases WHERE user_id = $1', [ania.id]);
const rnd = (seed) => { let x = seed; return () => (x = (x * 16807) % 2147483647) / 2147483647; };
const rand = rnd(42);
for (let ago = 89; ago >= 0; ago--) {
  const at = new Date(Date.now() - ago * 864e5 - rand() * 36e5 * 12).toISOString();
  if (rand() < 0.85) await q('INSERT INTO usage_log (user_id, strain_id, grams, created_at) VALUES ($1,$2,$3,$4)', [ania.id, rand() < 0.6 ? lemon : pink, [0.25, 0.3, 0.5][Math.floor(rand() * 3)], at]);
  if (ago % 3 === 0) await q('INSERT INTO usage_log (user_id, strain_id, grams, created_at) VALUES ($1,$2,$3,$4)', [ania.id, oil, [0.25, 0.5][Math.floor(rand() * 2)], at]);
}
for (const [ago, sid, name, g, cost] of [[80, lemon, 'Lemon Skunk', 10, 450], [55, pink, 'Pink Kush', 10, 520], [30, lemon, 'Lemon Skunk', 5, 225], [12, bediol, 'Bediol', 5, 190], [40, oil, OLEJ.name, 10, 300], [5, oil, OLEJ.name, 10, 300]]) {
  await q('INSERT INTO purchases (user_id, strain_id, strain_name, grams, cost, created_at) VALUES ($1,$2,$3,$4,$5,now() - $6 * interval \'1 day\')', [ania.id, sid, name, g, cost, ago]);
}

// recepty w g i ml
for (const [from, to, amount, unit, note] of [[40, -10, 30, 'g', 'dr Nowak'], [20, -8, 30, 'ml', 'olej, dr Nowak'], [100, 70, 20, 'g', 'poprzednia']]) {
  // notatka bywa szyfrowana, więc recepty rozpoznajemy po jawnych polach
  await q("DELETE FROM prescriptions WHERE user_id = $1 AND issued_on = $2::date AND valid_until = $3::date AND grams = $4 AND unit = $5", [ania.id, day(from), day(to), amount, unit]);
  must(await ania.c('/api/prescriptions', 'POST', { issuedOn: day(from), validUntil: day(to), grams: amount, unit, note }), `recepta ${note}`);
}

// objawy z ostatnich 14 dni
for (let i = 13; i >= 0; i--) {
  const t = (13 - i) / 13;
  must(await ania.c('/api/symptoms', 'PUT', { day: day(i), pain: Math.round(7 - 4 * t), sleep: Math.round(4 + 4 * t), anxiety: Math.round(5 - 3 * t), mood: Math.round(4 + 4 * t), note: i === 0 ? 'Lepiej po zmianie odmiany.' : '' }), `objawy ${i}`);
}

// zdjęcie odmiany (najmniejszy PNG)
const [{ n }] = await q('SELECT count(*)::int AS n FROM strain_photos WHERE strain_id = $1', [lemon]);
if (!n) must(await ania.c(`/api/strains/${lemon}/photo`, 'PUT', { image: `data:image/png;base64,${pngBytes('dev').toString('base64')}` }), 'zdjęcie');

// znajomi i profil
const fr = await ania.c('/api/friends', 'POST', { action: 'request', userId: bartek.id });
if (fr.status < 400) must(await bartek.c('/api/friends', 'POST', { action: 'accept', userId: ania.id }), 'akceptacja znajomego');
must(await ania.c('/api/profile', 'PUT', { displayName: 'Ania K.', bio: 'Pacjentka, leczenie bólu przewlekłego.' }), 'profil');

await q('DELETE FROM rate_limits');
await pool.end();
console.log(`gotowe: baza ${DB}, ${B}; konta ania, bartek, Bocian (hasło <login>-haslo-1)`);
