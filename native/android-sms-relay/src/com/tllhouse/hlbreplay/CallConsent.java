package com.tllhouse.hlbreplay;

import android.app.role.RoleManager;
import android.content.Context;
import android.os.Build;

final class CallConsent {
    static boolean held(Context c) {
        if (Build.VERSION.SDK_INT<29) return false;
        try {
            RoleManager role=c.getSystemService(RoleManager.class);
            return role!=null && role.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)
                && role.isRoleHeld(RoleManager.ROLE_CALL_SCREENING);
        } catch (Exception e) { return false; }
    }
    static CallPolicy.State state(Context c) {
        synchronized (RelayConfig.LOCK) {
            if (!held(c)) RelayConfig.callConsent(c,false);
            RelayConfig config=new RelayConfig(c);
            return new CallPolicy.State(config.active(c),config.callOptIn && held(c),config.callEnabled,
                config.callIncludeUnknown,config.generation,config.callEpoch,
                Math.max(config.boundary,config.callBoundary),System.currentTimeMillis(),config.hashes);
        }
    }
}
