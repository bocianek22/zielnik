// Jedna definicja „moja odmiana” (POM-20): utworzona przeze mnie albo z moją oceną, stanem, „do wykupienia” lub notatką.
// Przeglądarka (StrainsBoard) liczy ją tą funkcją, serwer (homeSummary w lib/stats.js) tym samym warunkiem w SQL.
export function isMine(strain, entry, userId) {
  const m = entry || {};
  return strain.created_by === userId || m.rating != null || Number(m.current) > 0 || Number(m.remaining) > 0 || !!m.notes;
}
