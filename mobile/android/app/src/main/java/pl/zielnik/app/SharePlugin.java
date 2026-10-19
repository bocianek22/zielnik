package pl.zielnik.app;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Udostępnianie PDF-a (raport dla lekarza) i kopii danych JSON (shareJson, od APK 0.8.0). WebView nie pobiera plików z blob: i nie ma Web Share z plikami,
 * więc strona generuje PDF lokalnie i woła ZielnikShare.sharePdf({ base64, fileName }) (app/components/native/bridge.js).
 * Plik trafia do cache aplikacji (podkatalog share/, res/xml/file_paths.xml), a systemowe okno „Udostępnij” dostaje
 * tylko tymczasowy adres content:// z prawem odczytu - bez żadnych nowych uprawnień.
 */
@CapacitorPlugin(name = "ZielnikShare")
public class SharePlugin extends Plugin {

    private static final String DIR = "share";
    private static final String DEFAULT_NAME = "raport.pdf";
    private static final String DEFAULT_JSON = "kopia.json";
    private static final int MAX_JSON = 24 * 1024 * 1024; // znaki UTF-16; eksport bez zdjęć to zwykle kilkaset kB
    private static final int MAX_BASE64 = 24 * 1024 * 1024; // ok. 18 MB PDF-a

    // Raport z danymi zdrowotnymi nie zostaje w pamięci podręcznej po zamknięciu aplikacji: sprzątanie przy starcie wtyczki
    @Override
    public void load() {
        File[] old = new File(getContext().getCacheDir(), DIR).listFiles();
        if (old != null) for (File f : old) f.delete();
    }

    @PluginMethod
    public void sharePdf(PluginCall call) {
        String b64 = call.getString("base64");
        if (b64 == null || b64.isEmpty()) {
            call.reject("Brak danych PDF.");
            return;
        }
        if (b64.length() > MAX_BASE64) {
            call.reject("Plik PDF jest zbyt duży.");
            return;
        }
        String name = cleanName(call.getString("fileName"));
        try {
            byte[] data = Base64.decode(b64, Base64.DEFAULT);
            if (data.length < 5 || data[0] != '%' || data[1] != 'P' || data[2] != 'D' || data[3] != 'F') {
                call.reject("To nie jest plik PDF.");
                return;
            }
            Context ctx = getContext();
            File dir = new File(ctx.getCacheDir(), DIR);
            if (!dir.exists() && !dir.mkdirs()) {
                call.reject("Nie udało się przygotować pliku.");
                return;
            }
            // Poprzednie raporty nie zostają w pamięci podręcznej
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) f.delete();
            send(call, dir, name, data, "application/pdf");
        } catch (IllegalArgumentException e) {
            call.reject("Nieprawidłowe dane PDF.", e);
        } catch (Exception e) {
            call.reject("Nie udało się przygotować pliku do udostępnienia.", e);
        }
    }

    // Kopia danych (eksport konta, zwykły albo zaszyfrowany hasłem): tekst JSON, zapis w tym samym katalogu cache
    @PluginMethod
    public void shareJson(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.isEmpty()) {
            call.reject("Brak danych kopii.");
            return;
        }
        if (text.length() > MAX_JSON) {
            call.reject("Kopia jest zbyt duża.");
            return;
        }
        if (text.trim().charAt(0) != '{') {
            call.reject("To nie jest plik kopii.");
            return;
        }
        String name = cleanName(call.getString("fileName"), DEFAULT_JSON, ".json");
        try {
            File dir = new File(getContext().getCacheDir(), DIR);
            if (!dir.exists() && !dir.mkdirs()) {
                call.reject("Nie udało się przygotować pliku.");
                return;
            }
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) f.delete();
            send(call, dir, name, text.getBytes(StandardCharsets.UTF_8), "application/json");
        } catch (Exception e) {
            call.reject("Nie udało się przygotować pliku do udostępnienia.", e);
        }
    }

    // Zapis pliku w cache/share i systemowe okno „Udostępnij” z tymczasowym prawem odczytu
    private void send(PluginCall call, File dir, String name, byte[] data, String mime) throws Exception {
        Context ctx = getContext();
        File file = new File(dir, name);
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(data);
        }
        Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", file);
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType(mime);
        send.putExtra(Intent.EXTRA_STREAM, uri);
        send.setClipData(ClipData.newRawUri(name, uri)); // prawo odczytu dla aplikacji wybranej w oknie udostępniania
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent chooser = Intent.createChooser(send, null);
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startActivity(chooser);
                call.resolve();
            } catch (Exception e) {
                call.reject("Nie udało się otworzyć okna udostępniania.", e);
            }
        });
    }

    // Nazwa pliku: bez znaków niedozwolonych i ścieżek, z właściwym rozszerzeniem
    private static String cleanName(String raw) {
        return cleanName(raw, DEFAULT_NAME, ".pdf");
    }

    private static String cleanName(String raw, String fallback, String ext) {
        if (raw == null) return fallback;
        String s = raw.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", " ").trim();
        if (s.length() > 80) s = s.substring(0, 80).trim();
        if (s.isEmpty() || s.equals(ext)) return fallback;
        return s.toLowerCase(Locale.ROOT).endsWith(ext) ? s : s + ext;
    }
}
