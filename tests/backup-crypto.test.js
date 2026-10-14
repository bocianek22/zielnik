// Kopia zaszyfrowana hasłem (POM-57, lib/backup-crypto.js): odszyfrowanie dobrym hasłem, odrzucenie złego hasła,
// uszkodzonego pliku i obcego formatu, krótkie hasło, brak jawnej treści w pliku, losowa sól i IV.
import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptBackup, decryptBackup, isEncryptedBackup, PASSWORD_MIN } from '../lib/backup-crypto.js';

const plain = JSON.stringify({ exportedAt: '2026-10-14', symptoms: [{ day: '2026-10-01', note: 'Ból głowy – „notatka”' }] });

test('kopia szyfrowana: dobre hasło odtwarza dokładnie ten sam tekst, plik nie zawiera jawnej treści', async () => {
  const file = await encryptBackup(plain, 'hasło-testowe-123');
  assert.ok(!file.includes('notatka') && !file.includes('symptoms'));
  const d = JSON.parse(file);
  assert.ok(isEncryptedBackup(d));
  assert.equal(await decryptBackup(d, 'hasło-testowe-123'), plain);
  const again = JSON.parse(await encryptBackup(plain, 'hasło-testowe-123'));
  assert.notEqual(again.kdf.salt, d.kdf.salt);
  assert.notEqual(again.cipher.iv, d.cipher.iv);
});

test('kopia szyfrowana: złe hasło, zmieniony szyfrogram, obcy format i krótkie hasło dają czytelny błąd', async () => {
  const d = JSON.parse(await encryptBackup(plain, 'dobre-haslo'));
  await assert.rejects(decryptBackup(d, 'zle-haslo!'), /Złe hasło/);
  const bytes = Buffer.from(d.data, 'base64'); bytes[0] ^= 1;
  await assert.rejects(decryptBackup({ ...d, data: bytes.toString('base64') }, 'dobre-haslo'), /Złe hasło albo uszkodzony/);
  await assert.rejects(decryptBackup({ ...d, kdf: { ...d.kdf, iter: 10 } }, 'dobre-haslo'), /Nieznany format/);
  await assert.rejects(decryptBackup({ format: 'inny' }, 'dobre-haslo'), /Nieznany format/);
  await assert.rejects(encryptBackup(plain, 'x'.repeat(PASSWORD_MIN - 1)), /co najmniej/);
  assert.equal(isEncryptedBackup({ symptoms: [] }), false);
});
