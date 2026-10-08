package pl.zielnik.app;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Czyste funkcje widżetu „Zapas i Zużyłem” (bez Androida, żeby dało się je testować JUnitem): odliczanie dni do
 * końca zapasu z daty „RRRR-MM-DD” zapisanej przez stronę (lib/widget.js) i wiek danych. Bez java.time (minSdk 24).
 */
final class WidgetDays {

    // Dane starsze niż tyle widżet pokazuje jako „–”
    static final long MAX_AGE_MS = 7L * 24 * 60 * 60 * 1000;
    static final long NO_DAYS = -1;
    private static final Pattern DAY = Pattern.compile("^(\\d{4})-(\\d{2})-(\\d{2})$");

    private WidgetDays() {}

    // Dzień od 1970-01-01 dla daty kalendarzowej (miesiąc 1-12); algorytm „days from civil” (Howard Hinnant)
    static long epochDay(int year, int month, int day) {
        long y = month <= 2 ? year - 1 : year;
        long era = (y >= 0 ? y : y - 399) / 400;
        long yoe = y - era * 400;
        long doy = (153L * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1;
        long doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        return era * 146097 + doe - 719468;
    }

    private static int daysInMonth(int y, int m) {
        if (m == 2) return (y % 4 == 0 && (y % 100 != 0 || y % 400 == 0)) ? 29 : 28;
        return (m == 4 || m == 6 || m == 9 || m == 11) ? 30 : 31;
    }

    // „RRRR-MM-DD” na dzień od 1970-01-01; null przy złym formacie albo nieistniejącej dacie
    static Long parseDay(String s) {
        if (s == null) return null;
        Matcher m = DAY.matcher(s);
        if (!m.matches()) return null;
        int y = Integer.parseInt(m.group(1)), mo = Integer.parseInt(m.group(2)), d = Integer.parseInt(m.group(3));
        if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
        return epochDay(y, mo, d);
    }

    // Ile dni zostało do daty końca zapasu (0 = dziś albo już po terminie); NO_DAYS, gdy daty nie ma albo jest zła
    static long daysLeft(String until, long todayEpochDay) {
        Long end = parseDay(until);
        if (end == null) return NO_DAYS;
        return Math.max(end - todayEpochDay, 0);
    }

    // Dane zbyt stare, bez znacznika czasu albo z przyszłości (cofnięty zegar): widżet pokazuje „–”
    static boolean stale(long updatedAtMs, long nowMs) {
        return updatedAtMs <= 0 || nowMs < updatedAtMs || nowMs - updatedAtMs > MAX_AGE_MS;
    }
}
