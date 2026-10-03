package pl.zielnik.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Wygląd natywny zamiast przeglądarkowego: WebView rysuje własne paski przewijania i poświatę przy
        // przewinięciu poza krawędź - w aplikacji ich nie chcemy (CSS tego nie ukryje).
        WebView webView = getBridge().getWebView();
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        // długie przytrzymanie na linku/obrazie nie otwiera przeglądarkowego menu kontekstowego
        webView.setOnLongClickListener(v -> true);
        webView.setLongClickable(false);
        webView.setHapticFeedbackEnabled(false);
    }

    // Ciasteczko sesji zapisujemy na dysk przy każdym zejściu do tła: system może ubić aplikację bez ostrzeżenia,
    // a WebView zrzuca ciasteczka tylko co jakiś czas (inaczej po ubiciu trzeba by logować się ponownie).
    @Override
    public void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }
}
