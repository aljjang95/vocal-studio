// Synthetic Android/transport/storage surfaces. Never used by the APK.
export const stubs = {
'android/Manifest.java': `package android;
public final class Manifest { public static final class permission {
 public static final String READ_SMS="read", RECEIVE_SMS="receive", SEND_SMS="send";
} }`,
'android/content/SharedPreferences.java': `package android.content;
import java.util.Set;
public interface SharedPreferences {
 String getString(String k,String d); long getLong(String k,long d); boolean getBoolean(String k,boolean d); Set<String> getStringSet(String k,Set<String> d); Editor edit();
 interface Editor { Editor putString(String k,String v); Editor putLong(String k,long v); Editor putBoolean(String k,boolean v); Editor putStringSet(String k,Set<String> v); Editor remove(String k); boolean commit(); }
}`,
'android/content/Context.java': `package android.content;
import java.util.*; import android.content.pm.*; import com.tllhouse.hlbreplay.Trace;
public class Context {
 public static final int MODE_PRIVATE=0; public boolean permissionGranted=true;
 public Memory preferences=new Memory(); public android.app.role.RoleManager role=new android.app.role.RoleManager();
 public PackageManager packages=new PackageManager(); public List<Intent> launches=new ArrayList<>(); public boolean failTab,failBrowser;
 public void shareFrom(Context c){preferences=c.preferences;role=c.role;}
 public SharedPreferences getSharedPreferences(String n,int mode){Trace.io("preferences");return preferences;}
 public int checkSelfPermission(String p){Trace.io("permission");return permissionGranted?0:-1;}
 @SuppressWarnings("unchecked") public <T> T getSystemService(Class<T> type){Trace.io("role");return type==android.app.role.RoleManager.class?(T)role:null;}
 public String getPackageName(){return "com.tllhouse.hlbreplay";}
 public PackageManager getPackageManager(){return packages;}
 public void startActivity(Intent i){launches.add(i);if(i.extras.containsKey("android.support.customtabs.extra.SESSION")?failTab:failBrowser)throw new RuntimeException();}
 public ContentResolver getContentResolver(){Trace.io("provider");return new ContentResolver();}
 public static final class Memory implements SharedPreferences {
  public final Map<String,Object> values=new HashMap<>();
  public String getString(String k,String d){return (String)values.getOrDefault(k,d);}
  public long getLong(String k,long d){return (Long)values.getOrDefault(k,d);}
  public boolean getBoolean(String k,boolean d){return (Boolean)values.getOrDefault(k,d);}
  @SuppressWarnings("unchecked") public Set<String> getStringSet(String k,Set<String> d){return new HashSet<>((Set<String>)values.getOrDefault(k,d));}
  public Editor edit(){return new Editor(){
   final Map<String,Object> next=new HashMap<>(values);
   public Editor putString(String k,String v){next.put(k,v);return this;}
   public Editor putLong(String k,long v){next.put(k,v);return this;}
   public Editor putBoolean(String k,boolean v){next.put(k,v);return this;}
   public Editor putStringSet(String k,Set<String> v){next.put(k,new HashSet<>(v));return this;}
   public Editor remove(String k){next.remove(k);return this;}
   public boolean commit(){values.clear();values.putAll(next);return true;}
  };}
 }
}`,
'android/content/Intent.java': `package android.content;
import java.util.*; import android.net.Uri; import android.os.Bundle;
public class Intent {
 public static final String ACTION_VIEW="android.intent.action.VIEW", CATEGORY_BROWSABLE="android.intent.category.BROWSABLE";
 public String action,chosenPackage; public Uri data; public Map<String,Object> extras=new HashMap<>(); public Set<String> categories=new HashSet<>();
 public Intent(String a){action=a;} public Intent(String a,Uri u){action=a;data=u;} public Intent(Context c,Class<?> k){}
 public Intent addCategory(String c){categories.add(c);return this;} public Intent setPackage(String p){chosenPackage=p;return this;}
 public Intent putExtras(Bundle b){extras.putAll(b.values);return this;} public Intent setAction(String a){action=a;return this;}
 public Intent setData(Uri u){data=u;return this;} public Intent putExtra(String k,String v){extras.put(k,v);return this;}
 public Intent putExtra(String k,int v){extras.put(k,v);return this;}
}`,
'android/content/ContentResolver.java': `package android.content;
import android.database.Cursor; import android.net.Uri;
public class ContentResolver { public Cursor query(Uri u,String[] p,String s,String[] a,String o){return new Cursor();} }`,
'android/content/pm/PackageManager.java': `package android.content.pm;
import android.content.Intent;
public class PackageManager {
 public static final int PERMISSION_GRANTED=0; public boolean tab=true,browser=true;
 public ResolveInfo resolveActivity(Intent i,int flags){if(!browser)return null;ResolveInfo r=new ResolveInfo();r.activityInfo=new ActivityInfo();r.activityInfo.packageName="owner.browser";return r;}
 public ResolveInfo resolveService(Intent i,int flags){return tab?new ResolveInfo():null;}
}`,
'android/content/pm/ResolveInfo.java': `package android.content.pm; public class ResolveInfo { public ActivityInfo activityInfo; }`,
'android/content/pm/ActivityInfo.java': `package android.content.pm; public class ActivityInfo { public String packageName; }`,
'android/database/Cursor.java': `package android.database;
public class Cursor implements AutoCloseable { public boolean moveToNext(){return false;} public String getString(int i){return "";} public long getLong(int i){return 0;} public int getInt(int i){return 0;} public void close(){} }`,
'android/os/Build.java': `package android.os; public class Build { public static class VERSION { public static int SDK_INT=36; } }`,
'android/os/SystemClock.java': `package android.os; public class SystemClock { public static long elapsedRealtime(){return System.nanoTime()/1000000;} }`,
'android/os/Bundle.java': `package android.os; import java.util.*; public class Bundle { public Map<String,Object> values=new HashMap<>(); public void putBinder(String k,Object v){values.put(k,v);} }`,
'android/net/Uri.java': `package android.net;
public class Uri { private String value; private Uri(String s){value=s;} public static Uri parse(String s){return new Uri(s);}
 public String getScheme(){int p=value.indexOf(':');return p<0?null:value.substring(0,p);} public String getSchemeSpecificPart(){return value.substring(value.indexOf(':')+1);}
 public String toString(){return value;} public static class Builder { String value=""; public Builder scheme(String s){value=s+":";return this;} public Builder authority(String s){value+="//"+s;return this;} public Builder appendPath(String s){value+="/"+s;return this;} public Uri build(){return parse(value);} }
}`,
'android/app/role/RoleManager.java': `package android.app.role;
public class RoleManager { public static final String ROLE_CALL_SCREENING="screening"; public boolean available=true,held=true;
 public boolean isRoleAvailable(String r){return available;} public boolean isRoleHeld(String r){return held;} }`,
'android/telecom/Call.java': `package android.telecom; import android.net.Uri;
public class Call { public static class Details {
 public static final int DIRECTION_INCOMING=1,DIRECTION_OUTGOING=2; public int direction=1,presentation=1; public Uri handle; public long created;
 public Details(String p,long t){handle=p==null?null:Uri.parse(p);created=t;}
 public int getCallDirection(){return direction;} public int getHandlePresentation(){return presentation;} public Uri getHandle(){return handle;} public long getCreationTimeMillis(){return created;}
} }`,
'android/telecom/TelecomManager.java': `package android.telecom; public class TelecomManager { public static final int PRESENTATION_ALLOWED=1,PRESENTATION_RESTRICTED=2,PRESENTATION_UNKNOWN=3; }`,
'android/telecom/CallScreeningService.java': `package android.telecom;
import com.tllhouse.hlbreplay.Trace;
public abstract class CallScreeningService extends android.content.Context {
 public abstract void onScreenCall(Call.Details d);
 public final void respondToCall(Call.Details d,CallResponse r){Trace.allow(r);}
 public static class CallResponse { public boolean disallow,reject,silence,skipLog,skipNotification;
  public static class Builder { final CallResponse r=new CallResponse();
   public Builder setDisallowCall(boolean v){r.disallow=v;return this;} public Builder setRejectCall(boolean v){r.reject=v;return this;}
   public Builder setSilenceCall(boolean v){if(android.os.Build.VERSION.SDK_INT<29)throw new AssertionError("API29 used below29");r.silence=v;return this;}
   public Builder setSkipCallLog(boolean v){r.skipLog=v;return this;} public Builder setSkipNotification(boolean v){r.skipNotification=v;return this;}
   public CallResponse build(){return r;}
  }
 }
}`,
'org/json/JSONObject.java': `package org.json;
import java.util.*;
public class JSONObject { public final Map<String,Object> values=new LinkedHashMap<>(); public static final Object NULL=new Object();
 public JSONObject put(String k,Object v){values.put(k,v);return this;} public Object opt(String k){return values.get(k);}
 public JSONObject optJSONObject(String k){Object v=opt(k);return v instanceof JSONObject?(JSONObject)v:null;}
 public JSONArray getJSONArray(String k){return (JSONArray)values.get(k);} public JSONObject getJSONObject(String k){return (JSONObject)values.get(k);}
 public String getString(String k){return (String)values.get(k);} public long getLong(String k){return ((Number)values.get(k)).longValue();}
 public String toString(){return values.toString();}
}`,
'org/json/JSONArray.java': `package org.json;
import java.util.*;
public class JSONArray { public final List<Object> values=new ArrayList<>(); public JSONArray put(Object o){values.add(o);return this;}
 public int length(){return values.size();} public String getString(int i){return (String)values.get(i);} public JSONObject getJSONObject(int i){return (JSONObject)values.get(i);}
}`,
'com/tllhouse/hlbreplay/RelayScheduler.java': `package com.tllhouse.hlbreplay;
import android.content.Context;
final class RelayScheduler { static int cancellations,scheduled; static void cancel(Context c){cancellations++;} static void soon(Context c){Trace.io("schedule");scheduled++;} }`,
'com/tllhouse/hlbreplay/SentResultReceiver.java': `package com.tllhouse.hlbreplay; public class SentResultReceiver {}`,
'com/tllhouse/hlbreplay/Trace.java': `package com.tllhouse.hlbreplay;
import java.util.*; import android.telecom.CallScreeningService.CallResponse;
public final class Trace { public static boolean requireAllow; public static int responses; public static List<String> order=new ArrayList<>();
 public static void io(String operation){if(requireAllow && responses==0)throw new AssertionError("I/O before allow: "+operation);order.add(operation);}
 public static void allow(CallResponse r){if(r.disallow||r.reject||r.silence||r.skipLog||r.skipNotification)throw new AssertionError("call changed");responses++;order.add("allow");}
 public static void reset(boolean guard){responses=0;order.clear();requireAllow=guard;}
}`,
'com/tllhouse/hlbreplay/RelayStore.java': `package com.tllhouse.hlbreplay;
import java.util.*; import android.content.Context; import org.json.JSONObject;
final class RelayStore implements AutoCloseable {
 static final Map<Object,Map<String,CallPolicy.Event>> journals=new HashMap<>(); final Map<String,CallPolicy.Event> queue;
 RelayStore(Context c){Trace.io("sqlite");queue=journals.computeIfAbsent(c.preferences,k->new LinkedHashMap<>());}
 void enqueueCall(CallPolicy.Event e){Trace.io("persist");queue.putIfAbsent(e.id,e);} List<CallPolicy.Event> calls(String g){List<CallPolicy.Event> l=new ArrayList<>();for(CallPolicy.Event e:queue.values())if(e.generation.equals(g))l.add(e);return l;}
 void callDone(String id){queue.remove(id);} public void close(){}
 void recoverUncertain(RelayConfig c){} List<JSONObject> acks(RelayConfig c){return new ArrayList<>();} void ackDone(String s){} void ackRejected(String s){}
 List<JSONObject> events(RelayConfig c){return new ArrayList<>();} boolean pendingEvents(RelayConfig c){return false;} void eventDone(String s){}
 void enqueue(RelayConfig c,String p,String b,long d,String direction,long at){}
 boolean reserve(RelayConfig c,SendCoordinator.Message m){return true;} boolean started(String id,int count){return true;} void finish(String id,String state,String error){}
}`,
'com/tllhouse/hlbreplay/RelayHttp.java': `package com.tllhouse.hlbreplay;
import java.util.*; import org.json.JSONObject;
final class RelayHttp {
 static final class Failure extends Exception { final int status; Failure(int s){status=s;} }
 interface Handler { JSONObject request(RelayConfig c,String route,JSONObject body) throws Exception; }
 static Handler handler; static final List<String> routes=new ArrayList<>(); final RelayConfig config;
 RelayHttp(RelayConfig c){config=c;} JSONObject request(String route,JSONObject body)throws Exception{Trace.io("http");routes.add(route);return handler.request(config,route,body);}
}`
};
