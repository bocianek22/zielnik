// Wpisuje adres serwera (ZIELNIK_URL z capacitor.config.js) do lokalnych stron www/, żeby strona błędu
// umiała wrócić do aplikacji także bez sieci (osobny plik .js nie wczytałby się offline). Uruchamiany przed `cap sync`.
const fs = require('fs');
const path = require('path');
const config = require('../capacitor.config.js');

const url = JSON.stringify(config.server.url + '/');
for (const name of ['index.html', 'error.html']) {
  const file = path.join(__dirname, '..', 'www', name);
  const src = fs.readFileSync(file, 'utf8');
  const re = /<script id="zielnik-url">[^<]*<\/script>/;
  if (!re.test(src)) throw new Error(`www/${name}: brak znacznika <script id="zielnik-url">`);
  fs.writeFileSync(file, src.replace(re, `<script id="zielnik-url">window.ZIELNIK_URL = ${url};</script>`));
}
console.log(`Zielnik: aplikacja będzie ładować ${config.server.url} (zmienna ZIELNIK_URL)`);
