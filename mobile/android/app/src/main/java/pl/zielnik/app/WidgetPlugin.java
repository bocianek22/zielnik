package pl.zielnik.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Most strony z widżetem „Zapas i Zużyłem” (docs/WIDZET-ANDROID.md, app/components/native/bridge.js).
 * Strona zapisuje tylko datę końca zapasu (until), znacznik czasu i informację o blokadzie aplikacji; widżet sam
 * odlicza dni. set({ until, locked }): pole nieobecne zostaje bez zmian, until = null usuwa datę. clear(): wylogowanie.
 */
@CapacitorPlugin(name = "ZielnikWidget")
public class WidgetPlugin extends Plugin {

    @PluginMethod
    public void set(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor ed = ctx.getSharedPreferences(StockWidget.PREFS, Context.MODE_PRIVATE).edit();
        if (call.hasOption("until")) {
            String until = call.getString("until");
            if (until == null || until.isEmpty()) {
                ed.remove(StockWidget.KEY_UNTIL).remove(StockWidget.KEY_UPDATED_AT);
            } else if (WidgetDays.parseDay(until) != null) {
                ed.putString(StockWidget.KEY_UNTIL, until).putLong(StockWidget.KEY_UPDATED_AT, System.currentTimeMillis());
            } else {
                call.reject("Zła data.");
                return;
            }
        }
        if (call.hasOption("locked")) {
            ed.putBoolean(StockWidget.KEY_LOCKED, Boolean.TRUE.equals(call.getBoolean("locked")));
        }
        ed.apply();
        StockWidget.refreshAll(ctx);
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        Context ctx = getContext();
        ctx.getSharedPreferences(StockWidget.PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        StockWidget.refreshAll(ctx);
        call.resolve();
    }
}
