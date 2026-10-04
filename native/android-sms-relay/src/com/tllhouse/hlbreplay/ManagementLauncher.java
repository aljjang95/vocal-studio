package com.tllhouse.hlbreplay;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Bundle;

/** Always uses the owner's regular browser session. No keys, cookies or WebView. */
final class ManagementLauncher {
    static final String URL="https://hlb.tllhouse.com/";
    static final String PRIVACY_URL="https://vocal-studio-sms-relay.affinity-agent-studio.workers.dev/privacy";
    static Intent browserIntent() {
        return new Intent(Intent.ACTION_VIEW,Uri.parse(URL)).addCategory(Intent.CATEGORY_BROWSABLE);
    }
    static boolean open(Context context) {
        return openFixed(context,URL);
    }
    static boolean openPrivacy(Context context) { return openFixed(context,PRIVACY_URL); }
    private static boolean openFixed(Context context,String fixedUrl) {
        Intent browser=new Intent(Intent.ACTION_VIEW,Uri.parse(fixedUrl)).addCategory(Intent.CATEGORY_BROWSABLE);
        try {
            ResolveInfo resolved=context.getPackageManager().resolveActivity(browser,0);
            if (resolved!=null && resolved.activityInfo!=null) {
                String chosen=resolved.activityInfo.packageName;
                Intent service=new Intent("android.support.customtabs.action.CustomTabsService").setPackage(chosen);
                if (context.getPackageManager().resolveService(service,0)!=null) {
                    Intent tab=new Intent(Intent.ACTION_VIEW,Uri.parse(fixedUrl)).addCategory(Intent.CATEGORY_BROWSABLE).setPackage(chosen);
                    Bundle extras=new Bundle(); extras.putBinder("android.support.customtabs.extra.SESSION",null);
                    tab.putExtras(extras);
                    // Regular Custom Tab: no ephemeral/incognito session or app auth transfer.
                    try { context.startActivity(tab); return true; } catch (RuntimeException unavailable) { /* normal browser below */ }
                }
            }
        } catch (RuntimeException unavailable) { /* normal browser below */ }
        try { context.startActivity(browser); return true; } catch (RuntimeException unavailable) { return false; }
    }
}
