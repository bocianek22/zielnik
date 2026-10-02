// Identyfikator z adresu (np. /api/strains/abc, /strains/9999999999): błędny daje 0, które nie pasuje do żadnego
// wiersza (404 zamiast błędu SQL 500). Osobny moduł bez next/server, żeby strony mogły go używać.
export const intId = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : 0; };
