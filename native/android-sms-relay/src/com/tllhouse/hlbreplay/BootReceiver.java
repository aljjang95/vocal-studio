package com.tllhouse.hlbreplay;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent) {
        if (!(Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction()))) return;
        try { RelayScheduler.ensure(context); RelayScheduler.soon(context); } catch(Exception e) { /* next owner launch can restore jobs */ }
    }
}
