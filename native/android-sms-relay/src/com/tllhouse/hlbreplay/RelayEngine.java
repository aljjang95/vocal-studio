package com.tllhouse.hlbreplay;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Telephony;
import android.telephony.SmsManager;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

final class RelayEngine {
    private final Context context;
    private final AtomicBoolean cancelled;
    private final long deadline;
    private RelayConfig config;
    private final RelayStore store;
    private RelayHttp http;
    RelayEngine(Context c, AtomicBoolean cancelled, RelayStore store) {
        this.context = c; this.cancelled = cancelled; this.store = store;
        config = new RelayConfig(c); deadline = android.os.SystemClock.elapsedRealtime()+45_000;
    }
    private boolean active() {
        return !cancelled.get() && android.os.SystemClock.elapsedRealtime()<deadline && config.active(context);
    }
    private void requireActive() throws Exception { if (!active()) throw new Exception("Job deferred"); }

    boolean run() {
        if (!config.enabled) return false;
        if (!RelayConfig.permissions(context)) {
            RelayConfig.stop(context, config.generation, "문자 권한이 없어 연결을 중지했습니다"); return false;
        }
        try {
            requireActive(); http = new RelayHttp(config);
            JSONObject pull = http.request("/device/pull", null);
            requireActive();
            JSONArray allowed = pull.getJSONArray("allowedPhoneHashes"); Set<String> hashes = new HashSet<>();
            if (allowed.length()>5000) throw new Exception("Invalid allowlist");
            for (int i=0;i<allowed.length();i++) {
                String h = allowed.getString(i);
                if (!h.matches("[a-f0-9]{64}")) throw new Exception("Invalid allowlist"); hashes.add(h);
            }
            JSONObject callIntake=pull.optJSONObject("callIntake");
            if (!config.updatePull(context, hashes, callIntake==null ? null : callIntake.opt("enabled"),
                callIntake==null ? null : callIntake.opt("includeUnknown"))) return false;
            synchronized (RelayConfig.LOCK) {
                requireActive(); config = new RelayConfig(context); http = new RelayHttp(config);
            }
            store.recoverUncertain(config);
            flushAcks();
            scanProvider();
            flushEvents();
            // Every observed reply must reach the server before claiming a queued follow-up.
            if (store.pendingEvents(config)) { flushCalls(); return true; }
            JSONArray pending = pull.getJSONArray("messages");
            if (pending.length()>200) throw new Exception("Invalid outbox");
            for (int i=0;i<pending.length();i++) {
                requireActive(); JSONObject j = pending.getJSONObject(i);
                String id = j.getString("id"), p = RelayPolicy.phone(j.getString("phone")), text = j.getString("text");
                if (id.length()>160 || id.isEmpty() || !RelayPolicy.text(text) || !RelayPolicy.allowed(p, config.hashes)) continue;
                coordinator().process(new SendCoordinator.Message(id,p,text));
            }
            flushAcks(); config.status(context, "연결됨 · 등록 번호만 처리합니다", true);
            return flushCalls();
        } catch (RelayHttp.Failure e) {
            if (e.status==401 || e.status==403) { RelayConfig.stop(context, config.generation, "연결 토큰이 만료되거나 취소되었습니다"); return false; }
            config.status(context, "서버 연결 대기 · 저장된 결과는 다시 전송합니다", false); return active();
        } catch (SecurityException e) {
            RelayConfig.stop(context, config.generation, "문자 권한을 확인한 뒤 다시 연결해 주세요"); return false;
        } catch (Exception e) {
            config.status(context, "처리 대기 · 다음 백그라운드 실행에서 확인합니다", false);
            return config.active(context) && !cancelled.get();
        }
    }

    private boolean flushCalls() throws Exception {
        try {
            return CallForwarder.flush(() -> {
                // Cancellation/deadline defers work; it must not retire an otherwise valid call.
                requireActive();
                CallPolicy.State current=CallConsent.state(context);
                // An old job must never forward a new connection's events.
                return new CallPolicy.State(current.active,current.consent,current.enabled,current.unknown,
                    current.generation,current.epoch,current.boundary,current.now,current.hashes);
            },new CallForwarder.Journal() {
                @Override public List<CallPolicy.Event> pending() { return store.calls(config.generation); }
                @Override public void retire(String id) { store.callDone(id); }
            },event -> {
                requireActive();
                // Recheck at dispatch, after reading the durable queue. Server also
                // rechecks auth/settings transactionally for any request in flight.
                synchronized (RelayConfig.LOCK) {
                    requireActive();
                    if (!CallConsent.state(context).accepts(event)) return;
                }
                try {
                    http.request("/device/call",new JSONObject().put("id",event.id).put("phone",event.phone)
                        .put("receivedAt",event.receivedAt).put("direction","incoming"));
                } catch (RelayHttp.Failure failure) { throw new CallForwarder.Failure(failure.status); }
            });
        } catch (CallForwarder.Failure failure) {
            // The existing outer handler stops only this request's generation.
            throw new RelayHttp.Failure(failure.status);
        } catch (Exception e) {
            // Optional call-network failures do not interrupt the SMS send/receive path.
            return active();
        }
    }

    private void flushEvents() throws Exception {
        while (active()) {
            List<JSONObject> events = store.events(config); if (events.isEmpty()) return;
            for (JSONObject e : events) {
                requireActive();
                if (!RelayPolicy.allowed(e.getString("phone"), config.hashes)) { store.eventDone(e.getString("id")); continue; }
                try { http.request("/device/event", e); store.eventDone(e.getString("id")); }
                catch (RelayHttp.Failure failure) {
                    if (failure.status==413 || failure.status==400 || failure.status==409) {
                        // Never truncate/change a queued event's payload under the same replay ID.
                        store.eventDone(e.getString("id"));
                    } else throw failure;
                }
            }
        }
        requireActive();
    }
    private void flushAcks() throws Exception {
        for (JSONObject ack : store.acks(config)) {
            requireActive();
            try { http.request("/device/ack", ack); store.ackDone(ack.getString("id")); }
            catch(RelayHttp.Failure failure) {
                if(RelayPolicy.terminalAck(failure.status)) store.ackRejected(ack.getString("id"));
                else throw failure;
            }
        }
    }
    private void scanProvider() throws Exception {
        requireActive();
        // Only rows received/sent on this phone after the owner's explicit start boundary.
        try (Cursor c = context.getContentResolver().query(Telephony.Sms.CONTENT_URI,
            new String[]{"_id","address","body","date","date_sent","type","creator"},
            "date>=? AND type IN (1,2)", new String[]{Long.toString(config.boundary)}, "date ASC,_id ASC")) {
            if (c==null) throw new Exception("SMS provider unavailable");
            while(c.moveToNext()) {
                requireActive(); String p = RelayPolicy.phone(c.getString(1));
                if (!RelayPolicy.allowed(p,config.hashes)) continue; // no body processing for unmatched numbers
                String body = c.getString(2); long date=c.getLong(3); boolean sent=c.getInt(5)==2;
                // Only explicit provider provenance proves this app sent the row. Matching
                // phone/body/time also matches legitimate repeated replies from another app.
                if (sent && context.getPackageName().equals(c.getString(6))) continue;
                synchronized (RelayConfig.LOCK) {
                    if (!active()) return;
                    long identityDate = !sent && c.getLong(4)>0 ? c.getLong(4) : date;
                    store.enqueue(config,p,body,date,sent ? "sent" : "received",identityDate);
                }
            }
        }
    }
    private SendCoordinator coordinator() {
        return new SendCoordinator(new SendCoordinator.Journal() {
            @Override public boolean reserve(SendCoordinator.Message m) {
                synchronized (RelayConfig.LOCK) { return active() && store.reserve(config,m); }
            }
            @Override public boolean started(SendCoordinator.Message m, int parts) {
                synchronized (RelayConfig.LOCK) {
                    try { return active() && store.started(m.id,parts); } catch (Exception e) { return false; }
                }
            }
            @Override public void finish(String id, String status, String error) { store.finish(id,status,error); }
        }, id -> {
            requireActive();
            try {
                JSONObject response = http.request("/device/claim",new JSONObject().put("id",id));
                JSONObject m=response.getJSONObject("message");
                String p=RelayPolicy.phone(m.getString("phone")), text=m.getString("text");
                if (!RelayPolicy.allowed(p,config.hashes) || !RelayPolicy.text(text)) throw new Exception("Invalid claim");
                return new SendCoordinator.Message(m.getString("id"),p,text);
            } catch (RelayHttp.Failure failure) {
                if (failure.status==401 || failure.status==403) RelayConfig.stop(context, config.generation, "연결 토큰이 취소되었습니다");
                if (failure.status==404 || failure.status==409 || failure.status==410) return null;
                throw failure;
            }
        }, new SendCoordinator.Sender() {
            @Override public boolean active() { return RelayEngine.this.active() && !store.pendingEvents(config); }
            @Override public List<String> divide(String text) { return smsManager().divideMessage(text); }
            @Override public void send(SendCoordinator.Message m, List<String> parts) throws Exception {
                synchronized (RelayConfig.LOCK) {
                    requireActive();
                    if(store.pendingEvents(config)) throw new Exception("Reply requires synchronization before send");
                    ArrayList<PendingIntent> sent = new ArrayList<>();
                    for (int i=0;i<parts.size();i++) {
                        Intent intent = new Intent(context,SentResultReceiver.class).setAction("com.tllhouse.hlbreplay.SENT")
                            .setData(new Uri.Builder().scheme("hlb-sms").authority("sent").appendPath(m.id).appendPath(Integer.toString(i)).build())
                            .putExtra("id",m.id).putExtra("part",i);
                        sent.add(PendingIntent.getBroadcast(context,0,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
                    }
                    smsManager().sendMultipartTextMessage(m.phone,null,new ArrayList<>(parts),sent,null);
                }
            }
        });
    }
    private SmsManager smsManager() {
        int id = android.telephony.SubscriptionManager.getDefaultSmsSubscriptionId();
        if (id < 0 || id == Integer.MAX_VALUE) throw new IllegalStateException("Default SMS SIM required");
        if (android.os.Build.VERSION.SDK_INT >= 31) return context.getSystemService(SmsManager.class).createForSubscriptionId(id);
        return SmsManager.getSmsManagerForSubscriptionId(id);
    }
}
