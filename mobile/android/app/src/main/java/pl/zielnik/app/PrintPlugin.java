package pl.zielnik.app;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Druk bieżącej strony (raport dla lekarza). window.print() w Android WebView nic nie robi, więc strona
 * woła ZielnikPrint.print({ name }) (app/components/native/bridge.js), a my otwieramy systemowe okno druku
 * z „Zapisz jako PDF” i drukarkami. Nazwa to nazwa pliku PDF i zadania druku (w trybie dyskretnym „Raport”).
 */
@CapacitorPlugin(name = "ZielnikPrint")
public class PrintPlugin extends Plugin {

    private static final String DEFAULT_NAME = "Raport";

    @PluginMethod
    public void print(PluginCall call) {
        String name = cleanName(call.getString("name"));
        getBridge().executeOnMainThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                if (pm == null) {
                    call.reject("Ten telefon nie obsługuje drukowania.");
                    return;
                }
                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(name);
                PrintAttributes attrs = new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build();
                pm.print(name, adapter, attrs);
                call.resolve();
            } catch (Exception e) {
                call.reject("Nie udało się otworzyć okna drukowania.", e);
            }
        });
    }

    // Nazwa pliku: bez znaków niedozwolonych w nazwach plików i bez przesadnej długości
    private static String cleanName(String raw) {
        if (raw == null) return DEFAULT_NAME;
        String s = raw.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", " ").trim();
        if (s.length() > 80) s = s.substring(0, 80).trim();
        return s.isEmpty() ? DEFAULT_NAME : s;
    }
}
