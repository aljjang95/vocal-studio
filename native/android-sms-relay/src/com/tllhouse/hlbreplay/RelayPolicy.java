package com.tllhouse.hlbreplay;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Collection;

/** Platform-independent privacy and callback rules, also exercised on the host JVM. */
public final class RelayPolicy {
    private RelayPolicy() {}

    public static String origin(String input) {
        try {
            URI u = new URI(input.trim());
            if (!"https".equalsIgnoreCase(u.getScheme()) || u.getHost() == null || u.getRawUserInfo() != null
                    || u.getRawQuery() != null || u.getRawFragment() != null
                    || !(u.getRawPath() == null || u.getRawPath().isEmpty() || "/".equals(u.getRawPath()))
                    || (u.getPort() != -1 && u.getPort() != 443)) throw new IllegalArgumentException();
            return "https://" + u.getHost().toLowerCase(java.util.Locale.ROOT);
        } catch (Exception e) { throw new IllegalArgumentException("HTTPS relay origin required"); }
    }

    public static String token(String input) {
        String s = input.trim();
        if (s.length() < 16 || s.length() > 1024 || !s.matches("[A-Za-z0-9._~-]+"))
            throw new IllegalArgumentException("Invalid pair token");
        return s;
    }

    public static String phone(String value) {
        if (value == null || !value.matches("[+0-9() .\\-]+")) return null;
        String p = value.replaceAll("[() .\\-]", "");
        if (p.startsWith("+82")) p = "0" + p.substring(3).replaceFirst("^0", "");
        else if (p.startsWith("0082")) p = "0" + p.substring(4).replaceFirst("^0", "");
        return p.matches("[0-9]{9,11}") ? p : null;
    }

    public static String hash(String s) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder b = new StringBuilder(64);
            for (byte v : digest) b.append(String.format(java.util.Locale.ROOT, "%02x", v & 255));
            return b.toString();
        } catch (Exception e) { throw new IllegalStateException("SHA-256 unavailable"); }
    }

    public static boolean allowed(String phone, Collection<String> hashes) {
        String p = phone(phone);
        return p != null && hashes.contains(hash(p));
    }

    public static boolean current(long timestamp, long boundary, long now) {
        return boundary > 0 && timestamp >= boundary && timestamp <= now + 300_000;
    }

    public static boolean text(String text) { return text != null && !text.isEmpty() && text.length() <= 4000; }

    public static String eventId(String generation, String direction, String phone, long date, String text) {
        return hash(generation + "\n" + direction + "\n" + phone + "\n" + date + "\n" + text);
    }

    /** Wait for every part, including failures; a missing callback remains uncertain. */
    public static String aggregate(String[] results) {
        if (results.length == 0) return null;
        boolean failed = false;
        for (String r : results) {
            if (r == null || r.isEmpty()) return null;
            if (!"sent".equals(r)) failed = true;
        }
        return failed ? "failed" : "sent";
    }

    /** Callback replays keep the first durable per-part result. */
    public static boolean part(String[] results, int index, boolean success) {
        if (index < 0 || index >= results.length || (results[index] != null && !results[index].isEmpty())) return false;
        results[index] = success ? "sent" : "failed";
        return true;
    }

    /** Definitive rejections cannot become successful by replaying identical ACK/event payloads. */
    public static boolean terminalAck(int status) { return status == 400 || status == 404 || status == 409 || status == 410; }
}
