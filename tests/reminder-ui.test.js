// Przełącznik wieczornego przypomnienia: wyłączony bez crona co godzinę, ale konto z włączonym przypomnieniem może je wyłączyć.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOURLY_NEEDED, symptomsSwitchDisabled } from '../lib/reminder-ui.js';

test('bez PUSH_CRON_HOURLY nie da się nowo włączyć przypomnienia', () => {
  assert.equal(symptomsSwitchDisabled({ hourly: false }, { notifySymptoms: false }), true);
  assert.equal(symptomsSwitchDisabled({ hourly: false }, null), true);
});

test('z cronem co godzinę, przed wczytaniem konfiguracji i przy już włączonym przypomnieniu przełącznik działa', () => {
  assert.equal(symptomsSwitchDisabled({ hourly: true }, { notifySymptoms: false }), false);
  assert.equal(symptomsSwitchDisabled(null, { notifySymptoms: false }), false);
  assert.equal(symptomsSwitchDisabled({ hourly: false }, { notifySymptoms: true }), false);
});

test('ekran ustawień używa pomocnika i pokazuje wyjaśnienie', () => {
  const src = readFileSync(new URL('../app/profil/ReminderSettings.js', import.meta.url), 'utf8');
  assert.match(src, /disabled=\{noEvening\}/);
  assert.match(src, /HOURLY_NEEDED/);
  assert.match(HOURLY_NEEDED, /co godzinę/);
});
