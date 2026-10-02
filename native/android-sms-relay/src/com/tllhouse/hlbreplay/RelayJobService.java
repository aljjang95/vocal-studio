package com.tllhouse.hlbreplay;

import android.app.job.JobParameters;
import android.app.job.JobService;
import android.database.ContentObserver;
import android.os.Handler;
import android.os.Looper;
import android.provider.Telephony;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public final class RelayJobService extends JobService {
    private static final ExecutorService EXECUTOR=Executors.newSingleThreadExecutor();
    private final ConcurrentHashMap<Integer,AtomicBoolean> running=new ConcurrentHashMap<>();
    private ContentObserver observer;
    @Override public void onCreate() {
        super.onCreate();
        observer=new ContentObserver(new Handler(Looper.getMainLooper())) {
            @Override public void onChange(boolean selfChange) { RelayScheduler.soon(RelayJobService.this); }
        };
        if (RelayConfig.permissions(this)) getContentResolver().registerContentObserver(Telephony.Sms.CONTENT_URI,true,observer);
    }
    @Override public boolean onStartJob(JobParameters params) {
        AtomicBoolean cancelled=new AtomicBoolean(); running.put(params.getJobId(),cancelled);
        EXECUTOR.execute(() -> {
            boolean retry=false;
            try (RelayStore store=new RelayStore(this)) { retry=new RelayEngine(this,cancelled,store).run(); }
            catch (Exception e) { retry=new RelayConfig(this).enabled; }
            finally {
                running.remove(params.getJobId(),cancelled);
                if (!cancelled.get()) jobFinished(params,retry);
            }
        });
        return true;
    }
    @Override public boolean onStopJob(JobParameters params) {
        AtomicBoolean flag=running.remove(params.getJobId()); if(flag!=null) flag.set(true);
        return new RelayConfig(this).enabled;
    }
    @Override public void onDestroy() {
        if(observer!=null) getContentResolver().unregisterContentObserver(observer);
        for(AtomicBoolean flag:running.values()) flag.set(true);
        super.onDestroy();
    }
}
