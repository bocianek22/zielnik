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

// Widżet „Zapas i Zużyłem” (POM-13, docs/WIDZET-ANDROID.md)
test('widżet: receiver nieeksportowany z APPWIDGET_UPDATE, ekran główny, bez nowych uprawnień', () => {
  const receiver = manifest.match(/<receiver\b[\s\S]*?<\/receiver>/)?.[0] || '';
  assert.match(receiver, /android:name="\.StockWidget"/);
  assert.match(receiver, /android:exported="false"/);
  assert.match(receiver, /android\.appwidget\.action\.APPWIDGET_UPDATE/);
  assert.match(receiver, /android:resource="@xml\/widget_info"/);
  const info = read('res/xml/widget_info.xml');
  assert.match(info, /android:widgetCategory="home_screen"/);
  assert.match(info, /android:updatePeriodMillis="10800000"/);
  assert.match(info, /android:targetCellWidth="2"/);
  assert.match(info, /android:targetCellHeight="1"/);
  // uprawnienia: tylko INTERNET i POWIADOMIENIA (jak przed widżetem)
  const perms = [...manifest.matchAll(/<uses-permission android:name="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(perms, ['android.permission.INTERNET', 'android.permission.POST_NOTIFICATIONS']);
});

test('widżet: zasoby bez słów „konop” i „Zieln” (lista widżetów, tryb dyskretny)', () => {
  const strings = read('res/values/strings.xml');
  const widgetStrings = [...strings.matchAll(/<string name="widget_\w+">([^<]*)<\/string>/g)].map((m) => m[1]);
  assert.ok(widgetStrings.length >= 6);
  const files = ['res/layout/widget_stock.xml', 'res/xml/widget_info.xml', 'res/values/widget_colors.xml', 'res/values-night/widget_colors.xml',
    'res/drawable/widget_bg.xml', 'res/drawable/widget_button_bg.xml'];
  for (const text of [...widgetStrings, ...files.map(read)]) assert.doesNotMatch(text, /konop|zieln/i);
  // receiver też: etykieta idzie z zasobu widget_label
  assert.match(manifest.match(/<receiver\b[\s\S]*?>/)[0], /android:label="@string\/widget_label"/);
});

test('widżet: wtyczka zarejestrowana w MainActivity, intencje jawne z FLAG_IMMUTABLE', () => {
  const main = read('java/pl/zielnik/app/MainActivity.java');
  assert.match(main, /registerPlugin\(WidgetPlugin\.class\)/);
  assert.match(read('java/pl/zielnik/app/WidgetPlugin.java'), /@CapacitorPlugin\(name = "ZielnikWidget"\)/);
  const widget = read('java/pl/zielnik/app/StockWidget.java');
  assert.match(widget, /new Intent\(context, MainActivity\.class\)/);
  assert.match(widget, /FLAG_IMMUTABLE/);
  assert.match(widget, /appWidgetId \* 2, PATH_HOME/);
  assert.match(widget, /appWidgetId \* 2 \+ 1, PATH_USE/);
});

test('dostawca plików nieeksportowany; aktywność przyjmuje tylko bezpieczne ścieżki skrótów', () => {
  assert.match(manifest, /FileProvider"[\s\S]*?android:exported="false"/);
  const main = read('java/pl/zielnik/app/MainActivity.java');
  assert.match(main, /SAFE_PATH\.matcher\(path\)\.matches\(\)/);
  assert.ok(!/addJavascriptInterface/.test(main));
});

// Udostępnianie PDF raportu (SharePlugin + FileProvider): dostęp tylko do podkatalogu cache, bez nowych uprawnień
test('udostępnianie PDF: provider nieeksportowany z grantUriPermissions, ścieżki tylko cache/share, wtyczka zarejestrowana', () => {
  const provider = manifest.match(/<provider\b[\s\S]*?<\/provider>/)?.[0] || '';
  assert.match(provider, /android:name="androidx\.core\.content\.FileProvider"/);
  assert.match(provider, /android:authorities="\$\{applicationId\}\.fileprovider"/);
  assert.match(provider, /android:exported="false"/);
  assert.match(provider, /android:grantUriPermissions="true"/);
  assert.match(provider, /android:resource="@xml\/file_paths"/);
  const paths = read('res/xml/file_paths.xml');
  assert.deepEqual([...paths.matchAll(/<([a-z-]+-path)\b[^>]*path="([^"]*)"/g)].map((m) => [m[1], m[2]]), [['cache-path', 'share/']]);
  const main = read('java/pl/zielnik/app/MainActivity.java');
  assert.match(main, /registerPlugin\(SharePlugin\.class\)/);
  const plugin = read('java/pl/zielnik/app/SharePlugin.java');
  assert.match(plugin, /@CapacitorPlugin\(name = "ZielnikShare"\)/);
  assert.match(plugin, /ACTION_SEND/);
  assert.match(plugin, /"application\/pdf"/);
  assert.match(plugin, /FLAG_GRANT_READ_URI_PERMISSION/);
  assert.ok(!/FLAG_GRANT_WRITE_URI_PERMISSION/.test(plugin));
  const perms = [...manifest.matchAll(/<uses-permission android:name="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(perms, ['android.permission.INTERNET', 'android.permission.POST_NOTIFICATIONS']);
});
