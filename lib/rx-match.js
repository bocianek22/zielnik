// POM-16: recepty pasujące do wykupu (te same zasady co wybór domyślny na serwerze, app/api/strains/[id]/purchase):
// ważne dziś, w jednostce odmiany, z pozostałymi gramami; pierwsza na liście = najbliższa wygaśnięcia.
export function openPrescriptions(list, unit, today) {
  return (list || [])
    .filter((p) => (p.unit === 'ml' ? 'ml' : 'g') === unit && p.issued_on <= today
      && (!p.valid_until || p.valid_until >= today) && p.grams - p.bought > 0)
    .sort((a, b) => (a.valid_until || '9999').localeCompare(b.valid_until || '9999') || a.issued_on.localeCompare(b.issued_on) || a.id - b.id);
}
