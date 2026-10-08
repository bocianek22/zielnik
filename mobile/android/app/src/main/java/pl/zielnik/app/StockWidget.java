package pl.zielnik.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import java.util.Calendar;

/**
 * Widżet ekranu głównego „Zapas i Zużyłem” (POM-13, docs/WIDZET-ANDROID.md): „Starczy na N dni” i przycisk „Zapisz”.
 * Czyta tylko SharedPreferences zapisane przez stronę (WidgetPlugin), bez sieci. Dotknięcia otwierają MainActivity
 * ze ścieżką w EXTRA_PATH: przycisk /?zuzylem=1, reszta widżetu /. Odblokowanie zawsze załatwia NativeLock w stronie.
 */
public class StockWidget extends AppWidgetProvider {

    static final String PREFS = "zielnik_widget";
    static final String KEY_UNTIL = "until";
    static final String KEY_UPDATED_AT = "updatedAt";
    static final String KEY_LOCKED = "locked";
    static final String PATH_USE = "/?zuzylem=1";
    static final String PATH_HOME = "/";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) manager.updateAppWidget(id, build(context, id));
    }

    // Odświeża wszystkie widżety (po zmianie danych ze strony)
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, StockWidget.class));
        for (int id : ids) manager.updateAppWidget(id, build(context, id));
    }

    private static RemoteViews build(Context context, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_stock);
        views.setTextViewText(R.id.widget_value, valueText(context, prefs));
        views.setOnClickPendingIntent(R.id.widget_root, open(context, appWidgetId * 2, PATH_HOME));
        views.setOnClickPendingIntent(R.id.widget_add, open(context, appWidgetId * 2 + 1, PATH_USE));
        return views;
    }

    // Przy włączonej blokadzie bez liczby; bez danych albo ze starymi danymi „–”
    private static String valueText(Context context, SharedPreferences prefs) {
        if (prefs.getBoolean(KEY_LOCKED, false)) return context.getString(R.string.widget_check);
        if (WidgetDays.stale(prefs.getLong(KEY_UPDATED_AT, 0), System.currentTimeMillis())) return context.getString(R.string.widget_none);
        Calendar now = Calendar.getInstance();
        long today = WidgetDays.epochDay(now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1, now.get(Calendar.DAY_OF_MONTH));
        long n = WidgetDays.daysLeft(prefs.getString(KEY_UNTIL, null), today);
        if (n == WidgetDays.NO_DAYS) return context.getString(R.string.widget_none);
        return context.getString(n == 1 ? R.string.widget_days_one : R.string.widget_days_many, n);
    }

    // Jawny MainActivity (nie systemowy wybór), FLAG_IMMUTABLE; osobny requestCode dla każdego dotknięcia
    private static PendingIntent open(Context context, int requestCode, String path) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction("pl.zielnik.app.WIDGET");
        intent.putExtra(MainActivity.EXTRA_PATH, path);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
