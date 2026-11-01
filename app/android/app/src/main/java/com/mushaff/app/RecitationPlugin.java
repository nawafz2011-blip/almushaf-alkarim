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

/** The page tells the app when the recitation plays or stops; while it plays, a foreground service
 *  (with a notification) keeps the app running so the recitation goes on when the user leaves the app. */
@CapacitorPlugin(name = "Recitation")
public class RecitationPlugin extends Plugin {
    static RecitationPlugin instance;

    @Override
    public void load() { instance = this; }

    @PluginMethod
    public void update(PluginCall call) {
        boolean playing = Boolean.TRUE.equals(call.getBoolean("playing", false));
        Intent i = new Intent(getContext(), RecitationService.class);
        if (playing) {
            if (Build.VERSION.SDK_INT >= 33 && getActivity() != null
                && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(getActivity(), new String[] { Manifest.permission.POST_NOTIFICATIONS }, 7001);
            }
            i.putExtra("title", call.getString("title", ""));
            ContextCompat.startForegroundService(getContext(), i);
        } else {
            getContext().stopService(i);
        }
        call.resolve();
    }

    /** the "إيقاف" button in the notification */
    static void pauseFromNotification() {
        if (instance != null) instance.notifyListeners("pause", new JSObject());
    }
}
