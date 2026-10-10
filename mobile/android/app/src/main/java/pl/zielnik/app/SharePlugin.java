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

/**
 * Udostępnianie PDF-a (raport dla lekarza). WebView nie pobiera plików z blob: i nie ma Web Share z plikami,
 * więc strona generuje PDF lokalnie i woła ZielnikShare.sharePdf({ base64, fileName }) (app/components/native/bridge.js).
 * Plik trafia do cache aplikacji (podkatalog share/, res/xml/file_paths.xml), a systemowe okno „Udostępnij” dostaje
 * tylko tymczasowy adres content:// z prawem odczytu - bez żadnych nowych uprawnień.
 */
@CapacitorPlugin(name = "ZielnikShare")
public class SharePlugin extends Plugin {

    private static final String DIR = "share";
    private static final String DEFAULT_NAME = "raport.pdf";
    private static final int MAX_BASE64 = 24 * 1024 * 1024; // ok. 18 MB PDF-a

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
            File file = new File(dir, name);
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(data);
            }
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("application/pdf");
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
        } catch (IllegalArgumentException e) {
            call.reject("Nieprawidłowe dane PDF.", e);
        } catch (Exception e) {
            call.reject("Nie udało się przygotować pliku do udostępnienia.", e);
        }
    }

    // Nazwa pliku: bez znaków niedozwolonych i ścieżek, z rozszerzeniem .pdf
    private static String cleanName(String raw) {
        if (raw == null) return DEFAULT_NAME;
        String s = raw.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", " ").trim();
        if (s.length() > 80) s = s.substring(0, 80).trim();
        if (s.isEmpty() || s.equals(".pdf")) return DEFAULT_NAME;
        return s.toLowerCase().endsWith(".pdf") ? s : s + ".pdf";
    }
}
