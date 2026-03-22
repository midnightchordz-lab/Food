package com.moodfood.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_RESULT_CODE = 1001;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Window window = getWindow();
        
        // Enable edge-to-edge for Android 15 compatibility
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        
        // Set status bar color
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#3d6449"));
    }
    
    @Override
    public void onStart() {
        super.onStart();
        
        // Enable WebView debugging for development
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        
        // Get WebView and configure settings
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
            
            // Set custom WebChromeClient for file chooser support
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback,
                                                 FileChooserParams fileChooserParams) {
                    if (filePathCallback != null) {
                        filePathCallback.onReceiveValue(null);
                    }
                    filePathCallback = callback;
                    
                    Intent intent = fileChooserParams.createIntent();
                    try {
                        startActivityForResult(intent, FILE_CHOOSER_RESULT_CODE);
                    } catch (Exception e) {
                        filePathCallback = null;
                        return false;
                    }
                    return true;
                }
            });
        }
    }
    
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_RESULT_CODE) {
            if (filePathCallback == null) {
                super.onActivityResult(requestCode, resultCode, data);
                return;
            }
            
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }
}
