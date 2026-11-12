#!/usr/bin/env bash
# Tune the generated Capacitor Android project: landscape, fullscreen, screen always on.
set -euo pipefail
cd "$(dirname "$0")/../android/app/src/main"
grep -q screenOrientation AndroidManifest.xml || \
  sed -i 's|android:name=".MainActivity"|android:name=".MainActivity"\n            android:screenOrientation="sensorLandscape"|' AndroidManifest.xml
grep -q windowFullscreen res/values/styles.xml || \
  sed -i 's|<item name="windowNoTitle">true</item>|<item name="windowNoTitle">true</item>\n        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>|' res/values/styles.xml
MAIN=$(find java -name MainActivity.java)
grep -q FLAG_KEEP_SCREEN_ON "$MAIN" || cat > "$MAIN" <<JAVA
package com.deni95.darkthicket;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    private void hideBars() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
JAVA
echo "Android project patched."
