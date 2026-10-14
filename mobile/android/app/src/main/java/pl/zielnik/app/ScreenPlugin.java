package pl.zielnik.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ochrona ekranu (POM-59): FLAG_SECURE blokuje zrzuty i nagrywanie ekranu oraz zastępuje podgląd w przełączniku
 * aplikacji pustym kadrem. Domyślnie wyłączona (część osób robi zrzuty dla lekarza). Ustawienie w SharedPreferences,
 * żeby MainActivity nałożyła flagę już przy starcie, zanim pojawi się treść (Preferences z Capacitora są czytane
 * dopiero przez stronę, czyli za późno na pierwszy kadr).
 */
@CapacitorPlugin(name = "ZielnikScreen")
public class ScreenPlugin extends Plugin {

    static final String PREFS = "zielnik.screen";
    static final String KEY_SECURE = "secure";

    static boolean isSecure(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_SECURE, false);
    }

    static void apply(Activity activity, boolean on) {
        if (on) activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        else activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
    }

    @PluginMethod
    public void get(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("secure", isSecure(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void set(PluginCall call) {
        Boolean on = call.getBoolean("secure");
        if (on == null) {
            call.reject("Brak ustawienia.");
            return;
        }
        SharedPreferences.Editor ed = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        ed.putBoolean(KEY_SECURE, on);
        ed.commit(); // synchronicznie: ubicie procesu tuż po włączeniu nie może zgubić ustawienia
        getBridge().executeOnMainThread(() -> {
            apply(getActivity(), on);
            JSObject ret = new JSObject();
            ret.put("secure", on);
            call.resolve(ret);
        });
    }
}
