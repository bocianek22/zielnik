// Przepisanie istniejących notatek na szyfrogramy (POM-28, docs/SZYFROWANIE-NOTATEK.md): szyfrowanie jawnych wierszy,
// rotacja wierszy ze starym kluczem (kid) i wycofanie (--decrypt). Ten sam skrypt robi wszystkie trzy.
// Użycie (Node 20+), DATABASE_URL i DATA_ENCRYPTION_KEY w środowisku:
//   node scripts/encrypt-notes.mjs [--dry-run] [--batch=200] [--table=symptom_log] [--decrypt]
// Idempotentny: drugi przebieg nic nie zmienia. Wiersz jest aktualizowany tylko wtedy, gdy kolumna nadal ma starą wartość
// (UPDATE ... WHERE klucz = $ AND kolumna = $stara), więc równoległa edycja w aplikacji nigdy nie jest nadpisana (wiersz
// zostaje do następnego przebiegu). updated_at nie jest zmieniane. Skrypt niczego nie loguje poza liczbami (bez treści notatek).
// Kolejność włączania: ustaw klucz w Vercel i wdróż, dopiero potem uruchom skrypt. Wycofanie: --decrypt przed wdrożeniem starego kodu.
import { pathToFileURL } from 'node:url';
import { COLUMNS, decryptStrict, encryptField, isEncrypted, kidOf, keyStatus } from '../lib/data-crypto.js';

// typy kolumn klucza głównego (kursor) i kolumna właściciela w AAD
const PK_TYPES = { user_id: 'int', day: 'date', strain_id: 'int', id: 'int' };

// sql: obiekt z metodą query(text, params) -> wiersze (neon() albo pg shim w testach)
export async function run(sql, { dry = false, batch = 200, table = null, decrypt = false } = {}) {
  const ks = keyStatus();
  if (ks.state !== 'ok') throw new Error(ks.state === 'invalid' ? 'DATA_ENCRYPTION_KEY ma zły format.' : 'Brak DATA_ENCRYPTION_KEY.');
  const targets = COLUMNS.filter((c) => !table || c.table === table);
  if (!targets.length) throw new Error(`Nieznana tabela: ${table}. Dozwolone: ${COLUMNS.map((c) => c.table).join(', ')}.`);
  const total = { scanned: 0, changed: 0, skipped: 0, raced: 0, failed: 0, byTable: {} };

  for (const { table: t, col, pk, owner } of targets) {
    const stat = { scanned: 0, changed: 0, skipped: 0, raced: 0, failed: 0 };
    let cursor = null;
    const pkList = pk.join(', ');
    const pkSel = pk.map((k) => `${k}::text AS pk_${k}`).join(', ');
    for (;;) {
      const params = [];
      let where = `${col} <> ''`;
      if (cursor) {
        params.push(...cursor);
        where += ` AND (${pkList}) > (${pk.map((k, i) => `$${i + 1}::${PK_TYPES[k]}`).join(', ')})`;
      }
      params.push(batch);
      const rows = await sql.query(
        `SELECT ${pkSel}, ${owner}::text AS owner, ${col} AS val FROM ${t} WHERE ${where} ORDER BY ${pkList} LIMIT $${params.length}::int`, params);
      if (!rows.length) break;
      for (const r of rows) {
        stat.scanned++;
        const key = pk.map((k) => r[`pk_${k}`]);
        try {
          let next;
          if (decrypt) {
            if (!isEncrypted(r.val)) { stat.skipped++; continue; }
            next = decryptStrict(t, col, r.owner, r.val);
          } else if (!isEncrypted(r.val)) {
            next = encryptField(t, col, r.owner, r.val);
          } else if (kidOf(r.val) !== ks.primary) {
            next = encryptField(t, col, r.owner, decryptStrict(t, col, r.owner, r.val)); // rotacja
          } else { stat.skipped++; continue; }
          if (next === r.val) { stat.skipped++; continue; }
          if (dry) { stat.changed++; continue; }
          const upd = await sql.query(
            `UPDATE ${t} SET ${col} = $${pk.length + 1}::text WHERE ${pk.map((k, i) => `${k} = $${i + 1}::${PK_TYPES[k]}`).join(' AND ')} AND ${col} = $${pk.length + 2}::text RETURNING 1 AS ok`,
            [...key, next, r.val]);
          if (upd.length) stat.changed++; else stat.raced++;
        } catch {
          stat.failed++; // bez treści i bez właściciela
        }
      }
      cursor = pk.map((k) => rows[rows.length - 1][`pk_${k}`]);
      if (rows.length < batch) break;
    }
    total.byTable[t] = stat;
    for (const k of ['scanned', 'changed', 'skipped', 'raced', 'failed']) total[k] += stat[k];
  }
  return total;
}

async function main() {
  const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1] ?? d;
  const opts = {
    dry: process.argv.includes('--dry-run'), decrypt: process.argv.includes('--decrypt'),
    batch: Math.max(1, Number(arg('batch', 200)) || 200), table: arg('table', null),
  };
  if (!process.env.DATABASE_URL) { console.error('Brak DATABASE_URL.'); process.exit(2); }
  const { neon } = await import('@neondatabase/serverless');
  let res;
  try { res = await run(neon(process.env.DATABASE_URL), opts); } catch (e) { console.error(e.message); process.exit(2); }
  const tag = `${opts.dry ? '[dry-run] ' : ''}${opts.decrypt ? 'odszyfrowanie' : 'szyfrowanie/rotacja'}`;
  for (const [t, s] of Object.entries(res.byTable)) console.log(`${t}: sprawdzono ${s.scanned}, zmieniono ${s.changed}, bez zmian ${s.skipped}, wyprzedzone edycją ${s.raced}, błędy ${s.failed}`);
  console.log(`${tag}: sprawdzono ${res.scanned}, zmieniono ${res.changed}, bez zmian ${res.skipped}, wyprzedzone edycją ${res.raced}, błędy ${res.failed}.`);
  if (res.raced) console.log('Część wierszy zmieniono w trakcie przebiegu: uruchom skrypt ponownie.');
  process.exit(res.failed ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
