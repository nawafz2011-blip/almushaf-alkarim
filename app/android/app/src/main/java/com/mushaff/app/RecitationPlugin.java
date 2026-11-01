package com.mushaff.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The page reports the recitation (playing / paused / stopped, the ayah, the reciter, the position);
 *  the app shows it as a media player in the notifications and lock screen, and keeps playing in the
 *  background. Its buttons (previous, pause/play, next) are sent back to the page. */
@CapacitorPlugin(name = "Recitation")
public class RecitationPlugin extends Plugin {
    static RecitationPlugin instance;

    @Override
    public void load() { instance = this; }

    @PluginMethod
    public void update(PluginCall call) {
        String state = call.getString("state", "none");
        RecitationService.State s = new RecitationService.State(
            state, call.getString("title", ""), call.getString("artist", ""),
            (long) (call.getDouble("position", 0.0) * 1000), (long) (call.getDouble("duration", 0.0) * 1000));
        if (RecitationService.instance != null) {
            RecitationService.instance.apply(s);
        } else if ("playing".equals(state)) {
            if (Build.VERSION.SDK_INT >= 33 && getActivity() != null
                && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(getActivity(), new String[] { Manifest.permission.POST_NOTIFICATIONS }, 7001);
            }
            RecitationService.pending = s;
            ContextCompat.startForegroundService(getContext(), new Intent(getContext(), RecitationService.class));
        }
        call.resolve();
    }

    /** a button pressed in the notification, on the lock screen or on headphones */
    static void control(String action) {
        if (instance == null) return;
        JSObject d = new JSObject();
        d.put("action", action);
        instance.notifyListeners("control", d);
    }
}
