package com.tllhouse.hlbreplay;

import javax.net.ssl.HttpsURLConnection;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

final class RelayHttp {
    static final class Failure extends Exception {
        final int status;
        Failure(int status) { super("Relay request failed"); this.status = status; }
    }
    private final RelayConfig config;
    RelayHttp(RelayConfig config) { this.config = config; }
    JSONObject request(String route, JSONObject body) throws Exception {
        if (!("/device/pull".equals(route) || "/device/event".equals(route)
            || "/device/claim".equals(route) || "/device/ack".equals(route))) throw new IllegalArgumentException();
        HttpsURLConnection c = (HttpsURLConnection) new URL(RelayPolicy.origin(config.origin) + route).openConnection();
        try {
            c.setInstanceFollowRedirects(false); c.setConnectTimeout(7000); c.setReadTimeout(7000);
            c.setRequestProperty("Authorization", "Bearer " + RelayPolicy.token(config.token));
            c.setRequestProperty("Accept", "application/json"); c.setUseCaches(false);
            if (body != null) {
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                if (bytes.length > 16384) throw new Failure(413);
                c.setRequestMethod("POST"); c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                c.setDoOutput(true); c.setFixedLengthStreamingMode(bytes.length);
                try (java.io.OutputStream out = c.getOutputStream()) { out.write(bytes); }
            } else c.setRequestMethod("GET");
            int status = c.getResponseCode();
            if (status != 200) throw new Failure(status); // never read, display or log an error body
            String contentType = c.getContentType();
            if (contentType == null || !contentType.toLowerCase(java.util.Locale.ROOT).startsWith("application/json")) throw new Failure(502);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (InputStream input = c.getInputStream()) {
                byte[] buffer = new byte[4096]; int count;
                while ((count=input.read(buffer)) != -1) {
                    if (out.size()+count>524288) throw new Failure(502);
                    out.write(buffer,0,count);
                }
            }
            JSONObject result = new JSONObject(new String(out.toByteArray(), StandardCharsets.UTF_8));
            if (!result.optBoolean("ok", false)) throw new Failure(502);
            return result;
        } finally { c.disconnect(); }
    }
}
