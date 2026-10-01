package uz.inha.youthunion;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Draw behind the status and navigation bars on every Android version, not only on 15+ where
        // it is enforced, so the app looks the same everywhere. Capacitor's SystemBars plugin passes
        // the bar sizes to the page as safe-area insets, and the CSS pads for them.
        // After super.onCreate, which swaps the launch theme for the app theme: touching the window
        // any earlier builds it with the launch theme, action bar included.
        EdgeToEdge.enable(this);
    }
}
