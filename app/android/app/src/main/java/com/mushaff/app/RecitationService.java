package com.mushaff.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import androidx.media.session.MediaButtonReceiver;
import java.io.InputStream;

/** The recitation as a media player: notification + lock screen controls, and it keeps the app
 *  running while the recitation plays so it goes on when the user leaves the app. */
public class RecitationService extends Service {
    static RecitationService instance;
    static State pending;
    static final String CHANNEL = "recitation";
    static final int ID = 1;

    static class State {
        final String state, title, artist; final long position, duration;
        State(String state, String title, String artist, long position, long duration) {
            this.state = state; this.title = title; this.artist = artist; this.position = position; this.duration = duration;
        }
    }

    private MediaSessionCompat session;
    private PowerManager.WakeLock lock;
    private Bitmap art;
    private boolean foreground;
    private State last;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "التلاوة", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        try (InputStream in = getAssets().open("public/icons/icon-512.png")) { art = BitmapFactory.decodeStream(in); } catch (Exception e) { art = null; }
        session = new MediaSessionCompat(this, "mushaf");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { RecitationPlugin.control("play"); }
            @Override public void onPause() { RecitationPlugin.control("pause"); }
            @Override public void onSkipToNext() { RecitationPlugin.control("next"); }
            @Override public void onSkipToPrevious() { RecitationPlugin.control("prev"); }
            @Override public void onStop() { RecitationPlugin.control("pause"); }
        });
        session.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && Intent.ACTION_MEDIA_BUTTON.equals(intent.getAction())) {
            MediaButtonReceiver.handleIntent(session, intent);
        }
        if (pending != null) { State s = pending; pending = null; apply(s); }
        else if (!foreground) {   // started by a button without a new state: it must show the notification at once
            apply(last != null ? new State("playing", last.title, last.artist, last.position, last.duration) : new State("playing", "", "", 0, 0));
        }
        return START_NOT_STICKY;
    }

    void apply(State s) {
        if ("none".equals(s.state)) { stopEverything(); return; }
        last = s;
        boolean playing = "playing".equals(s.state);
        session.setMetadata(new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, s.title.isEmpty() ? "المصحف الكريم" : s.title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, s.artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "القرآن الكريم")
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, s.duration > 0 ? s.duration : -1)
            .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, art)
            .build());
        session.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE | PlaybackStateCompat.ACTION_PLAY_PAUSE
                | PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS | PlaybackStateCompat.ACTION_STOP)
            .setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED, s.position, playing ? 1f : 0f, SystemClock.elapsedRealtime())
            .build());

        int pf = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent open = PendingIntent.getActivity(this, 0,
            new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), pf);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setLargeIcon(art)
            .setContentTitle(s.title.isEmpty() ? "المصحف الكريم" : s.title)
            .setContentText(s.artist)
            .setContentIntent(open)
            .setDeleteIntent(MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_STOP))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSilent(true)
            .setOngoing(playing)
            .addAction(android.R.drawable.ic_media_previous, "السابقة",
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS))
            .addAction(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, playing ? "إيقاف" : "تشغيل",
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, playing ? PlaybackStateCompat.ACTION_PAUSE : PlaybackStateCompat.ACTION_PLAY))
            .addAction(android.R.drawable.ic_media_next, "التالية",
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_NEXT))
            .setStyle(new MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0, 1, 2));
        Notification n = b.build();

        if (playing) {
            ServiceCompat.startForeground(this, ID, n,
                Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0);
            foreground = true;
            if (lock == null) {
                lock = ((PowerManager) getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "mushaf:recitation");
                lock.acquire(6 * 60 * 60 * 1000L);
            }
        } else {
            // paused: the player stays in the notifications (it can be swiped away), the app may sleep
            if (foreground) { ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_DETACH); foreground = false; }
            try { NotificationManagerCompat.from(this).notify(ID, n); } catch (SecurityException e) { }
            if (lock != null && lock.isHeld()) lock.release();
            lock = null;
        }
    }

    private void stopEverything() {
        if (foreground) { ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE); foreground = false; }
        NotificationManagerCompat.from(this).cancel(ID);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        instance = null;
        if (lock != null && lock.isHeld()) lock.release();
        lock = null;
        if (session != null) { session.setActive(false); session.release(); }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
