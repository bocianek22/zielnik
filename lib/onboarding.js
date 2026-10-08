import { ensureDb, sql } from './db';

// Kreator pierwszego uruchomienia (POM-19). Otwarty tylko dla konta, które go nie zamknęło i nie ma jeszcze żadnej
// odmiany w kolekcji ani recepty. Konto z danymi (też starsze, sprzed kreatora) zamykamy od razu przy pierwszym
// sprawdzeniu, żeby kreator nie wrócił po usunięciu wszystkich wpisów.
export async function onboardingOpen(userId) {
  await ensureDb();
  const uid = Number(userId) || 0;
  const [r] = await sql()`SELECT (u.onboarded_at IS NULL) AS open,
      (EXISTS (SELECT 1 FROM user_strain WHERE user_id = u.id) OR EXISTS (SELECT 1 FROM prescriptions WHERE user_id = u.id)) AS has_data
    FROM users u WHERE u.id = ${uid}::int`;
  if (!r || !r.open) return false;
  if (r.has_data) { await closeOnboarding(uid); return false; }
  return true;
}

// Zamknięcie lub pominięcie kreatora; ponowne wywołanie nie zmienia daty
export async function closeOnboarding(userId) {
  await ensureDb();
  await sql()`UPDATE users SET onboarded_at = COALESCE(onboarded_at, now()) WHERE id = ${Number(userId) || 0}::int`;
}
