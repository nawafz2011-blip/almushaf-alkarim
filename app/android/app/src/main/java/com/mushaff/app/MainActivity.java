package com.mushaff.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(RecitationPlugin.class);   // keeps the recitation playing when the app is in the background
        registerPlugin(SpeechPlugin.class);       // speech recognition for "تابعني" and voice search
        registerPlugin(SharePlugin.class);        // share ayahs as an image or text
        super.onCreate(savedInstanceState);
    }
}
