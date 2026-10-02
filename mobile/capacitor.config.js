// Konfiguracja powłoki natywnej Zielnika (Capacitor). Czytana przy `npx cap sync`, który zapisuje ją
// do projektów natywnych: zmiana ZIELNIK_URL wymaga ponownego `cap sync` i zbudowania aplikacji.
const fs = require('fs');
const path = require('path');
const { version } = require('./package.json');

// Adres produkcyjnej aplikacji webowej. Nadpisz przy buildzie: ZIELNIK_URL=https://twoj-adres npx cap sync
const DEFAULT_URL = 'https://zielnik-seven.vercel.app';
const raw = (process.env.ZIELNIK_URL || DEFAULT_URL).trim().replace(/\/+$/, '');
let url;
try { url = new URL(raw); } catch { throw new Error(`ZIELNIK_URL: nieprawidłowy adres „${raw}”`); }
if (url.protocol !== 'https:') throw new Error('ZIELNIK_URL musi zaczynać się od https:// (ciasteczko sesji wymaga HTTPS)');

// Serwer rozpoznaje aplikację po „ZielnikApp/<wersja>” (lib/client.js). „ZielnikPush/fcm” mówi stronie,
// że w tym buildzie jest Firebase: bez google-services.json rejestracja push wywróciłaby aplikację.
const hasFcmAndroid = fs.existsSync(path.join(__dirname, 'android/app/google-services.json'));
const userAgent = (push) => `ZielnikApp/${version}${push ? ' ZielnikPush/fcm' : ''}`;

/** @type {import('@capacitor/cli').CapacitorConfig} */
module.exports = {
  appId: 'pl.zielnik.app', // po publikacji w sklepie nie da się zmienić (to tożsamość aplikacji)
  appName: 'Zielnik',
  webDir: 'www', // lokalnie tylko strona błędu i zapas; właściwa aplikacja ładuje się z server.url
  backgroundColor: '#1d3b27',
  appendUserAgent: userAgent(false),
  server: {
    url: url.origin,
    cleartext: false,
    errorPath: 'error.html',
  },
  android: {
    appendUserAgent: userAgent(hasFcmAndroid),
    allowMixedContent: false,
  },
  ios: {
    // push na iOS wymaga Firebase Messaging w AppDelegate i klucza APNs (następny krok), więc bez flagi
    appendUserAgent: userAgent(false),
    contentInset: 'never',
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000, // górny limit: strona chowa ekran startowy wcześniej (app/components/NativeShell.js)
      launchAutoHide: true,
      backgroundColor: '#1d3b27',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    // jasne ikony na ciemnozielonym pasku (strona rysuje pod paskiem pas w kolorze --hemp-deep)
    SystemBars: { insetsHandling: 'css', style: 'DARK', initialViewportFitValueHint: 'cover' },
    StatusBar: { style: 'DARK', backgroundColor: '#1d3b27', overlaysWebView: false },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};
