package pl.zielnik.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {

    // Skróty aplikacji (res/xml/shortcuts.xml): ścieżka strony w dodatku intencji, otwierana pod adresem server.url
    static final String EXTRA_PATH = "pl.zielnik.app.PATH";
    // Ta sama reguła co SAFE_PATH w lib/shortcuts.js: tylko ścieżka w obrębie aplikacji (aktywność jest eksportowana,
    // więc dodatek może przysłać dowolna aplikacja)
    private static final Pattern SAFE_PATH = Pattern.compile("^/(?!/)[A-Za-z0-9/_?=&#.-]*$");

    private boolean pageLoaded = false;
    private String pendingPath = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetPlugin.class);
        registerPlugin(SharePlugin.class);
        registerPlugin(PrintPlugin.class); // przed super.onCreate: tam powstaje most z listą wtyczek
        super.onCreate(savedInstanceState);
        // Wygląd natywny zamiast przeglądarkowego: WebView rysuje własne paski przewijania i poświatę przy
        // przewinięciu poza krawędź - w aplikacji ich nie chcemy (CSS tego nie ukryje).
        WebView webView = getBridge().getWebView();
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        // Skrót przy zimnym starcie: most wczytał już stronę startową, a przerwanie tego wczytywania drugim loadUrl
        // mogłoby skończyć się stroną błędu. Ścieżkę skrótu otwieramy więc dopiero po pierwszym wczytaniu strony.
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView view) {
                pageLoaded = true;
                if (pendingPath != null) {
                    String path = pendingPath;
                    pendingPath = null;
                    openPath(path);
                }
            }
        });
    }

    // Wołane także z BridgeActivity.load() przy starcie (z intencją uruchomienia), nie tylko dla działającej aplikacji
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent == null) return;
        setIntent(intent);
        String path = intent.getStringExtra(EXTRA_PATH);
        if (path == null) return;
        intent.removeExtra(EXTRA_PATH); // odtworzenie aktywności nie otwiera skrótu ponownie
        if (!SAFE_PATH.matcher(path).matches()) return;
        if (pageLoaded) openPath(path);
        else pendingPath = path;
    }

    private void openPath(String path) {
        if (getBridge() == null || getBridge().getServerUrl() == null) return;
        Uri server = Uri.parse(getBridge().getServerUrl());
        if (server.getScheme() == null || server.getAuthority() == null) return;
        getBridge().getWebView().loadUrl(server.getScheme() + "://" + server.getAuthority() + path);
    }

    // Ciasteczko sesji zapisujemy na dysk przy każdym zejściu do tła: system może ubić aplikację bez ostrzeżenia,
    // a WebView zrzuca ciasteczka tylko co jakiś czas (inaczej po ubiciu trzeba by logować się ponownie).
    @Override
    public void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }
}
