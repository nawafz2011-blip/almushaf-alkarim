package com.mushaff.app;

import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;

/** Shares an image (the ayahs cut from the mushaf) or text through Android's share sheet. */
@CapacitorPlugin(name = "AppShare")
public class SharePlugin extends Plugin {
    @PluginMethod
    public void share(PluginCall call) {
        try {
            String b64 = call.getString("base64");
            String text = call.getString("text", "");
            Intent send = new Intent(Intent.ACTION_SEND);
            if (b64 != null && !b64.isEmpty()) {
                File dir = new File(getContext().getCacheDir(), "share");
                dir.mkdirs();
                File f = new File(dir, safe(call.getString("name", "ayat.png")));
                try (FileOutputStream out = new FileOutputStream(f)) { out.write(Base64.decode(b64, Base64.DEFAULT)); }
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
                send.setType(call.getString("mime", "image/png"));
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                if (!text.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, text);
            } else {
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_TEXT, text);
            }
            Intent chooser = Intent.createChooser(send, "مشاركة");
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject("share failed", e);
        }
    }

    private static String safe(String n) { return n.replaceAll("[\\\\/:*?\"<>|]", "_"); }
}
