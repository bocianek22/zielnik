// Lokalne rozpakowanie/odszyfrowanie kopii pobranej z panelu admina lub z Vercel Blob.
// Użycie (Node 20+):
//   BACKUP_ENCRYPTION_KEY=<base64> node --experimental-default-type=module scripts/backup-decrypt.js kopia.json.gz.enc [wyjście.json]
// Plik niezaszyfrowany (.json.gz) też zadziała (klucz niepotrzebny). Bez drugiego argumentu zapis na stdout.
// Opcja --data-key dodatkowo odszyfrowuje notatki w bazie (POM-28) kluczem z DATA_ENCRYPTION_KEY (kid:base64, jak w Vercel);
// bez niej w pliku zostają szyfrogramy zenc1:... (reszta kopii jest czytelna).
import fs from 'node:fs';
import { unpackBackup } from '../lib/backup-pack.js';
import { decryptBackupData, keyStatus } from '../lib/data-crypto.js';

const args = process.argv.slice(2);
const withDataKey = args.includes('--data-key');
const [inFile, outFile] = args.filter((a) => a !== '--data-key');
if (!inFile) {
  console.error('Użycie: BACKUP_ENCRYPTION_KEY=<base64> [DATA_ENCRYPTION_KEY=<kid:base64,...>] node --experimental-default-type=module scripts/backup-decrypt.js [--data-key] plik.json.gz[.enc] [wyjście.json]');
  process.exit(2);
}
try {
  let json = unpackBackup(fs.readFileSync(inFile), process.env.BACKUP_ENCRYPTION_KEY);
  if (withDataKey) {
    if (keyStatus().state !== 'ok') throw new Error('--data-key wymaga poprawnego DATA_ENCRYPTION_KEY w środowisku.');
    const data = JSON.parse(json);
    const r = decryptBackupData(data);
    console.error(`Notatki: odszyfrowano ${r.decrypted}, nieodczytane ${r.failed}.`);
    json = JSON.stringify(data);
  }
  if (outFile) fs.writeFileSync(outFile, json);
  else process.stdout.write(json);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
