// POM-50: poziomy skali „Roku objawów” (app/components/charts/symptom-levels.js): `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { symptomLevel, LEVELS } from '../app/components/charts/symptom-levels.js';

test('symptomLevel: brak wpisu 0, cztery poziomy pokrywają 0–10 bez przerw', () => {
  assert.equal(symptomLevel(null), 0);
  assert.equal(symptomLevel(undefined), 0);
  assert.deepEqual([0, 2, 3, 5, 6, 8, 9, 10].map(symptomLevel), [1, 1, 2, 2, 3, 3, 4, 4]);
  for (const [i, [a, b]] of LEVELS.entries()) { assert.equal(symptomLevel(a), i + 1); assert.equal(symptomLevel(b), i + 1); }
});
