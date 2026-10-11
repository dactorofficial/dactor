package com.dactor.clinic

import android.app.Application
import com.dactor.clinic.service.NotificationHelper
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class DactorClinicApp : Application() {

    override fun onCreate() {
        super.onCreate()
        // Permanently create notification channel in Android OS upon application startup
        NotificationHelper.createNotificationChannel(this)
    }
}
