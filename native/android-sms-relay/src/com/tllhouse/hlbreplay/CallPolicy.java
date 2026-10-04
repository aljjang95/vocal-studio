package com.tllhouse.hlbreplay;

import java.util.Collection;

/** Call metadata is independent of SMS messages, acknowledgements and bookings. */
final class CallPolicy {
    private CallPolicy() {}
    static String phone(String raw) {
        String p = RelayPolicy.phone(raw);
        return p != null && p.matches("0[0-9]{8,10}") ? p : null;
    }
    static final class Event {
        final String id, phone, generation, epoch;
        final long receivedAt, boundary;
        Event(String id, String phone, long at, String generation, String epoch, long boundary) {
            this.id=id; this.phone=phone; this.receivedAt=at;
            this.generation=generation; this.epoch=epoch; this.boundary=boundary;
        }
        static Event observed(String raw, long at, String generation, String epoch, long boundary) {
            String p=CallPolicy.phone(raw);
            if (p==null || generation.isEmpty() || epoch.isEmpty()) return null;
            return new Event(RelayPolicy.hash("call\n"+generation+"\n"+epoch+"\n"+p+"\n"+at),p,at,generation,epoch,boundary);
        }
    }
    static final class State {
        final boolean active, consent, enabled, unknown;
        final String generation, epoch;
        final long boundary, now;
        final Collection<String> hashes;
        State(boolean active, boolean consent, boolean enabled, boolean unknown, String generation,
                String epoch, long boundary, long now, Collection<String> hashes) {
            this.active=active; this.consent=consent; this.enabled=enabled; this.unknown=unknown;
            this.generation=generation; this.epoch=epoch; this.boundary=boundary; this.now=now; this.hashes=hashes;
        }
        boolean accepts(Event e) {
            return e!=null && active && consent && enabled && !generation.isEmpty() && !epoch.isEmpty()
                && generation.equals(e.generation) && epoch.equals(e.epoch) && e.boundary==boundary
                && RelayPolicy.current(e.receivedAt,boundary,now) && e.phone.equals(CallPolicy.phone(e.phone))
                && (unknown || RelayPolicy.allowed(e.phone,hashes));
        }
    }
}
