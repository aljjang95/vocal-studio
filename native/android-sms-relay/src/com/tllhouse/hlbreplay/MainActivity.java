package com.tllhouse.hlbreplay;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.database.ContentObserver;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.provider.Telephony;
import android.text.InputType;
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
    private EditText url,token;
    private TextView status;
    private Button connect,stop;
    private ContentObserver observer;
    private String permissionOrigin,permissionToken;
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
        label(layout,"HLB 문자 연결",26);
        label(layout,"소유자 휴대폰의 등록 번호 문자만 HLB에 연결합니다. 연결을 시작한 시각 이후의 표준 SMS만 처리합니다.",16);
        label(layout,"문자 읽기 · 수신 · 발송 권한이 필요합니다. 연락처와 다른 앱 알림은 읽지 않습니다.",15);
        label(layout,"HTTPS 연결 주소",16); url=new EditText(this); url.setSingleLine(true); url.setHint("https://…workers.dev");
        url.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI); url.setSaveEnabled(false);
        url.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS); layout.addView(url);
        label(layout,"연결 토큰",16); token=new EditText(this); token.setSingleLine(true);
        token.setHint("HLB 설정에서 받은 토큰"); token.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD|InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        token.setSaveEnabled(false); token.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        token.setLongClickable(false); token.setTextIsSelectable(false); layout.addView(token);
        connect=new Button(this); connect.setText("연결 시작"); layout.addView(connect); connect.setOnClickListener(v->start());
        stop=new Button(this); stop.setText("연결 중지"); layout.addView(stop); stop.setOnClickListener(v->{
            try { RelayConfig.stop(this,"연결을 중지했습니다"); token.setText(""); showState(); }
            catch(Exception e) { status.setText("중지 상태를 저장하지 못했습니다. 앱을 강제 종료한 뒤 확인해 주세요."); }
        });
        status=new TextView(this); status.setTextSize(16); status.setPadding(0,dp(16),0,dp(12)); layout.addView(status);
        label(layout,"약 15분 간격으로 확인하며 수신 문자에는 추가 작업을 요청합니다. 절전·네트워크 상태에 따라 Android가 실행을 늦출 수 있어 정각 발송을 보장하지 않습니다.",15);
        label(layout,"휴대폰의 기본 문자 발신 SIM을 선택해 주세요. 중지해도 이미 통신사에 넘긴 문자는 취소할 수 없습니다. 발송 결과가 불확실한 문자는 자동으로 다시 보내지 않습니다.",15);
        label(layout,"Google·Samsung RCS 채팅과 MMS는 연결 대상에 포함되지 않습니다. 표준 SMS 저장소에 들어오는지는 실제 기기 확인이 필요합니다.",15);
        label(layout,"권한 화면에서 문자 권한을 허용할 수 없다면 설치 경로의 제한을 확인해야 합니다. 권한을 우회하지 않습니다.",15);
        Button permissions=new Button(this); permissions.setText("앱 권한 설정 열기"); layout.addView(permissions);
        permissions.setOnClickListener(v->startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,android.net.Uri.parse("package:"+getPackageName()))));
        RelayConfig config=new RelayConfig(this); url.setText(config.origin);
        observer=new ContentObserver(handler) { @Override public void onChange(boolean selfChange) { RelayScheduler.soon(MainActivity.this); } };
        showState();
    }
    private void start() {
        if(new RelayConfig(this).enabled) return;
        try { RelayPolicy.origin(url.getText().toString()); RelayPolicy.token(token.getText().toString()); }
        catch(Exception e) { status.setText("HTTPS 주소(경로 제외)와 연결 토큰을 확인해 주세요."); return; }
        if(!RelayConfig.permissions(this)) {
            permissionOrigin=RelayPolicy.origin(url.getText().toString()); permissionToken=RelayPolicy.token(token.getText().toString());
            requestPermissions(new String[]{Manifest.permission.READ_SMS,Manifest.permission.RECEIVE_SMS,Manifest.permission.SEND_SMS},42); return;
        }
        connect(RelayPolicy.origin(url.getText().toString()),RelayPolicy.token(token.getText().toString()));
    }
    private void connect(String origin,String pairToken) {
        try {
            RelayConfig.start(this,origin,pairToken);
            token.setText(""); RelayScheduler.ensure(this); RelayScheduler.soon(this); showState(); registerObserver();
        } catch(Exception e) {
            try { RelayConfig.stop(this,"연결 준비에 실패했습니다"); } catch(Exception ignored) {}
            status.setText("문자 권한과 기본 문자 SIM, 연결 정보를 확인해 주세요.");
        }
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results) {
        super.onRequestPermissionsResult(request,permissions,results);
        if(request==42) {
            if(RelayConfig.permissions(this) && permissionOrigin!=null && permissionToken!=null) connect(permissionOrigin,permissionToken);
            else status.setText("문자 읽기·수신·발송 권한을 모두 허용해야 연결할 수 있습니다.");
            permissionOrigin=null; permissionToken=null;
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
        status.setText(p.getString("status","연결 중지됨")+(last>0 ? "\n최근 확인: "+DateFormat.getDateTimeInstance().format(new Date(last)) : ""));
        connect.setEnabled(!c.enabled); stop.setEnabled(c.enabled); url.setEnabled(!c.enabled); token.setEnabled(!c.enabled);
    }
    @Override public void onResume() {
        super.onResume();
        try { registerObserver(); RelayScheduler.ensure(this); RelayScheduler.soon(this); } catch(Exception e) { status.setText("백그라운드 연결을 다시 확인해 주세요."); }
        handler.post(refresh);
    }
    @Override public void onPause() { handler.removeCallbacks(refresh); token.setText(""); super.onPause(); }
    @Override public void onDestroy() { handler.removeCallbacks(refresh); getContentResolver().unregisterContentObserver(observer); super.onDestroy(); }
}
