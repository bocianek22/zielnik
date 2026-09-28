// Testy poprawności treści działu Wiedza (bez uruchamiania aplikacji)
import test from 'node:test';
import assert from 'node:assert/strict';
import { ARTICLES, TERPENES } from '../lib/knowledge.js';

test('artykuły wiedzy: unikalne identyfikatory, tytuły i treść', () => {
  const ids = ARTICLES.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const a of ARTICLES) {
    assert.match(a.id, /^[a-z0-9-]+$/);
    assert.ok(a.title && a.title.length > 3, `tytuł: ${a.id}`);
    assert.ok(Array.isArray(a.text) && a.text.length > 0, `treść: ${a.id}`);
    for (const p of a.text) assert.ok(typeof p === 'string' && p.length > 10);
    for (const [term, desc] of a.list || []) assert.ok(term && desc, `lista: ${a.id}`);
  }
});

test('katalog terpenów: komplet pól i unikalne kotwice linków', () => {
  for (const t of TERPENES) assert.ok(t.name && t.aroma && t.found && t.known, `terpen: ${t.name}`);
  const anchors = TERPENES.map((t) => t.name.toLowerCase().split(' ')[0]);
  assert.equal(new Set(anchors).size, anchors.length);
});
