package com.tllhouse.hlbreplay;

import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;

final class RelayScheduler {
    private static final int PERIODIC = 260301, IMMEDIATE = 260302;
    private RelayScheduler() {}
    static void ensure(Context c) {
        if (!new RelayConfig(c).enabled || !RelayConfig.permissions(c)) return;
        JobScheduler s = c.getSystemService(JobScheduler.class);
        if (s.getPendingJob(PERIODIC) == null) {
            int result = s.schedule(new JobInfo.Builder(PERIODIC, new ComponentName(c, RelayJobService.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(15*60*1000L)
                .setPersisted(true).setBackoffCriteria(60_000, JobInfo.BACKOFF_POLICY_EXPONENTIAL).build());
            if (result != JobScheduler.RESULT_SUCCESS) throw new IllegalStateException("Scheduler unavailable");
        }
    }
    static void soon(Context c) {
        if (!new RelayConfig(c).enabled || !RelayConfig.permissions(c)) return;
        JobScheduler s = c.getSystemService(JobScheduler.class);
        if (s.getPendingJob(IMMEDIATE) == null) {
            s.schedule(new JobInfo.Builder(IMMEDIATE, new ComponentName(c, RelayJobService.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true)
                .setBackoffCriteria(60_000, JobInfo.BACKOFF_POLICY_EXPONENTIAL).build());
        }
    }
    static void cancel(Context c) {
        JobScheduler s = c.getSystemService(JobScheduler.class); s.cancel(PERIODIC); s.cancel(IMMEDIATE);
    }
}
