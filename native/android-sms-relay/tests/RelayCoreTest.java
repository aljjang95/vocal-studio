package com.tllhouse.hlbreplay;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Synthetic host tests. Does not use a device, customers, network, Android provider or modem. */
public final class RelayCoreTest {
    private static int checks;
    private static void check(boolean value,String name) { checks++; if(!value) throw new AssertionError(name); }
    private static void invalid(Runnable fn,String name) {
        try { fn.run(); throw new AssertionError(name); } catch(IllegalArgumentException expected) { checks++; }
    }
    private static final class Fixture implements SendCoordinator.Journal,SendCoordinator.Api,SendCoordinator.Sender {
        final Set<String> reserved=new HashSet<>(); final List<String> order=new ArrayList<>();
        boolean active=true,commit=true; int claims,sends; String state="",error="";
        String fault=""; SendCoordinator.Message claimed;
        @Override public boolean reserve(SendCoordinator.Message m) {
            order.add("reserve"); if(!reserved.add(m.id)) return false; state="claimRequested"; return true;
        }
        @Override public SendCoordinator.Message claim(String id) throws Exception {
            claims++; order.add("claim");
            if("claim_disconnect".equals(fault)) throw new Exception();
            if("claim_crash".equals(fault)) throw new AssertionError("synthetic termination");
            if("stop_after_claim".equals(fault)) active=false;
            return "denied".equals(fault) ? null : claimed;
        }
        @Override public boolean started(SendCoordinator.Message m,int parts) {
            order.add("commit_started");
            if(!commit) return false; state="attemptStarted";
            if("before_modem_crash".equals(fault)) throw new AssertionError("synthetic termination");
            return true;
        }
        @Override public void finish(String id,String status,String reason) { state=status; error=reason; order.add("finish"); }
        @Override public boolean active() { return active; }
        @Override public List<String> divide(String text) { return Arrays.asList("part1","part2"); }
        @Override public void send(SendCoordinator.Message m,List<String> parts) throws Exception {
            check("attemptStarted".equals(state),"durable start precedes modem"); sends++; order.add("modem");
            if("modem_exception".equals(fault)) throw new Exception();
            if("after_modem_crash".equals(fault)) throw new AssertionError("synthetic termination");
        }
        SendCoordinator coordinator() { return new SendCoordinator(this,this,this); }
    }
    private static void stopFailedGeneration(android.content.Context c,String generation,String reason) throws Exception {
        try { RelayConfig.class.getDeclaredMethod("stop",android.content.Context.class,String.class,String.class).invoke(null,c,generation,reason); }
        catch (NoSuchMethodException baseline) { RelayConfig.stop(c,reason); }
    }
    private static void restartRace() throws Exception {
        for (int status : new int[]{401,403}) {
            android.content.Context c=new android.content.Context();
            RelayConfig.start(c,"https://relay.example","synthetic-old-token");
            RelayConfig old=new RelayConfig(c);CountDownLatch requested=new CountDownLatch(1),failed=new CountDownLatch(1);
            final Throwable[] errors={null};
            Thread request=new Thread(()->{
                try {requested.countDown();if(!failed.await(5,TimeUnit.SECONDS))throw new AssertionError("race gate timeout");
                    stopFailedGeneration(c,old.generation,"synthetic auth failure "+status);
                } catch(Throwable error){errors[0]=error;}
            });
            request.start();check(requested.await(5,TimeUnit.SECONDS),"old request in flight "+status);
            RelayConfig.stop(c,"explicit stop");RelayConfig.start(c,"https://relay.example","synthetic-new-token");
            RelayConfig current=new RelayConfig(c);current.updateHashes(c,new HashSet<>(Arrays.asList(RelayPolicy.hash("01000000000"))));
            current.status(c,"new connection ready",true);int cancellations=RelayScheduler.cancellations;
            failed.countDown();request.join(5000);check(!request.isAlive()&&errors[0]==null,"old failure completed "+status);
            RelayConfig after=new RelayConfig(c);
            check(after.enabled&&"synthetic-new-token".equals(after.token),"stale "+status+" preserves new token and enabled state");
            check(current.generation.equals(after.generation)&&current.boundary==after.boundary,"stale failure preserves new generation and boundary");
            check(after.hashes.size()==1&&RelayScheduler.cancellations==cancellations,"stale failure preserves allowlist and scheduled jobs");
            check("new connection ready".equals(c.getSharedPreferences("relay_private",0).getString("status","")),"stale failure preserves new status");
            c.permissionGranted=false;stopFailedGeneration(c,current.generation,"current permission failure");
            check(!new RelayConfig(c).enabled&&new RelayConfig(c).token.isEmpty(),"current generation stops even after permission loss");
            check(RelayScheduler.cancellations==cancellations+1,"current generation cancels jobs once");
        }
    }
    public static void main(String[] args) throws Exception {
        check("01000000000".equals(RelayPolicy.phone("+82 (10) 0000-0000")),"+82 normalization");
        check("01000000000".equals(RelayPolicy.phone("0082 10 0000 0000")),"0082 normalization");
        check("01000000000".equals(RelayPolicy.phone("+82 01000000000")),"optional trunk prefix");
        check(RelayPolicy.phone("text01000000000")==null,"reject letters");
        check(RelayPolicy.phone("+1 0000000000")==null,"reject unsupported international prefix");
        check(RelayPolicy.phone("123")==null,"reject short address");
        check(RelayPolicy.phone(null)==null,"null address");
        check(RelayPolicy.hash("abc").equals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"),"known SHA-256");
        Set<String> allow=new HashSet<>(Arrays.asList(RelayPolicy.hash("01000000000")));
        check(RelayPolicy.allowed("+82 10 0000 0000",allow),"hash lookup after normalize");
        check(!RelayPolicy.allowed("01000000001",allow),"unlisted denied before forwarding");
        check(!RelayPolicy.current(999,1000,2000),"pre-start history denied");
        check(RelayPolicy.current(1000,1000,2000),"boundary included");
        check(!RelayPolicy.current(1000,0,2000),"missing boundary denied");
        check(!RelayPolicy.current(400000,1000,2000),"future timestamps bounded");
        check(RelayPolicy.text(new String(new char[4000]).replace('\0','가')),"maximum text");
        check(!RelayPolicy.text(new String(new char[4001]).replace('\0','가')),"oversized text denied");
        String event=RelayPolicy.eventId("generation","received","01000000000",1000,"synthetic");
        check(event.equals(RelayPolicy.eventId("generation","received","01000000000",1000,"synthetic")),"idempotent event identity");
        check(!event.equals(RelayPolicy.eventId("generation","sent","01000000000",1000,"synthetic")),"direction not conflated");
        check(!event.equals(RelayPolicy.eventId("new-generation","received","01000000000",1000,"synthetic")),"pairing partition");
        check("https://relay.example".equals(RelayPolicy.origin("https://RELAY.example/")),"strict origin normalize");
        invalid(()->RelayPolicy.origin("http://relay.example"),"no cleartext");
        invalid(()->RelayPolicy.origin("https://relay.example/api/calendar"),"no owner/public paths");
        invalid(()->RelayPolicy.origin("https://token@relay.example"),"no userinfo");
        invalid(()->RelayPolicy.origin("https://relay.example/?token=x"),"no URL token");
        invalid(()->RelayPolicy.origin("https://relay.example/#token"),"no fragment token");
        invalid(()->RelayPolicy.token("synthetic-token\r\nInjected: header"),"header injection denied");
        check(RelayPolicy.token("synthetic-pair-token").equals("synthetic-pair-token"),"token format");
        check(RelayPolicy.aggregate(new String[]{"sent",""})==null,"wait for all callbacks");
        check(RelayPolicy.aggregate(new String[]{"failed",""})==null,"partial failure still waits");
        check("sent".equals(RelayPolicy.aggregate(new String[]{"sent","sent"})),"all sent");
        check("failed".equals(RelayPolicy.aggregate(new String[]{"failed","sent"})),"all-part failure aggregate");
        String[] parts={"","",""};
        check(RelayPolicy.part(parts,2,true),"out of order callback persisted");
        check(RelayPolicy.aggregate(parts)==null,"out of order incomplete");
        check(RelayPolicy.part(parts,0,false),"failed part persisted");
        check(!RelayPolicy.part(parts,0,true),"duplicate cannot overwrite failure");
        check(!RelayPolicy.part(parts,3,true),"invalid callback index ignored");
        check(RelayPolicy.part(parts,1,true) && "failed".equals(RelayPolicy.aggregate(parts)),"final callback completes failure");
        check(RelayPolicy.terminalAck(409) && RelayPolicy.terminalAck(404),"suppressed or removed ACK retired");
        check(!RelayPolicy.terminalAck(500) && !RelayPolicy.terminalAck(401) && !RelayPolicy.terminalAck(429),"transient failures not silently retired");

        SendCoordinator.Message m=new SendCoordinator.Message("synthetic-outbox","01000000000","synthetic");
        Fixture success=new Fixture(); success.claimed=m; success.coordinator().process(m);
        check(success.order.equals(Arrays.asList("reserve","claim","commit_started","modem")),"claim/commit/modem ordering");
        success.coordinator().process(m);
        check(success.claims==1 && success.sends==1,"duplicate pull never claims or sends twice");
        Fixture failedCommit=new Fixture(); failedCommit.claimed=m; failedCommit.commit=false;
        failedCommit.coordinator().process(m); failedCommit.commit=true; failedCommit.coordinator().process(m);
        check(failedCommit.sends==0 && failedCommit.claims==1,"failed commit never modem or blind retry");
        Fixture stopped=new Fixture(); stopped.claimed=m; stopped.fault="stop_after_claim"; stopped.coordinator().process(m);
        check(stopped.sends==0 && "unknown".equals(stopped.state),"stop after claim prevents modem");
        Fixture denied=new Fixture(); denied.claimed=m; denied.fault="denied"; denied.coordinator().process(m);
        check(denied.sends==0 && "failed".equals(denied.state),"suppressed claim cannot send");
        Fixture mismatch=new Fixture(); mismatch.claimed=new SendCoordinator.Message(m.id,"01000000001",m.text); mismatch.coordinator().process(m);
        check(mismatch.sends==0 && "unknown".equals(mismatch.state),"changed destination cannot send");
        for(String fault:Arrays.asList("claim_disconnect","modem_exception","claim_crash","before_modem_crash","after_modem_crash")) {
            Fixture f=new Fixture(); f.claimed=m; f.fault=fault;
            try { f.coordinator().process(m); } catch(AssertionError termination) { /* persisted fake journal survives a new coordinator */ }
            int sent=f.sends,claimed=f.claims; f.fault=""; f.coordinator().process(m);
            check(f.sends==sent && f.claims==claimed,"no retry after "+fault);
            if(fault.endsWith("exception") || fault.endsWith("disconnect")) check("unknown".equals(f.state),"uncertain outcome retained");
        }
        check(checks==55,"all original 55 assertions retained");
        restartRace();
        System.out.println("PASS RelayCoreTest: "+checks+" synthetic privacy, multipart, crash-order and generation-race assertions");
    }
}
