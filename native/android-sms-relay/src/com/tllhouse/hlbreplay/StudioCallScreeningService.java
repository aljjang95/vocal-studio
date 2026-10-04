package com.tllhouse.hlbreplay;

import android.net.Uri;
import android.os.Build;
import android.telecom.Call;
import android.telecom.CallScreeningService;
import android.telecom.TelecomManager;

/** API29+ optional caller identification. Never blocks, silences or hides a call. */
public final class StudioCallScreeningService extends CallScreeningService {
    @Override public void onScreenCall(Call.Details details) {
        // This must precede preferences, locks, SQLite, role checks and scheduling.
        // All default response flags are explicitly false, including history/notification flags.
        if (Build.VERSION.SDK_INT<29 || details.getCallDirection()==Call.Details.DIRECTION_INCOMING) {
            CallResponse.Builder allow=new CallResponse.Builder().setDisallowCall(false).setRejectCall(false)
                .setSkipCallLog(false).setSkipNotification(false);
            if (Build.VERSION.SDK_INT>=29) allow.setSilenceCall(false);
            respondToCall(details,allow.build());
        }
        if (Build.VERSION.SDK_INT<29 || details.getCallDirection()!=Call.Details.DIRECTION_INCOMING) return;
        try {
            if (details.getHandlePresentation()!=TelecomManager.PRESENTATION_ALLOWED) return;
            Uri handle=details.getHandle();
            if (handle==null || !"tel".equals(handle.getScheme())) return;
            synchronized (RelayConfig.LOCK) {
                CallPolicy.State state=CallConsent.state(this);
                CallPolicy.Event event=CallPolicy.Event.observed(handle.getSchemeSpecificPart(),
                    details.getCreationTimeMillis(),state.generation,state.epoch,state.boundary);
                if (!state.accepts(event)) return;
                try (RelayStore store=new RelayStore(this)) { store.enqueueCall(event); }
                RelayScheduler.soon(this);
            }
        } catch (Exception e) { /* Allow was already returned. Never log caller metadata. */ }
    }
}
