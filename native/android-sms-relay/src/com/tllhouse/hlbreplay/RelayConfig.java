package com.tllhouse.hlbreplay;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

final class RelayConfig {
    static final Object LOCK = new Object();
    private final SharedPreferences prefs;
    final String origin, token, generation;
    final long boundary;
    final boolean enabled;
    final Set<String> hashes;
    RelayConfig(Context context) {
        prefs = context.getSharedPreferences("relay_private", Context.MODE_PRIVATE);
        origin = prefs.getString("origin", ""); token = prefs.getString("token", "");
        generation = prefs.getString("generation", ""); boundary = prefs.getLong("boundary", 0);
        enabled = prefs.getBoolean("enabled", false);
        hashes = Collections.unmodifiableSet(new HashSet<>(prefs.getStringSet("hashes", Collections.emptySet())));
    }
    static boolean permissions(Context c) {
        return c.checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
            && c.checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
            && c.checkSelfPermission(Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED;
    }
    static void start(Context c, String origin, String token) {
        synchronized (LOCK) {
            if (!permissions(c)) throw new SecurityException();
            if (!new RelayConfig(c).prefs.edit().putString("origin", origin).putString("token", token)
                .putString("generation", UUID.randomUUID().toString()).putLong("boundary", System.currentTimeMillis())
                .putBoolean("enabled", true).putStringSet("hashes", Collections.emptySet())
                .putString("status", "연결 확인 중").remove("lastSync").commit()) throw new IllegalStateException();
        }
    }
    static void stop(Context c, String reason) {
        stop(c, null, reason);
    }
    static boolean stop(Context c, String expectedGeneration, String reason) {
        synchronized (LOCK) {
            RelayConfig current = new RelayConfig(c);
            // Compare and mutate under the same lock as start(). Permission loss must
            // still stop the current generation; an old HTTP failure must not stop a new one.
            if (expectedGeneration != null && !expectedGeneration.equals(current.generation)) return false;
            SharedPreferences p = current.prefs;
            if (!p.edit().putBoolean("enabled", false).remove("token").putStringSet("hashes", Collections.emptySet())
                .putString("status", reason).commit()) throw new IllegalStateException();
            RelayScheduler.cancel(c);
            return true;
        }
    }
    boolean active(Context c) {
        RelayConfig current = new RelayConfig(c);
        return enabled && current.enabled && generation.equals(current.generation) && permissions(c);
    }
    boolean updateHashes(Context c, Set<String> hashes) {
        synchronized (LOCK) {
            return active(c) && prefs.edit().putStringSet("hashes", new HashSet<>(hashes)).commit();
        }
    }
    void status(Context c, String status, boolean synced) {
        synchronized (LOCK) {
            if (!active(c)) return;
            SharedPreferences.Editor e = prefs.edit().putString("status", status);
            if (synced) e.putLong("lastSync", System.currentTimeMillis());
            e.commit();
        }
    }
}
