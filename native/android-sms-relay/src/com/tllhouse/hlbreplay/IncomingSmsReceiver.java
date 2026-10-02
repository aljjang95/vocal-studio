package com.tllhouse.hlbreplay;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import java.util.LinkedHashMap;

public final class IncomingSmsReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        try {
            synchronized (RelayConfig.LOCK) {
                RelayConfig config=new RelayConfig(context);
                if (!config.active(context)) return;
                SmsMessage[] parts=Telephony.Sms.Intents.getMessagesFromIntent(intent);
                if(parts==null || parts.length==0 || parts.length>64) return;
                LinkedHashMap<String,StringBuilder> bodies=new LinkedHashMap<>();
                LinkedHashMap<String,Long> timestamps=new LinkedHashMap<>();
                for(SmsMessage part:parts) {
                    if(part==null) continue;
                    String phone=RelayPolicy.phone(part.getOriginatingAddress());
                    if(!RelayPolicy.allowed(phone,config.hashes) || part.getMessageBody()==null) continue;
                    bodies.computeIfAbsent(phone,k->new StringBuilder()).append(part.getMessageBody());
                    timestamps.putIfAbsent(phone,part.getTimestampMillis());
                }
                // Commit before scheduling network work. No network or raw content output in this receiver.
                try(RelayStore store=new RelayStore(context)) {
                    long receivedAt=System.currentTimeMillis();
                    for(String phone:bodies.keySet()) store.enqueue(config,phone,bodies.get(phone).toString(),receivedAt,"received",timestamps.get(phone));
                }
                RelayScheduler.soon(context);
            }
        } catch(Exception e) { /* Provider scan from start boundary recovers missing persisted SMS. */ }
    }
}
