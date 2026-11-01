package com.mushaff.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(RecitationPlugin.class);   // keeps the recitation playing when the app is in the background
        super.onCreate(savedInstanceState);
    }
}
