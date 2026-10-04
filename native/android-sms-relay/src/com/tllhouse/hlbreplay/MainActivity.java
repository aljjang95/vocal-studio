package com.tllhouse.hlbreplay;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.role.RoleManager;
import android.content.ClipData;
import android.content.ClipDescription;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.ContentObserver;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.provider.Telephony;
import android.text.InputType;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.text.DateFormat;
import java.util.Date;

public final class MainActivity extends Activity {
    private static final String DIAGNOSTIC_STATE="hlb.connectionDiagnostic";
    private EditText url,token;
    private TextView status,callStatus;
    private Button connect,stop,paste,callEnable,callDisable,contacts;
    private ContentObserver observer;
    private String permissionGeneration,permissionConfigOrigin,permissionOrigin,permissionToken;
    private boolean foreground;
    // Status keeps only non-secret config identity. Permission continuation is memory-only,
    // as before: one explicit start request, never saved/restored, consumed once below.
    private String localStatus,localGeneration,localOrigin,localSavedStatus;
    private boolean localEnabled;
    private long localLastSync;
    private int localInput; // 1: URL correction, 2: key correction, 0: explicit retry/config change.
    private String roleRequestGeneration;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Runnable refresh=new Runnable() { public void run() { showState(); handler.postDelayed(this,2000); } };
    private int dp(int value) { return Math.round(value*getResources().getDisplayMetrics().density); }
    private void label(LinearLayout layout,String text,int size) {
        TextView view=new TextView(this); view.setText(text); view.setTextSize(size); view.setPadding(0,dp(12),0,dp(6)); layout.addView(view);
    }
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved); getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        ScrollView scroll=new ScrollView(this); LinearLayout layout=new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(24),dp(20),dp(24),dp(24)); scroll.addView(layout); setContentView(scroll);
        scroll.setOnApplyWindowInsetsListener((v,insets)-> {
            if(android.os.Build.VERSION.SDK_INT>=30) {
                android.graphics.Insets bars=insets.getInsets(android.view.WindowInsets.Type.systemBars()|android.view.WindowInsets.Type.ime());
                v.setPadding(bars.left,bars.top,bars.right,bars.bottom);
            } else v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        label(layout,"HLB 스튜디오",26);
        Button management=new Button(this); management.setText("스튜디오 관리 열기"); layout.addView(management);
        management.setOnClickListener(v->{ if(!ManagementLauncher.open(this)) status.setText("브라우저를 사용할 수 없습니다. 기본 브라우저를 확인해 주세요."); });
        Button privacy=new Button(this); privacy.setText("개인정보 처리방침"); layout.addView(privacy);
        privacy.setOnClickListener(v->{ if(!ManagementLauncher.openPrivacy(this)) status.setText("브라우저를 사용할 수 없습니다. 기본 브라우저를 확인해 주세요."); });
        label(layout,"소유자 휴대폰의 등록 번호 문자만 HLB에 연결합니다. 연결을 시작한 시각 이후의 표준 SMS만 처리합니다.",16);
        label(layout,"문자 읽기 · 수신 · 발송 권한이 필요합니다. 연락처와 다른 앱 알림은 읽지 않습니다.",15);
        label(layout,"HTTPS 연결 주소",16); url=new EditText(this); url.setSingleLine(true); url.setHint("https://…workers.dev");
        url.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI); url.setSaveEnabled(false);
        url.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS); layout.addView(url);
        label(layout,"연결키",16); token=new EditText(this); token.setSingleLine(true);
        token.setHint("스튜디오 관리 → 문자 일정에서 만든 연결키"); token.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD|InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        token.setSaveEnabled(false); token.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        token.setLongClickable(false); token.setTextIsSelectable(false); layout.addView(token);
        label(layout,"스튜디오 관리 → 문자 일정에서 만든 연결키를 사용해 주세요. 무선 디버깅 페어링 코드와 다릅니다.",15);
        paste=new Button(this); paste.setText("연결키 붙여넣기"); layout.addView(paste);
        paste.setOnClickListener(v->{
            if(!foreground || new RelayConfig(this).enabled) return;
            token.setText("");
            // Clipboard access happens only here, after the owner's foreground tap.
            try {
                ClipboardManager clipboard=(ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
                ClipData clip=clipboard==null ? null : clipboard.getPrimaryClip();
                if(clip==null) { localStatus("복사된 연결키가 없습니다. 문자 일정에서 연결키를 복사한 뒤 다시 눌러 주세요.",2); return; }
                if(clip.getItemCount()!=1 || !clip.getDescription().hasMimeType(ClipDescription.MIMETYPE_TEXT_PLAIN)) {
                    localStatus("연결키 텍스트 하나만 붙여넣을 수 있습니다. 문자 일정에서 연결키를 다시 복사해 주세요.",2); return;
                }
                ClipData.Item item=clip.getItemAt(0);
                if(item.getUri()!=null || item.getIntent()!=null || item.getText()==null) {
                    localStatus("연결키 텍스트만 붙여넣을 수 있습니다. 파일·링크 공유 대신 연결키를 복사해 주세요.",2); return;
                }
                String raw=item.getText().toString();
                if(!validKey(raw)) { keyError(raw.isEmpty()); return; }
                token.setText(raw);
                if(localInput!=1) clearLocalStatus();
                showState();
            } catch(Exception e) { localStatus("클립보드를 읽지 못했습니다. 앱 화면에서 연결키 붙여넣기를 다시 눌러 주세요.",2); }
        });
        watchInput(url,1); watchInput(token,2);
        connect=new Button(this); connect.setText("연결 시작"); layout.addView(connect); connect.setOnClickListener(v->start());
        stop=new Button(this); stop.setText("연결 중지"); layout.addView(stop); stop.setOnClickListener(v->{
            token.setText(""); clearPermissionRequest(); clearLocalStatus();
            try { RelayConfig.stop(this,"연결을 중지했습니다"); showState(); }
            catch(Exception e) { localStatus("중지 상태를 저장하지 못했습니다. 앱을 강제 종료한 뒤 확인해 주세요.",0); }
        });
        status=new TextView(this); status.setTextSize(16); status.setPadding(0,dp(16),0,dp(12)); layout.addView(status);
        label(layout,"수신 전화 확인 · 선택 사항",20);
        label(layout,"Android 10 이상에서 이 앱을 전화 식별 앱으로 선택할 수 있습니다. 기존 전화 식별 제공자가 변경되며, 모든 전화는 차단·무음 처리 없이 그대로 허용합니다. 통화 녹음이나 과거 통화 기록은 읽지 않습니다.",15);
        label(layout,"휴대폰 동의와 스튜디오 관리의 수신 전화 설정이 모두 켜진 뒤의 번호·수신 시각만 전송합니다. 기본은 등록 번호만이며, 모르는 번호는 관리 화면에서 별도로 허용해야 합니다. 전화가 문자 답장이나 예약으로 처리되지는 않습니다.",15);
        callEnable=new Button(this); callEnable.setText("수신 전화 연결에 동의하기"); layout.addView(callEnable);
        callEnable.setOnClickListener(v->requestCallConsent());
        callDisable=new Button(this); callDisable.setText("수신 전화 연결 끄기"); layout.addView(callDisable);
        callDisable.setOnClickListener(v->{
            roleRequestGeneration=null;
            try { RelayConfig.callConsent(this,false); RelayScheduler.soon(this); showState(); }
            catch(Exception e) { callStatus.setText("전화 연결 해제 상태를 저장하지 못했습니다. 다시 확인해 주세요."); }
        });
        label(layout,"저장된 연락처의 전화도 받으려면 선택적으로 연락처 권한을 허용해 주세요. Android가 해당 전화를 이 앱에 전달하도록 하는 용도이며, 앱은 연락처를 조회하거나 업로드하지 않습니다. 거절하면 저장된 연락처의 전화는 전달되지 않을 수 있습니다. 문자 연결과 관리 화면은 계속 사용할 수 있습니다.",15);
        contacts=new Button(this); contacts.setText("저장된 연락처 전화 전달 허용 · 선택"); layout.addView(contacts);
        contacts.setOnClickListener(v->new AlertDialog.Builder(this).setTitle("연락처 권한 사용 안내")
            .setMessage("Android가 저장된 연락처의 수신 전화를 전달하도록 READ_CONTACTS 권한을 요청합니다. 연락처 목록을 읽거나 업로드하지 않습니다. 거절해도 문자와 스튜디오 관리를 사용할 수 있습니다.")
            .setNegativeButton("사용하지 않기",null).setPositiveButton("권한 선택하기",(dialog,which)->
                requestPermissions(new String[]{Manifest.permission.READ_CONTACTS},44)).show());
        Button roleSettings=new Button(this); roleSettings.setText("전화 식별 앱 설정 열기"); layout.addView(roleSettings);
        roleSettings.setOnClickListener(v->{
            try { startActivity(new Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)); }
            catch(Exception e) { callStatus.setText("기본 앱 설정에서 전화 식별 앱을 선택해 주세요."); }
        });
        callStatus=new TextView(this); callStatus.setTextSize(15); layout.addView(callStatus);
        label(layout,"약 15분 간격으로 확인하며 수신 문자에는 추가 작업을 요청합니다. 절전·네트워크 상태에 따라 Android가 실행을 늦출 수 있어 정각 발송을 보장하지 않습니다.",15);
        label(layout,"휴대폰의 기본 문자 발신 SIM을 선택해 주세요. 중지해도 이미 통신사에 넘긴 문자는 취소할 수 없습니다. 발송 결과가 불확실한 문자는 자동으로 다시 보내지 않습니다.",15);
        label(layout,"Google·Samsung RCS 채팅과 MMS는 연결 대상에 포함되지 않습니다. 표준 SMS 저장소에 들어오는지는 실제 기기 확인이 필요합니다.",15);
        label(layout,"권한 화면에서 문자 권한을 허용할 수 없다면 설치 경로의 제한을 확인해야 합니다. 권한을 우회하지 않습니다.",15);
        Button permissions=new Button(this); permissions.setText("앱 권한 설정 열기"); layout.addView(permissions);
        permissions.setOnClickListener(v->startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,android.net.Uri.parse("package:"+getPackageName()))));
        RelayConfig config=new RelayConfig(this); url.setText(config.origin.isEmpty() ? RelayConfig.DEFAULT_ORIGIN : config.origin);
        observer=new ContentObserver(handler) { @Override public void onChange(boolean selfChange) { RelayScheduler.soon(MainActivity.this); } };
        // Populating the default URL is not an owner's correction of the saved error.
        restoreDiagnostic(saved);
        showState();
    }
    private static boolean validKey(String raw) {
        // Exact deviceBearer/entry contract; do not trim or repair corrupted drafts.
        return raw!=null && raw.matches("vssms_[A-Za-z0-9_-]{43}");
    }
    private void keyError(boolean empty) {
        localStatus((empty ? "연결키를 입력하거나 붙여넣어 주세요. " : "연결키 형식이 올바르지 않습니다. 공백·줄바꿈 없이 다시 복사해 주세요. ")
            +"스튜디오 관리 → 문자 일정에서 만든 연결키를 사용해 주세요. 무선 디버깅 페어링 코드와 다릅니다.",2);
    }
    private void clearLocalStatus() { localStatus=null; localInput=0; }
    private void clearPermissionRequest() {
        permissionGeneration=null; permissionConfigOrigin=null; permissionOrigin=null; permissionToken=null;
    }
    private void localStatus(String message,int input) {
        RelayConfig c=new RelayConfig(this);
        android.content.SharedPreferences p=getSharedPreferences("relay_private",MODE_PRIVATE);
        localStatus=message; localInput=input; localGeneration=c.generation; localOrigin=c.origin; localEnabled=c.enabled;
        localSavedStatus=p.getString("status","연결 중지됨"); localLastSync=p.getLong("lastSync",0);
        showState();
    }
    private boolean diagnosticCurrent(RelayConfig c,android.content.SharedPreferences p) {
        return localStatus!=null && c.generation.equals(localGeneration) && c.origin.equals(localOrigin)
            && c.enabled==localEnabled && p.getLong("lastSync",0)==localLastSync
            && p.getString("status","연결 중지됨").equals(localSavedStatus);
    }
    @Override protected void onSaveInstanceState(Bundle saved) {
        super.onSaveInstanceState(saved);
        saved.remove(DIAGNOSTIC_STATE);
        RelayConfig c=new RelayConfig(this);
        android.content.SharedPreferences p=getSharedPreferences("relay_private",MODE_PRIVATE);
        if(!diagnosticCurrent(c,p)) { clearLocalStatus(); return; }
        // Only hardcoded diagnostic text and non-secret persisted config identity.
        // Never save either input field, a permission request, or clipboard/Intent data.
        Bundle diagnostic=new Bundle();
        diagnostic.putInt("version",1); diagnostic.putString("message",localStatus); diagnostic.putInt("input",localInput);
        diagnostic.putString("generation",localGeneration); diagnostic.putString("origin",localOrigin);
        diagnostic.putBoolean("enabled",localEnabled); diagnostic.putString("savedStatus",localSavedStatus);
        diagnostic.putLong("lastSync",localLastSync); saved.putBundle(DIAGNOSTIC_STATE,diagnostic);
    }
    private void restoreDiagnostic(Bundle saved) {
        if(saved==null) return;
        try {
            Bundle diagnostic=saved.getBundle(DIAGNOSTIC_STATE);
            if(diagnostic==null || diagnostic.getInt("version",0)!=1) return;
            String message=diagnostic.getString("message"),generation=diagnostic.getString("generation"),
                origin=diagnostic.getString("origin"),savedStatus=diagnostic.getString("savedStatus");
            int input=diagnostic.getInt("input",-1);
            if(message==null || generation==null || origin==null || savedStatus==null || input<0 || input>2) return;
            localStatus=message; localInput=input; localGeneration=generation; localOrigin=origin;
            localEnabled=diagnostic.getBoolean("enabled",false); localSavedStatus=savedStatus;
            localLastSync=diagnostic.getLong("lastSync",0);
            if(!diagnosticCurrent(new RelayConfig(this),getSharedPreferences("relay_private",MODE_PRIVATE))) clearLocalStatus();
        } catch(RuntimeException invalidState) { clearLocalStatus(); }
    }
    private void watchInput(EditText field,int input) {
        field.addTextChangedListener(new TextWatcher() {
            public void beforeTextChanged(CharSequence s,int start,int count,int after) {}
            public void onTextChanged(CharSequence s,int start,int before,int count) {}
            public void afterTextChanged(Editable value) {
                if(localStatus==null || localInput!=input) return;
                if(input==2) { if(!validKey(value.toString())) return; }
                else { try { RelayPolicy.origin(value.toString()); } catch(Exception e) { return; } }
                clearLocalStatus(); showState();
            }
        });
    }
    private void requestCallConsent() {
        if (android.os.Build.VERSION.SDK_INT<29 || !new RelayConfig(this).enabled) return;
        new AlertDialog.Builder(this).setTitle("수신 전화 연결에 동의하시겠어요?")
            .setMessage("HLB 스튜디오를 선택하면 휴대폰의 전화 식별 제공자가 이 앱으로 변경됩니다. 모든 전화는 그대로 울리며 차단·무음·기록 숨김을 하지 않습니다. 현재 연결 이후의 수신 번호와 시각을 설정에 따라 스튜디오로 전송합니다. 연락처 목록·통화 음성·과거 통화 기록은 수집하지 않습니다. 취소해도 문자와 관리 화면을 사용할 수 있습니다.")
            .setNegativeButton("취소",null).setPositiveButton("동의하고 전화 식별 앱 선택",(dialog,which)->{
                try {
                    RelayConfig current=new RelayConfig(this);
                    if (!current.active(this)) return;
                    RoleManager role=getSystemService(RoleManager.class);
                    if (role==null || !role.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) {
                        callStatus.setText("이 기기에서 전화 식별 역할을 사용할 수 없습니다."); return;
                    }
                    roleRequestGeneration=current.generation;
                    if (role.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) finishCallConsent();
                    else startActivityForResult(role.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING),43);
                } catch(Exception e) { roleRequestGeneration=null; callStatus.setText("전화 식별 앱 선택을 완료하지 못했습니다. 문자와 관리는 계속 사용할 수 있습니다."); }
            }).show();
    }
    private void finishCallConsent() {
        synchronized (RelayConfig.LOCK) {
            RelayConfig current=new RelayConfig(this);
            if (roleRequestGeneration!=null && roleRequestGeneration.equals(current.generation)
                && current.active(this) && CallConsent.held(this)) RelayConfig.callConsent(this,true);
            roleRequestGeneration=null;
        }
        RelayScheduler.soon(this); showState();
    }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if (request==43) {
            try {
                if (result==RESULT_OK) finishCallConsent();
                else { roleRequestGeneration=null; callStatus.setText("전화 식별 역할을 선택하지 않았습니다. 문자와 관리는 계속 사용할 수 있습니다."); }
            } catch(Exception e) { roleRequestGeneration=null; callStatus.setText("수신 전화 동의 상태를 다시 확인해 주세요."); }
        }
    }
    private void start() {
        String raw=token.getText().toString(); token.setText(""); clearPermissionRequest();
        if(new RelayConfig(this).enabled) { showState(); return; }
        clearLocalStatus();
        String origin;
        try { origin=RelayPolicy.origin(url.getText().toString()); }
        catch(Exception e) { localStatus("HTTPS 연결 주소를 확인해 주세요. 호스트 주소만 입력하며 경로·쿼리·사용자 정보와 443 이외의 포트는 사용할 수 없습니다.",1); return; }
        if(!validKey(raw)) { keyError(raw.isEmpty()); return; }
        if(!RelayConfig.permissions(this)) {
            RelayConfig c=new RelayConfig(this);
            permissionGeneration=c.generation; permissionConfigOrigin=c.origin; permissionOrigin=origin; permissionToken=raw;
            localStatus("문자 읽기·수신·발송 권한을 모두 허용해야 연결할 수 있습니다. 권한 선택을 완료해 주세요.",0);
            try { requestPermissions(new String[]{Manifest.permission.READ_SMS,Manifest.permission.RECEIVE_SMS,Manifest.permission.SEND_SMS},42); }
            catch(Exception e) { clearPermissionRequest(); localStatus("문자 권한 선택을 열지 못했습니다. 앱 권한 설정에서 문자 읽기·수신·발송 권한을 확인한 뒤 다시 시작해 주세요.",0); }
            return;
        }
        connect(origin,raw);
    }
    private void connect(String origin,String pairToken) {
        String stage="연결 설정을 저장하지 못했습니다. 연결키를 다시 입력한 뒤 연결 시작을 눌러 주세요.";
        try {
            RelayConfig.start(this,origin,pairToken);
            stage="백그라운드 연결 작업을 준비하지 못했습니다. 연결키를 다시 입력한 뒤 연결 시작을 눌러 주세요.";
            RelayScheduler.ensure(this); RelayScheduler.soon(this);
            stage="문자 수신 상태 확인을 준비하지 못했습니다. 문자 권한을 확인한 뒤 연결키를 다시 입력하고 시작해 주세요.";
            registerObserver(); clearLocalStatus(); showState();
        } catch(Exception e) {
            try { RelayConfig.stop(this,"연결 준비에 실패했습니다"); } catch(Exception ignored) {}
            localStatus(!RelayConfig.permissions(this) ? "문자 읽기·수신·발송 권한을 모두 허용해야 연결할 수 있습니다. 권한 확인 후 다시 시작해 주세요." : stage,0);
        }
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results) {
        super.onRequestPermissionsResult(request,permissions,results);
        if(request==42) {
            RelayConfig c=new RelayConfig(this);
            boolean current=permissionGeneration!=null && permissionGeneration.equals(c.generation)
                && c.origin.equals(permissionConfigOrigin) && !c.enabled;
            String origin=permissionOrigin,pairToken=permissionToken;
            clearPermissionRequest(); // Never retain a completed/denied/stale request or replay it.
            if(current) {
                if(RelayConfig.permissions(this) && origin!=null && validKey(pairToken)) connect(origin,pairToken);
                else localStatus("문자 읽기·수신·발송 권한을 모두 허용해야 연결할 수 있습니다. 앱 권한 설정을 확인한 뒤 다시 시작해 주세요.",0);
            }
        }
        if(request==44) {
            showState();
            if(checkSelfPermission(Manifest.permission.READ_CONTACTS)!=PackageManager.PERMISSION_GRANTED)
                callStatus.setText("연락처 권한 없이 계속합니다. 저장된 연락처의 전화는 Android가 전달하지 않을 수 있습니다. 문자와 관리는 사용할 수 있습니다.");
        }
    }
    private void registerObserver() {
        getContentResolver().unregisterContentObserver(observer);
        if(RelayConfig.permissions(this)) getContentResolver().registerContentObserver(Telephony.Sms.CONTENT_URI,true,observer);
    }
    private void showState() {
        RelayConfig c=new RelayConfig(this);
        android.content.SharedPreferences p=getSharedPreferences("relay_private",MODE_PRIVATE);
        long last=p.getLong("lastSync",0);
        String savedStatus=p.getString("status","연결 중지됨");
        if(localStatus!=null && !diagnosticCurrent(c,p)) clearLocalStatus();
        status.setText(localStatus!=null ? localStatus : savedStatus+(last>0 ? "\n최근 확인: "+DateFormat.getDateTimeInstance().format(new Date(last)) : ""));
        connect.setEnabled(!c.enabled); stop.setEnabled(c.enabled); url.setEnabled(!c.enabled); token.setEnabled(!c.enabled);
        paste.setEnabled(!c.enabled);
        boolean supported=android.os.Build.VERSION.SDK_INT>=29;
        callEnable.setEnabled(supported && c.enabled && !c.callOptIn);
        callDisable.setEnabled(c.callOptIn);
        boolean contactPermission=checkSelfPermission(Manifest.permission.READ_CONTACTS)==PackageManager.PERMISSION_GRANTED;
        contacts.setEnabled(supported && c.callOptIn && !contactPermission);
        callStatus.setText(!supported ? "Android 10 이상에서 수신 전화 연결을 선택할 수 있습니다."
            : !c.callOptIn ? "수신 전화 연결 꺼짐 · 문자 연결과 별도로 동의해 주세요."
            : !c.callEnabled ? "휴대폰 동의됨 · 관리 화면의 수신 전화 설정 확인 대기"
            : "수신 전화 연결 켜짐 · "+(c.callIncludeUnknown ? "모르는 번호 포함" : "등록 번호만")
                +(contactPermission ? " · 저장 연락처 전화 전달 허용" : " · 저장 연락처 전화는 전달되지 않을 수 있음"));
    }
    @Override public void onResume() {
        super.onResume(); foreground=true;
        try { CallConsent.state(this); registerObserver(); RelayScheduler.ensure(this); RelayScheduler.soon(this); } catch(Exception e) { localStatus("백그라운드 연결을 다시 확인해 주세요. 앱 권한을 확인하고 연결 시작 또는 앱 화면 복귀로 다시 시도해 주세요.",0); }
        handler.post(refresh);
    }
    @Override public void onPause() { foreground=false; handler.removeCallbacks(refresh); token.setText(""); super.onPause(); }
    @Override public void onDestroy() { clearPermissionRequest(); handler.removeCallbacks(refresh); getContentResolver().unregisterContentObserver(observer); super.onDestroy(); }
}
