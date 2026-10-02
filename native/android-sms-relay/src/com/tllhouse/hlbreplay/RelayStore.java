package com.tllhouse.hlbreplay;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/** The SQLite journal is private, synchronous and retained across crashes. No message logging. */
final class RelayStore extends SQLiteOpenHelper {
    RelayStore(Context c) { super(c, "relay_private.db", null, 1); }
    @Override public void onConfigure(SQLiteDatabase db) { db.execSQL("PRAGMA synchronous=FULL"); }
    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE events (id TEXT PRIMARY KEY,generation TEXT NOT NULL,phone TEXT NOT NULL,body TEXT NOT NULL,date INTEGER NOT NULL,direction TEXT NOT NULL,done INTEGER NOT NULL DEFAULT 0)");
        db.execSQL("CREATE INDEX events_pending ON events(generation,done,date)");
        db.execSQL("CREATE TABLE attempts (id TEXT PRIMARY KEY,generation TEXT NOT NULL,phone TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL,started INTEGER,state TEXT NOT NULL,parts TEXT NOT NULL DEFAULT '[]',error TEXT NOT NULL DEFAULT '',acked INTEGER NOT NULL DEFAULT 0)");
    }
    @Override public void onUpgrade(SQLiteDatabase db, int old, int version) { throw new IllegalStateException("Migration required"); }

    void enqueue(RelayConfig config, String rawPhone, String body, long date, String direction) {
        enqueue(config,rawPhone,body,date,direction,date);
    }
    void enqueue(RelayConfig config, String rawPhone, String body, long date, String direction, long identityDate) {
        String phone = RelayPolicy.phone(rawPhone);
        if (!RelayPolicy.current(date, config.boundary, System.currentTimeMillis()) || !RelayPolicy.text(body)
            || !RelayPolicy.allowed(phone, config.hashes) || !("sent".equals(direction) || "received".equals(direction))) return;
        ContentValues v = new ContentValues();
        v.put("id", RelayPolicy.eventId(config.generation, direction, phone, identityDate, body)); v.put("generation", config.generation);
        v.put("phone", phone); v.put("body", body); v.put("date", date); v.put("direction", direction);
        getWritableDatabase().insertWithOnConflict("events", null, v, SQLiteDatabase.CONFLICT_IGNORE);
    }
    List<JSONObject> events(RelayConfig config) throws Exception {
        List<JSONObject> rows = new ArrayList<>();
        try (Cursor c = getReadableDatabase().query("events", new String[]{"id","phone","body","date","direction"},
                "generation=? AND done=0", new String[]{config.generation}, null, null, "date,id", "40")) {
            while (c.moveToNext()) rows.add(new JSONObject().put("id", c.getString(0)).put("phone", c.getString(1))
                .put("text", c.getString(2)).put("receivedAt", c.getLong(3)).put("direction", c.getString(4)));
        }
        return rows;
    }
    boolean pendingEvents(RelayConfig config) {
        try (Cursor c = getReadableDatabase().rawQuery("SELECT 1 FROM events WHERE generation=? AND done=0 LIMIT 1", new String[]{config.generation})) { return c.moveToFirst(); }
    }
    void eventDone(String id) { ContentValues v = new ContentValues(); v.put("done", 1); getWritableDatabase().update("events", v, "id=?", new String[]{id}); }

    boolean reserve(RelayConfig config, SendCoordinator.Message m) {
        ContentValues v = new ContentValues(); v.put("id", m.id); v.put("generation", config.generation);
        v.put("phone", m.phone); v.put("body", m.text); v.put("created", System.currentTimeMillis()); v.put("state", "claimRequested");
        return getWritableDatabase().insertWithOnConflict("attempts", null, v, SQLiteDatabase.CONFLICT_IGNORE) != -1;
    }
    boolean started(String id, int count) throws Exception {
        JSONArray parts = new JSONArray(); for (int i = 0; i < count; i++) parts.put("");
        ContentValues v = new ContentValues(); v.put("state", "attemptStarted"); v.put("started", System.currentTimeMillis()); v.put("parts", parts.toString());
        return getWritableDatabase().update("attempts", v, "id=? AND state='claimRequested'", new String[]{id}) == 1;
    }
    void finish(String id, String status, String error) {
        ContentValues v = new ContentValues(); v.put("state", status); v.put("error", error);
        getWritableDatabase().update("attempts", v, "id=? AND state IN ('claimRequested','attemptStarted')", new String[]{id});
    }
    void part(String id, int index, boolean success) throws Exception {
        SQLiteDatabase db = getWritableDatabase(); db.beginTransaction();
        try (Cursor c = db.query("attempts", new String[]{"parts","state"}, "id=?", new String[]{id}, null,null,null)) {
            if (c.moveToFirst() && "attemptStarted".equals(c.getString(1))) {
                JSONArray p = new JSONArray(c.getString(0));
                String[] r = new String[p.length()]; for (int i=0;i<r.length;i++) r[i] = p.getString(i);
                if (RelayPolicy.part(r,index,success)) {
                    p.put(index,r[index]);
                    String aggregate = RelayPolicy.aggregate(r);
                    ContentValues v = new ContentValues(); v.put("parts", p.toString());
                    if (aggregate != null) { v.put("state", aggregate); v.put("error", "failed".equals(aggregate) ? "part_failure" : ""); }
                    db.update("attempts", v, "id=?", new String[]{id});
                }
            }
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }
    void recoverUncertain(RelayConfig config) {
        ContentValues v = new ContentValues(); v.put("state", "unknown"); v.put("error", "callback_or_claim_uncertain");
        getWritableDatabase().update("attempts", v,
            "generation=? AND state IN ('claimRequested','attemptStarted') AND COALESCE(started,created)<?",
            new String[]{config.generation, Long.toString(System.currentTimeMillis()-600_000)});
    }
    List<JSONObject> acks(RelayConfig config) throws Exception {
        List<JSONObject> result = new ArrayList<>();
        try (Cursor c = getReadableDatabase().query("attempts", new String[]{"id","state","error"},
                "generation=? AND acked=0 AND state IN ('sent','failed','unknown')", new String[]{config.generation}, null,null,"created", "40")) {
            while(c.moveToNext()) {
                JSONObject j = new JSONObject().put("id", c.getString(0)).put("status", c.getString(1));
                if (!c.getString(2).isEmpty()) j.put("error", c.getString(2)); result.add(j);
            }
        }
        return result;
    }
    void ackDone(String id) {
        ContentValues v = new ContentValues(); v.put("acked", 1);
        // Keep the send tombstone to prevent retrying an already attempted outbox ID.
        getWritableDatabase().update("attempts", v, "id=?", new String[]{id});
    }
    void ackRejected(String id) {
        ContentValues v = new ContentValues(); v.put("acked",2);
        getWritableDatabase().update("attempts",v,"id=?",new String[]{id});
    }
}
