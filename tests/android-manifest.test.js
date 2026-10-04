// Ustawienia bezpieczeństwa aplikacji Android (mobile/android): sprawdzane statycznie, bo w CI nie budujemy APK
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const RES = new URL('../mobile/android/app/src/main/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, RES), 'utf8');
const manifest = read('AndroidManifest.xml');
const cap = fs.readFileSync(new URL('../mobile/capacitor.config.js', import.meta.url), 'utf8');

test('kopia zapasowa wyłączona, także transfer na nowe urządzenie (ciasteczko sesji w danych WebView)', () => {
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
  assert.match(manifest, /android:fullBackupContent="@xml\/backup_rules"/);
  const rules = read('res/xml/data_extraction_rules.xml');
  for (const part of ['cloud-backup', 'device-transfer']) {
    const block = rules.slice(rules.indexOf(`<${part}>`), rules.indexOf(`</${part}>`));
    for (const d of ['root', 'file', 'database', 'sharedpref']) assert.match(block, new RegExp(`exclude domain="${d}" path="\\."`), `${part}: ${d}`);
  }
});

test('ruch tylko HTTPS z systemowymi urzędami certyfikacji', () => {
  assert.match(manifest, /android:networkSecurityConfig="@xml\/network_security_config"/);
  const nsc = read('res/xml/network_security_config.xml');
  assert.match(nsc, /cleartextTrafficPermitted="false"/);
  assert.match(nsc, /<certificates src="system" \/>/);
  assert.ok(!/src="user"/.test(nsc));
  assert.match(cap, /cleartext: false/);
  assert.match(cap, /allowMixedContent: false/);
  assert.ok(!/webContentsDebuggingEnabled:\s*true/.test(cap), 'debugowanie WebView tylko w buildzie debug (domyślne Capacitor)');
});

test('dostawca plików nieeksportowany; aktywność przyjmuje tylko bezpieczne ścieżki skrótów', () => {
  assert.match(manifest, /FileProvider"[\s\S]*?android:exported="false"/);
  const main = read('java/pl/zielnik/app/MainActivity.java');
  assert.match(main, /SAFE_PATH\.matcher\(path\)\.matches\(\)/);
  assert.ok(!/addJavascriptInterface/.test(main));
});
