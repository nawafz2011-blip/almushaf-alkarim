package com.mushaff.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/** Runs while the recitation plays, so Android does not stop the app when it goes to the background. */
public class RecitationService extends Service {
    static final String CHANNEL = "recitation";
    static final String ACTION_PAUSE = "com.mushaff.app.PAUSE";
    private PowerManager.WakeLock lock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_PAUSE.equals(intent.getAction())) {
            RecitationPlugin.pauseFromNotification();
            stopSelf();
            return START_NOT_STICKY;
        }
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "التلاوة", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        int pf = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent open = PendingIntent.getActivity(this, 0,
            new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), pf);
        PendingIntent pause = PendingIntent.getService(this, 1,
            new Intent(this, RecitationService.class).setAction(ACTION_PAUSE), pf);
        String title = intent != null ? intent.getStringExtra("title") : null;
        Notification n = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle("المصحف الكريم")
            .setContentText(title == null || title.isEmpty() ? "جارٍ تشغيل التلاوة" : title)
            .setContentIntent(open)
            .addAction(android.R.drawable.ic_media_pause, "إيقاف", pause)
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build();
        ServiceCompat.startForeground(this, 1, n,
            Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0);
        if (lock == null) {
            lock = ((PowerManager) getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "mushaf:recitation");
            lock.acquire(6 * 60 * 60 * 1000L);   // at most six hours
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        if (lock != null && lock.isHeld()) lock.release();
        lock = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
