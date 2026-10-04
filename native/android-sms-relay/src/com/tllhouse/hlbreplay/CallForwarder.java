package com.tllhouse.hlbreplay;

import java.util.List;

/** Small testable queue boundary. Retrying never creates a new event or payload. */
final class CallForwarder {
    interface Gate { CallPolicy.State current() throws Exception; }
    interface Journal { List<CallPolicy.Event> pending() throws Exception; void retire(String id); }
    interface Api { void upload(CallPolicy.Event event) throws Exception; }
    static final class Failure extends Exception {
        final int status;
        Failure(int status) { this.status=status; }
    }
    static boolean flush(Gate gate, Journal journal, Api api) throws Exception {
        for (CallPolicy.Event event : journal.pending()) {
            // Read a fresh snapshot for every event, including retries after process restart.
            if (!gate.current().accepts(event)) { journal.retire(event.id); continue; }
            try { api.upload(event); journal.retire(event.id); }
            catch (Failure failure) {
                if (failure.status==400 || failure.status==409 || failure.status==413) journal.retire(event.id);
                else if (failure.status==401 || failure.status==403) throw failure;
                else return true; // offline/5xx/429/old endpoint: leave immutable payload pending
            }
        }
        return !journal.pending().isEmpty();
    }
}
