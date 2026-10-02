package pl.zielnik.app;

import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Ciasteczko sesji zapisujemy na dysk przy każdym zejściu do tła: system może ubić aplikację bez ostrzeżenia,
    // a WebView zrzuca ciasteczka tylko co jakiś czas (inaczej po ubiciu trzeba by logować się ponownie).
    @Override
    public void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }
}
