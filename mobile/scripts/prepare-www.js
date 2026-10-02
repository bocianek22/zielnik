// Zapisuje adres serwera do www/config.js, żeby lokalna strona błędu umiała wrócić do aplikacji.
// Uruchamiany przed `cap sync` (npm run sync*); adres pochodzi z capacitor.config.js (ZIELNIK_URL).
const fs = require('fs');
const path = require('path');
const config = require('../capacitor.config.js');

const out = path.join(__dirname, '..', 'www', 'config.js');
fs.writeFileSync(out, `window.ZIELNIK_URL = ${JSON.stringify(config.server.url + '/')};\n`);
console.log(`Zielnik: aplikacja będzie ładować ${config.server.url} (zmienna ZIELNIK_URL)`);
