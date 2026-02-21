package com.moodfood.app;

import android.os.Bundle;
import android.view.View;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Ensure status bar doesn't overlap with app content
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}
