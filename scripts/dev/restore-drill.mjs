// Próba odtworzenia kopii zapasowej (docs/ARCHITEKTURA.md, „Próba odtworzenia”): kopia z lib/backup.js bazy źródłowej
// (np. z danymi z seed.mjs) jest wczytywana do drugiej, świeżej bazy, a liczby wierszy wszystkich tabel kopii są porównywane.
// Użycie: node --experimental-default-type=module scripts/dev/restore-drill.mjs <baza_zrodlowa> <baza_docelowa>
// Baza docelowa jest USUWANA i tworzona od nowa. Lokalny PostgreSQL jak w seed.mjs (PG_ADMIN_URL, domyślnie z:z@localhost).
// restoreBackup() jest też używane przez tests/db/restore-drill.test.js. To narzędzie do prób, nie do produkcji:
// czyści tabele kopii w bazie docelowej (TRUNCATE).
import { register } from 'node:module';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';

// Kolejność wstawiania: rodzic przed dzieckiem wg kluczy obcych (bez session_replication_role, który wymaga superużytkownika).
function insertOrder(tables, fks) {
  const left = new Set(tables), out = [];
  while (left.size) {
    const next = [...left].find((t) => fks.every((f) => f.child !== t || f.parent === t || !left.has(f.parent)));
    if (!next) throw new Error(`Cykl kluczy obcych: ${[...left].join(', ')}`);
    left.delete(next); out.push(next);
  }
  return out;
}

// Wczytuje obiekt kopii { createdAt, <tabela>: [wiersze] } do bazy z gotowym schematem (ensureDb). Zwraca liczby wierszy.
// Wycięte z kopii hasła (users.password_hash) dostają skrót losowego hasła i must_change_password = TRUE: konta nie da się
// zalogować, a pierwszy start aplikacji (ensureDb/syncAdmin) przywraca adminowi BOCIAN_INITIAL_PASSWORD, bo robi to tylko
// przy wymuszonej zmianie hasła. Admin loguje się hasłem startowym i resetuje pozostałe konta.
export async function restoreBackup(pool, data) {
  const tables = Object.keys(data).filter((k) => k !== 'createdAt');
  for (const t of tables) if (!/^[a-z_][a-z0-9_]*$/.test(t)) throw new Error(`Nieobsługiwana nazwa tabeli: ${t}`);
  const unusable = await bcrypt.hash(randomBytes(24).toString('hex'), 4);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const fks = (await c.query(`SELECT conrelid::regclass::text AS child, confrelid::regclass::text AS parent FROM pg_constraint WHERE contype = 'f'`)).rows;
    await c.query(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
    const counts = {};
    for (const t of insertOrder(tables, fks)) {
      const rows = t === 'users' ? data[t].map((r) => ({ ...r, password_hash: unusable, must_change_password: true })) : data[t];
      counts[t] = rows.length;
      if (!rows.length) continue;
      const cols = (await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND is_generated = 'NEVER' ORDER BY ordinal_position`, [t])).rows
        .map((r) => `"${r.column_name}"`).join(', ');
      await c.query(`INSERT INTO "${t}" (${cols}) SELECT ${cols} FROM jsonb_populate_recordset(NULL::"${t}", $1::jsonb)`, [JSON.stringify(rows)]);
      // liczniki SERIAL za największym przywróconym id (inaczej pierwszy nowy wiersz zderzyłby się z istniejącym)
      for (const { column_name: col } of (await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND pg_get_serial_sequence('"' || $1 || '"', column_name) IS NOT NULL`, [t])).rows) {
        await c.query(`SELECT setval(pg_get_serial_sequence('"${t}"', '${col}'), COALESCE(max("${col}"), 1), max("${col}") IS NOT NULL) FROM "${t}"`);
      }
    }
    await c.query('COMMIT');
    return counts;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

// POM-28: czy każdy szyfrogram notatki w odtworzonej bazie daje się odszyfrować kluczem z DATA_ENCRYPTION_KEY
// (AAD zawiera konto i klucz wiersza, więc to sprawdza też, że identyfikatory przeszły odtworzenie bez zmian).
export async function verifyNotes(pool) {
  const { COLUMNS, decryptStrict } = await import('../../lib/data-crypto.js');
  const out = { checked: 0, failed: 0 };
  for (const { table, col, scopeSql } of COLUMNS) {
    for (const r of (await pool.query(`SELECT ${scopeSql} AS scope, ${col} AS val FROM "${table}" WHERE ${col} LIKE 'zenc1:%'`)).rows) {
      out.checked++;
      try { decryptStrict(table, col, r.scope, r.val); } catch { out.failed++; }
    }
  }
  return out;
}

export async function countRows(pool, tables) {
  const out = {};
  for (const t of tables) out[t] = (await pool.query(`SELECT count(*)::int AS n FROM "${t}"`)).rows[0].n;
  return out;
}

// Tylko przy uruchomieniu z wiersza poleceń (import w teście nie rusza niczego)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  register('../../tests/db/loader.mjs', import.meta.url); // alias @/ i sterownik pg zamiast Neon, jak w testach
  const args = process.argv.slice(2);
  if (args[0] === '--init') {
    // proces pomocniczy: schemat (ensureDb) w bazie z DATABASE_URL
    const { ensureDb } = await import('../../lib/db.js');
    await ensureDb();
    (await import('../../tests/db/neon-shim.mjs')).pool.end();
  } else {
    const [src, dst] = args;
    if (!src || !dst || src === dst || !/^[\w-]+$/.test(src + dst)) { console.error('użycie: restore-drill.mjs <baza_zrodlowa> <baza_docelowa>'); process.exit(2); }
    const admin = process.env.PG_ADMIN_URL || 'postgres://z:z@localhost/postgres';
    const url = (db) => `${admin.slice(0, admin.lastIndexOf('/'))}/${db}`;
    process.env.AUTH_SECRET ||= 'drill-secret-drill-secret-drill-secret-1234';
    process.env.BOCIAN_INITIAL_PASSWORD ||= 'drill-start-1';
    const ap = new pg.Pool({ connectionString: admin });
    await ap.query(`DROP DATABASE IF EXISTS "${dst}"`);
    await ap.query(`CREATE DATABASE "${dst}"`);
    await ap.end();
    // 1) kopia ze źródła istniejącą funkcją z lib/backup.js
    process.env.DATABASE_URL = url(src);
    const { buildBackup } = await import('../../lib/backup.js');
    const backup = await buildBackup();
    (await import('../../tests/db/neon-shim.mjs')).pool.end();
    // 2) świeży schemat w bazie docelowej (osobny proces: sterownik jest związany z jedną bazą)
    const init = spawnSync(process.execPath, ['--experimental-default-type=module', fileURLToPath(import.meta.url), '--init'], { env: { ...process.env, DATABASE_URL: url(dst) }, stdio: 'inherit' });
    if (init.status !== 0) { console.error('Nie udało się utworzyć schematu w bazie docelowej.'); process.exit(1); }
    // 3) odtworzenie i porównanie liczb wierszy
    const sp = new pg.Pool({ connectionString: url(src) }), dp = new pg.Pool({ connectionString: url(dst) });
    const tables = Object.keys(backup).filter((k) => k !== 'createdAt');
    await restoreBackup(dp, backup);
    // pierwszy start aplikacji na odtworzonej bazie (suma schematu zgodna, więc szybka ścieżka z syncAdmin): admin wraca hasłem startowym
    const boot = spawnSync(process.execPath, ['--experimental-default-type=module', fileURLToPath(import.meta.url), '--init'], { env: { ...process.env, DATABASE_URL: url(dst) }, stdio: 'inherit' });
    if (boot.status !== 0) { console.error('Start aplikacji na odtworzonej bazie nie powiódł się.'); process.exit(1); }
    const [adm] = (await dp.query(`SELECT password_hash FROM users WHERE lower(username) = 'bocian'`)).rows;
    const adminBack = !!adm && await bcrypt.compare(process.env.BOCIAN_INITIAL_PASSWORD, adm.password_hash);
    console.log(`${adminBack ? 'OK ' : 'BŁĄD'} admin Bocian loguje się hasłem startowym (BOCIAN_INITIAL_PASSWORD) po odtworzeniu`);
    const [a, b] = [await countRows(sp, tables), await countRows(dp, tables)];
    let bad = adminBack ? 0 : 1, total = 0;
    for (const t of tables) {
      const ok = a[t] === b[t] && backup[t].length === a[t];
      if (!ok) bad++;
      total += a[t];
      console.log(`${ok ? 'OK ' : 'ROZBIEŻNOŚĆ'} ${t.padEnd(22)} źródło ${String(a[t]).padStart(6)}  kopia ${String(backup[t].length).padStart(6)}  odtworzone ${String(b[t]).padStart(6)}`);
    }
    const notes = await verifyNotes(dp);
    if (notes.checked) {
      const keyed = !!process.env.DATA_ENCRYPTION_KEY;
      if (keyed && notes.failed) bad++;
      console.log(!keyed ? `UWAGA zaszyfrowane notatki: ${notes.checked} (brak DATA_ENCRYPTION_KEY, nie sprawdzono; uruchom z kluczem)`
        : `${notes.failed ? 'ROZBIEŻNOŚĆ' : 'OK '} zaszyfrowane notatki: ${notes.checked - notes.failed}/${notes.checked} odszyfrowuje się kluczem`);
    }
    await sp.end(); await dp.end();
    console.log(bad ? `\nNIEPOWODZENIE: ${bad} pozycji z rozbieżnością.` : `\nOK: ${tables.length} tabel, ${total} wierszy zgodnych. Pozostałe konta mają nieużywalne hasła (kopia ich nie zawiera): admin resetuje je w panelu.`);
    process.exit(bad ? 1 : 0);
  }
}
