package com.tllhouse.hlbreplay;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class SentResultReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent) {
        if (!"com.tllhouse.hlbreplay.SENT".equals(intent.getAction())) return;
        String id=intent.getStringExtra("id"); int part=intent.getIntExtra("part",-1);
        if(id==null || id.length()>160 || part<0 || part>=64) return;
        try {
            synchronized(RelayConfig.LOCK) {
                try(RelayStore store=new RelayStore(context)) { store.part(id,part,getResultCode()==Activity.RESULT_OK); }
                RelayScheduler.soon(context);
            }
        } catch(Exception e) { /* Durable attempt becomes unknown on missing callbacks, never re-sent. */ }
    }
}
