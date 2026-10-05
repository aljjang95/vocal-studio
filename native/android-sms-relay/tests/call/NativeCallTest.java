package com.tllhouse.hlbreplay;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.telecom.Call;
import org.json.JSONObject;
import org.json.JSONArray;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Production Java with synthetic Android surfaces. No device/SMS/calls/network. */
public final class NativeCallTest {
    private static int checks;
    private static final String PHONE="01000000000", OTHER="01000000001";
    private static final Set<String> ALLOW=new HashSet<>(Arrays.asList(RelayPolicy.hash(PHONE)));
    private static void check(boolean v,String name){checks++;if(!v)throw new AssertionError(name);}
    private static Context setup() {
        Trace.reset(false); Build.VERSION.SDK_INT=36; Context c=new Context();
        RelayConfig.start(c,"https://relay.example","synthetic-token-first");
        new RelayConfig(c).updatePull(c,ALLOW,true,false); RelayConfig.callConsent(c,true); return c;
    }
    private static CallPolicy.Event event(Context c,String phone) {
        CallPolicy.State s=CallConsent.state(c);
        return CallPolicy.Event.observed(phone,System.currentTimeMillis(),s.generation,s.epoch,s.boundary);
    }
    private static void flags() {
        Context c=new Context(); check(!new RelayConfig(c).callOptIn&&!new RelayConfig(c).callEnabled&&!new RelayConfig(c).callIncludeUnknown,"all defaults false");
        RelayConfig.start(c,"https://relay.example","synthetic-token-first");
        for(Object[] invalid:new Object[][]{{null,null},{"true",false},{true,"false"},{1,false},{true,0},{JSONObject.NULL,false}}) {
            RelayConfig snapshot=new RelayConfig(c);snapshot.updatePull(c,ALLOW,invalid[0],invalid[1]);
            RelayConfig after=new RelayConfig(c);
            check(!after.callEnabled&&!after.callIncludeUnknown,"strict JSON booleans fail closed");
            check(after.enabled&&after.hashes.equals(ALLOW),"invalid call settings preserve SMS pull");
        }
        new RelayConfig(c).updatePull(c,ALLOW,true,false); check(!new RelayConfig(c).callOptIn,"server flags never imply local consent");
        RelayConfig.callConsent(c,true); CallPolicy.Event e=event(c,PHONE);
        check(CallConsent.state(c).accepts(e),"known call accepted with two consents");
        check(!CallConsent.state(c).accepts(event(c,OTHER)),"unknown default denied");
        new RelayConfig(c).updatePull(c,ALLOW,true,true); check(CallConsent.state(c).accepts(event(c,OTHER)),"unknown needs explicit true");
        new RelayConfig(c).updatePull(c,Collections.emptySet(),true,false); check(!CallConsent.state(c).accepts(e),"latest allowlist removal rejects queue");
        new RelayConfig(c).updatePull(c,ALLOW,false,false);new RelayConfig(c).updatePull(c,ALLOW,true,false);
        check(!CallConsent.state(c).accepts(e),"server disable/re-enable cannot revive old epoch");
        e=event(c,PHONE); RelayConfig.callConsent(c,false);RelayConfig.callConsent(c,true);
        check(!CallConsent.state(c).accepts(e),"local consent disable/re-enable cannot revive old epoch");
        e=event(c,PHONE);c.role.held=false;check(!CallConsent.state(c).consent&&!new RelayConfig(c).callOptIn,"role loss clears local consent");
        c.role.held=true;check(!CallConsent.state(c).accepts(e),"regaining role never opts in implicitly");
        RelayConfig.callConsent(c,true);e=event(c,PHONE);RelayConfig.stop(c,"test stop");RelayConfig.start(c,"https://relay.example","synthetic-token-second");
        check(!new RelayConfig(c).callOptIn&&!CallConsent.state(c).accepts(e),"new connection has fresh consent/generation");
        RelayConfig old=new RelayConfig(c); RelayConfig.stop(c,"rotate");RelayConfig.start(c,"https://relay.example","synthetic-token-third");
        check(!old.updatePull(c,ALLOW,true,true)&&!new RelayConfig(c).callEnabled,"stale pull cannot mutate newer connection");
        c.preferences.values.put("callEnabled","true");check(!new RelayConfig(c).callEnabled&&new RelayConfig(c).enabled,"malformed persisted call settings isolate SMS");
        check(CallPolicy.phone("123456789")==null&&CallPolicy.phone("anonymous")==null,"invalid/non-Korean phones ignored");
    }
    private static void immediateAllow() {
        Context c=setup();StudioCallScreeningService service=new StudioCallScreeningService();service.shareFrom(c);
        Call.Details incoming=new Call.Details("tel:+82 10 0000 0000",System.currentTimeMillis());
        Trace.reset(true);service.onScreenCall(incoming);
        check(Trace.responses==1&&"allow".equals(Trace.order.get(0)),"allow first, before preferences/role/sqlite/schedule");
        Trace.requireAllow=false;RelayStore store=new RelayStore(c);CallPolicy.Event first=store.calls(new RelayConfig(c).generation).get(0);
        check(PHONE.equals(first.phone),"normalized incoming metadata persisted after allow");
        Trace.reset(true);service.onScreenCall(incoming);Trace.requireAllow=false;
        check(store.calls(new RelayConfig(c).generation).size()==1,"repeated OS callback preserves one identity");
        check(store.calls(new RelayConfig(c).generation).get(0).receivedAt==incoming.created,"original receivedAt preserved");
        for(int kind=0;kind<7;kind++) {
            Call.Details d=new Call.Details("tel:"+PHONE,System.currentTimeMillis()+100+kind);
            if(kind==0)d.presentation=2;if(kind==1)d.presentation=3;if(kind==2)d.handle=null;
            if(kind==3)d.handle=android.net.Uri.parse("sip:01000000000");if(kind==4)d.handle=android.net.Uri.parse("tel:123");
            if(kind==5)d.created=1;if(kind==6)d.created=System.currentTimeMillis()+600000;
            Trace.reset(true);service.onScreenCall(d);Trace.requireAllow=false;
            check(Trace.responses==1&&store.calls(new RelayConfig(c).generation).size()==1,"hidden/invalid/unlisted/history/future still allow, never persist");
        }
        Call.Details outgoing=new Call.Details("tel:"+PHONE,System.currentTimeMillis());outgoing.direction=2;
        Trace.reset(true);service.onScreenCall(outgoing);Trace.requireAllow=false;
        check(Trace.responses==0&&Trace.order.isEmpty(),"outgoing ignored without preferences/storage/network");
        RelayConfig.callConsent(c,false);Trace.reset(true);service.onScreenCall(incoming);Trace.requireAllow=false;
        check(Trace.responses==1&&store.calls(new RelayConfig(c).generation).size()==1,"declining consent never blocks calls");
        Build.VERSION.SDK_INT=26;Trace.reset(true);service.onScreenCall(incoming);Trace.requireAllow=false;
        check(Trace.responses==1&&Trace.order.equals(Arrays.asList("allow")),"API26 allow only, no API29 method or role/storage access");
        Build.VERSION.SDK_INT=36;
    }
    private static final class Journal implements CallForwarder.Journal {
        final Map<String,CallPolicy.Event> rows=new LinkedHashMap<>();
        Journal(CallPolicy.Event e){rows.put(e.id,e);}public List<CallPolicy.Event> pending(){return new ArrayList<>(rows.values());}
        public void retire(String id){rows.remove(id);}
    }
    private static void retries() throws Exception {
        Context c=setup();CallPolicy.Event e=event(c,PHONE);Journal j=new Journal(e);List<CallPolicy.Event> received=new ArrayList<>();
        for(int status:new int[]{500,429,404}) {
            check(CallForwarder.flush(()->CallConsent.state(c),j,x->{received.add(x);throw new CallForwarder.Failure(status);}),"transient/old endpoint retains retry");
            check(j.rows.get(e.id)==e,"retry retains exact identity/payload");
        }
        check(!CallForwarder.flush(()->CallConsent.state(c),j,x->received.add(x)),"successful retry retires event");
        check(received.size()==4&&received.stream().allMatch(x->x==e),"new forwarder invocations replay immutable event");
        check(!CallForwarder.flush(()->CallConsent.state(c),j,x->{throw new AssertionError("duplicate upload");}),"completed event never sent twice");
        for(int status:new int[]{400,409,413}) {
            Journal invalid=new Journal(e);check(!CallForwarder.flush(()->CallConsent.state(c),invalid,x->{throw new CallForwarder.Failure(status);}),"permanent rejection retired without changing payload");
        }
        for(int status:new int[]{401,403}) {
            Journal auth=new Journal(e);try{CallForwarder.flush(()->CallConsent.state(c),auth,x->{throw new CallForwarder.Failure(status);});throw new AssertionError("auth hidden");}
            catch(CallForwarder.Failure failure){check(failure.status==status&&auth.rows.size()==1,"auth failure surfaced for generation-bound stop");}
        }
        Journal deferred=new Journal(e);try{CallForwarder.flush(()->{throw new Exception("job cancelled");},deferred,x->{throw new AssertionError();});}
        catch(Exception expected){check(deferred.rows.size()==1,"cancelled job does not discard valid queue");}
        RelayConfig.callConsent(c,false);Journal disabled=new Journal(e);
        check(!CallForwarder.flush(()->CallConsent.state(c),disabled,x->{throw new AssertionError();}),"consent revoked before dispatch drops queue");
    }
    private static JSONObject pull(Object enabled,Object unknown,boolean include) {
        JSONObject response=new JSONObject().put("allowedPhoneHashes",new JSONArray().put(RelayPolicy.hash(PHONE))).put("messages",new JSONArray());
        if(include)response.put("callIntake",new JSONObject().put("enabled",enabled).put("includeUnknown",unknown));return response;
    }
    private static void engine() {
        for(int mode=0;mode<5;mode++) {
            Context c=setup();RelayStore store=new RelayStore(c);CallPolicy.Event e=event(c,PHONE);store.enqueueCall(e);
            List<JSONObject> bodies=new ArrayList<>();final int m=mode;RelayHttp.routes.clear();
            RelayHttp.handler=(snapshot,route,body)->{
                if(route.equals("/device/pull"))return pull(m!=2,m==2?"false":false,m!=1);
                if(route.equals("/device/call")) {
                    bodies.add(body);
                    if(m==3)throw new RelayHttp.Failure(500);
                    if(m==4){RelayConfig.stop(c,"rotate while old call in flight");RelayConfig.start(c,"https://relay.example","synthetic-new-token");throw new RelayHttp.Failure(401);}
                }
                return new JSONObject();
            };
            boolean retry=new RelayEngine(c,new AtomicBoolean(),store).run();
            if(m==1||m==2)check(bodies.isEmpty()&&!new RelayConfig(c).callEnabled&&store.calls(e.generation).isEmpty(),"old/malformed pull disables and drops calls, SMS pull remains active");
            else {
                check(bodies.size()==1,"production engine dispatches exactly one call");JSONObject body=bodies.get(0);
                check(body.values.keySet().equals(new HashSet<>(Arrays.asList("id","phone","receivedAt","direction")))&&"incoming".equals(body.getString("direction")),"exact API body, no SMS text/calendar/name/token");
                check(body.getString("id").equals(e.id)&&body.getLong("receivedAt")==e.receivedAt,"durable identity/timestamp reaches engine API");
                if(m==3)check(retry&&store.calls(e.generation).size()==1,"engine call500 preserves retry, connection active");
                if(m==4)check(new RelayConfig(c).enabled&&"synthetic-new-token".equals(new RelayConfig(c).token)&&!new RelayConfig(c).callOptIn,"old-generation call401 cannot stop newer token or opt it in");
            }
            check(!RelayHttp.routes.contains("/device/event")&&!RelayHttp.routes.contains("/device/claim"),"call never becomes SMS reply or claim");
        }
        Context c=setup();RelayStore store=new RelayStore(c);CallPolicy.Event e=event(c,PHONE);store.enqueueCall(e);AtomicBoolean cancel=new AtomicBoolean();
        RelayHttp.handler=(snapshot,route,body)->{cancel.set(true);return pull(true,false,true);};
        new RelayEngine(c,cancel,store).run();check(store.calls(e.generation).size()==1,"cancelled engine retains original event");
    }
    private static void browser() {
        Context c=new Context();check(ManagementLauncher.open(c),"management launches default browser Custom Tab");
        Intent tab=c.launches.get(0);check(ManagementLauncher.URL.equals(tab.data.toString())&&"owner.browser".equals(tab.chosenPackage),"fixed HTTPS management in owner's browser");
        check(tab.extras.size()==1&&tab.extras.containsKey("android.support.customtabs.extra.SESSION")&&tab.extras.get("android.support.customtabs.extra.SESSION")==null,"regular session only, no keys/cookies/ephemeral flags");
        c.launches.clear();c.failTab=true;check(ManagementLauncher.openPrivacy(c)&&c.launches.size()==2,"Custom Tab failure falls back to browser");
        Intent fallback=c.launches.get(1);check(ManagementLauncher.PRIVACY_URL.equals(fallback.data.toString())&&fallback.extras.isEmpty()&&fallback.chosenPackage==null,"privacy fallback fixed URL with no credential payload");
        c.launches.clear();c.packages.tab=false;c.failTab=false;check(ManagementLauncher.open(c)&&c.launches.size()==1&&c.launches.get(0).extras.isEmpty(),"no Custom Tab provider uses ordinary browser");
        c.failBrowser=true;check(!ManagementLauncher.open(c),"missing browser reported without crash");
    }
    public static void main(String[] args)throws Exception {
        flags();immediateAllow();retries();engine();browser();
        System.out.println("PASS NativeCallTest: "+checks+" synthetic config, consent, allow-order, queue, engine and browser assertions");
    }
}
