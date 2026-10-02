package com.tllhouse.hlbreplay;

import java.util.List;

/** Ordering is the safety boundary: reserve -> claim -> durable started -> modem, never retry. */
public final class SendCoordinator {
    public static final class Message {
        public final String id, phone, text;
        public Message(String id, String phone, String text) { this.id = id; this.phone = phone; this.text = text; }
    }
    public interface Journal {
        boolean reserve(Message message);
        boolean started(Message message, int parts);
        void finish(String id, String status, String error);
    }
    public interface Api { Message claim(String id) throws Exception; }
    public interface Sender {
        boolean active();
        List<String> divide(String text);
        void send(Message message, List<String> parts) throws Exception;
    }
    private final Journal journal;
    private final Api api;
    private final Sender sender;
    public SendCoordinator(Journal journal, Api api, Sender sender) {
        this.journal = journal; this.api = api; this.sender = sender;
    }
    public void process(Message pending) {
        if (!sender.active() || !journal.reserve(pending)) return;
        try {
            if (!sender.active()) { journal.finish(pending.id, "unknown", "stopped"); return; }
            Message claimed = api.claim(pending.id);
            if (claimed == null) { journal.finish(pending.id, "failed", "claim_denied"); return; }
            if (!pending.id.equals(claimed.id) || !pending.phone.equals(claimed.phone) || !pending.text.equals(claimed.text)) {
                journal.finish(pending.id, "unknown", "claim_mismatch"); return;
            }
            if (!sender.active()) { journal.finish(pending.id, "unknown", "stopped"); return; }
            List<String> parts = sender.divide(claimed.text);
            if (parts == null || parts.isEmpty() || parts.size() > 64) {
                journal.finish(pending.id, "failed", "invalid_parts"); return;
            }
            if (!journal.started(claimed, parts.size())) return; // never call the modem on a failed commit
            if (!sender.active()) { journal.finish(pending.id, "unknown", "stopped"); return; }
            sender.send(claimed, parts);
        } catch (SecurityException e) { journal.finish(pending.id, "failed", "permission_denied"); }
        catch (Exception e) { journal.finish(pending.id, "unknown", "attempt_uncertain"); }
        // Errors such as process termination leave reserve/started durable; a new process must not send again.
    }
}
