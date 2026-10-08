package pl.zielnik.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class WidgetDaysTest {

    @Test
    public void epochDay_znaneDaty() {
        assertEquals(0, WidgetDays.epochDay(1970, 1, 1));
        assertEquals(19723, WidgetDays.epochDay(2024, 1, 1));
        assertEquals(20369, WidgetDays.epochDay(2025, 10, 8));
    }

    @Test
    public void parseDay_odrzucaZleDaty() {
        assertNull(WidgetDays.parseDay(null));
        assertNull(WidgetDays.parseDay(""));
        assertNull(WidgetDays.parseDay("2026-02-30"));
        assertNull(WidgetDays.parseDay("2026-13-01"));
        assertNull(WidgetDays.parseDay("2026-1-1"));
        assertEquals(Long.valueOf(WidgetDays.epochDay(2028, 2, 29)), WidgetDays.parseDay("2028-02-29"));
        assertNull(WidgetDays.parseDay("2027-02-29"));
    }

    @Test
    public void daysLeft_odliczaDni() {
        long today = WidgetDays.epochDay(2026, 10, 8);
        assertEquals(5, WidgetDays.daysLeft("2026-10-13", today));
        assertEquals(0, WidgetDays.daysLeft("2026-10-08", today));
        assertEquals(0, WidgetDays.daysLeft("2026-10-01", today));
        assertEquals(84, WidgetDays.daysLeft("2027-12-31", WidgetDays.epochDay(2027, 10, 8)));
        assertEquals(WidgetDays.NO_DAYS, WidgetDays.daysLeft(null, today));
        assertEquals(WidgetDays.NO_DAYS, WidgetDays.daysLeft("zle", today));
    }

    @Test
    public void stale_siedemDni() {
        long now = 10L * 24 * 60 * 60 * 1000;
        assertFalse(WidgetDays.stale(now - WidgetDays.MAX_AGE_MS, now));
        assertTrue(WidgetDays.stale(now - WidgetDays.MAX_AGE_MS - 1, now));
        assertTrue(WidgetDays.stale(0, now));
        assertTrue(WidgetDays.stale(now + 1, now));
    }
}
