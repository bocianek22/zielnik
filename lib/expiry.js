// Informacja o terminie ważności (data w formacie RRRR-MM-DD)
export function expiryInfo(iso) {
  if (!iso) return null;
  const days = Math.ceil((new Date(`${iso}T23:59:59`) - Date.now()) / 864e5);
  return { days, expired: days < 0, soon: days >= 0 && days <= 30 };
}
