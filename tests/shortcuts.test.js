// Skróty aplikacji Android (POM-12) i tytuł raportu do druku: lib/shortcuts.js oraz zgodność z shortcuts.xml
// i MainActivity.java (Gradle buduje się tylko w CI, więc spójność plików natywnych pilnujemy tutaj).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SHORTCUT_PATHS, SAFE_PATH, shortcutAction, withoutUseParam, reportTitle, NEUTRAL_REPORT_TITLE } from '../lib/shortcuts.js';

const android = (p) => fs.readFileSync(new URL(`../mobile/android/app/src/main/${p}`, import.meta.url), 'utf8');
const xml = android('res/xml/shortcuts.xml');
const java = android('java/pl/zielnik/app/MainActivity.java');

test('shortcutAction: zużycie, objawy, brak akcji', () => {
  assert.equal(shortcutAction('?zuzylem=1', ''), 'use');
  assert.equal(shortcutAction('?a=2&zuzylem=1', '#objawy'), 'use');
  assert.equal(shortcutAction('', '#objawy'), 'symptoms');
  assert.equal(shortcutAction('?zuzylem=0', ''), null);
  assert.equal(shortcutAction('?new=1', '#inne'), null);
  assert.equal(shortcutAction(), null);
});

test('ścieżki skrótów prowadzą do właściwych akcji', () => {
  const u = new URL(SHORTCUT_PATHS.use, 'https://x.pl');
  assert.equal(shortcutAction(u.search, u.hash), 'use');
  const s = new URL(SHORTCUT_PATHS.symptoms, 'https://x.pl');
  assert.equal(s.pathname, '/');
  assert.equal(shortcutAction(s.search, s.hash), 'symptoms');
});

test('withoutUseParam: usuwa tylko zuzylem, zostawia resztę i kotwicę', () => {
  assert.equal(withoutUseParam('/', '?zuzylem=1', ''), '/');
  assert.equal(withoutUseParam('/', '?zuzylem=1&q=abc', '#objawy'), '/?q=abc#objawy');
  assert.equal(withoutUseParam('/', '', ''), '/');
});

test('SAFE_PATH: tylko ścieżki w obrębie aplikacji', () => {
  for (const p of Object.values(SHORTCUT_PATHS)) assert.match(p, SAFE_PATH);
  for (const bad of ['//zly.pl/x', 'https://zly.pl', 'raport', '/a b', '/\\zly.pl', '/x"y', '']) assert.doesNotMatch(bad, SAFE_PATH);
});

test('shortcuts.xml: każdy skrót ma akcję, etykiety z zasobów i znaną ścieżkę', () => {
  const shortcuts = xml.match(/<shortcut\b[\s\S]*?<\/shortcut>/g) || [];
  assert.equal(shortcuts.length, 3);
  const paths = shortcuts.map((s) => {
    assert.match(s, /android:shortcutShortLabel="@string\/\w+"/);
    assert.match(s, /android:shortcutLongLabel="@string\/\w+"/);
    assert.match(s, /<intent[\s\S]*?android:action="[^"]+"/);
    const m = s.match(/<extra android:name="pl\.zielnik\.app\.PATH" android:value="([^"]+)"/);
    assert.ok(m, 'skrót bez ścieżki');
    assert.match(m[1], SAFE_PATH);
    return m[1];
  });
  assert.deepEqual(paths.sort(), Object.values(SHORTCUT_PATHS).sort());
  assert.doesNotMatch(xml, /&(?!amp;|lt;|gt;|quot;|apos;)/, 'surowy & w XML');
});

test('pliki natywne: komentarze XML bez „--”, ta sama nazwa dodatku i reguła ścieżki co w JS', () => {
  for (const p of ['res/xml/shortcuts.xml', 'res/values/strings.xml', 'AndroidManifest.xml']) {
    for (const c of android(p).match(/<!--([\s\S]*?)-->/g) || []) assert.doesNotMatch(c.slice(4, -3), /--/, `${p}: „--” w komentarzu`);
  }
  assert.match(java, /EXTRA_PATH = "pl\.zielnik\.app\.PATH"/);
  const re = java.match(/SAFE_PATH = Pattern\.compile\("(.*)"\);/);
  assert.ok(re, 'brak SAFE_PATH w MainActivity.java');
  assert.equal(re[1].replace(/\\\\/g, '\\'), SAFE_PATH.source.replace(/\\\//g, '/')); // w JS ukośnik jest escapowany
  assert.match(android('AndroidManifest.xml'), /android:name="android\.app\.shortcuts" android:resource="@xml\/shortcuts"/);
});

test('widżet (POM-13): ścieżki w StockWidget.java są bezpieczne i zgodne ze skrótem „Zapisz”', () => {
  const widget = android('java/pl/zielnik/app/StockWidget.java');
  const use = widget.match(/PATH_USE = "([^"]+)"/)?.[1];
  const home = widget.match(/PATH_HOME = "([^"]+)"/)?.[1];
  assert.equal(use, SHORTCUT_PATHS.use);
  assert.equal(home, '/');
  for (const p of [use, home]) assert.match(p, SAFE_PATH);
  assert.match(widget, /putExtra\(MainActivity\.EXTRA_PATH, path\)/);
  const u = new URL(use, 'https://x.pl');
  assert.equal(shortcutAction(u.search, u.hash), 'use');
});

test('reportTitle: opis okresu albo neutralna nazwa w trybie dyskretnym', () => {
  assert.equal(reportTitle('2026-09-01', '2026-09-30'), 'Raport dla lekarza 2026-09-01 – 2026-09-30');
  assert.equal(reportTitle('2026-09-01', '2026-09-30', true), NEUTRAL_REPORT_TITLE);
  assert.equal(NEUTRAL_REPORT_TITLE, 'Raport');
});
