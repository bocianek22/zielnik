// Para kluczy VAPID do powiadomień push (PAC-3): node scripts/vapid-keys.js
// Wynik wklej w Vercel (Settings → Environment Variables). Klucz prywatny trzymaj w tajemnicy;
// jego zmiana unieważnia wszystkie subskrypcje (użytkownicy muszą ponownie włączyć powiadomienia).
const webpush = require('web-push');

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:twoj-adres@example.com');
