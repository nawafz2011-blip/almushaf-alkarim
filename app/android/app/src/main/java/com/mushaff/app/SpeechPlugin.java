package com.mushaff.app;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

/** Android's own speech recognizer for the page ("تابعني" and voice search): the app's web view has
 *  no speech recognition of its own, so native-speech.js gives the page the same interface over this. */
@CapacitorPlugin(name = "Speech", permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "mic") })
public class SpeechPlugin extends Plugin {
    private SpeechRecognizer sr;
    private final Handler main = new Handler(Looper.getMainLooper());

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("mic") != PermissionState.GRANTED) { requestPermissionForAlias("mic", call, "micAnswer"); return; }
        begin(call);
    }

    @PermissionCallback
    private void micAnswer(PluginCall call) {
        if (getPermissionState("mic") == PermissionState.GRANTED) begin(call);
        else { emit("error", "not-allowed"); call.reject("not-allowed"); }
    }

    private void begin(PluginCall call) {
        final String lang = call.getString("lang", "ar-SA");
        main.post(() -> {
            if (!SpeechRecognizer.isRecognitionAvailable(getContext())) { emit("error", "service-not-allowed"); return; }
            if (sr == null) {
                sr = SpeechRecognizer.createSpeechRecognizer(getContext());
                sr.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle b) { emit("start", null); }
                    @Override public void onBeginningOfSpeech() {}
                    @Override public void onRmsChanged(float v) {}
                    @Override public void onBufferReceived(byte[] b) {}
                    @Override public void onEndOfSpeech() {}
                    @Override public void onError(int e) {
                        // silence or nothing understood is not a problem: the page simply listens again
                        if (e == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) emit("error", "not-allowed");
                        else if (e == SpeechRecognizer.ERROR_NETWORK || e == SpeechRecognizer.ERROR_NETWORK_TIMEOUT) emit("error", "network");
                        emit("end", null);
                    }
                    @Override public void onResults(Bundle b) { text(b, true); emit("end", null); }
                    @Override public void onPartialResults(Bundle b) { text(b, false); }
                    @Override public void onEvent(int t, Bundle b) {}
                });
            }
            Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
            i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L);
            i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L);
            try { sr.startListening(i); } catch (Exception ex) { emit("end", null); }
        });
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        main.post(() -> { if (sr != null) { try { sr.cancel(); sr.destroy(); } catch (Exception e) {} sr = null; } });
        call.resolve();
    }

    private void text(Bundle b, boolean fin) {
        ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (r == null || r.isEmpty() || r.get(0) == null || r.get(0).isEmpty()) return;
        JSObject d = new JSObject();
        d.put("text", r.get(0));
        d.put("final", fin);
        notifyListeners("result", d);
    }

    private void emit(String ev, String error) {
        JSObject d = new JSObject();
        if (error != null) d.put("error", error);
        notifyListeners(ev, d);
    }

    @Override
    protected void handleOnDestroy() {
        main.post(() -> { if (sr != null) { sr.destroy(); sr = null; } });
    }
}
