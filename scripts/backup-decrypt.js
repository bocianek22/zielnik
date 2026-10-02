// Lokalne rozpakowanie/odszyfrowanie kopii pobranej z panelu admina lub z Vercel Blob.
// Użycie (Node 20+):
//   BACKUP_ENCRYPTION_KEY=<base64> node --experimental-default-type=module scripts/backup-decrypt.js kopia.json.gz.enc [wyjście.json]
// Plik niezaszyfrowany (.json.gz) też zadziała (klucz niepotrzebny). Bez drugiego argumentu zapis na stdout.
import fs from 'node:fs';
import { unpackBackup } from '../lib/backup-pack.js';

const [, , inFile, outFile] = process.argv;
if (!inFile) {
  console.error('Użycie: BACKUP_ENCRYPTION_KEY=<base64> node --experimental-default-type=module scripts/backup-decrypt.js plik.json.gz[.enc] [wyjście.json]');
  process.exit(2);
}
try {
  const json = unpackBackup(fs.readFileSync(inFile), process.env.BACKUP_ENCRYPTION_KEY);
  if (outFile) fs.writeFileSync(outFile, json);
  else process.stdout.write(json);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
