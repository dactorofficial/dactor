package com.dactor.clinic.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.dactor.clinic.data.local.dao.AppointmentDao
import com.dactor.clinic.data.local.dao.BillingDao
import com.dactor.clinic.data.local.dao.QueueDao
import com.dactor.clinic.data.local.dao.SyncMetadataDao
import com.dactor.clinic.data.local.entity.AppointmentEntity
import com.dactor.clinic.data.local.entity.BillingInvoiceEntity
import com.dactor.clinic.data.local.entity.InvoiceTransactionEntity
import com.dactor.clinic.data.local.entity.QueueEntryEntity
import com.dactor.clinic.data.local.entity.SyncMetadataEntity
import com.dactor.clinic.data.local.security.DatabaseKeyManager
import net.sqlcipher.database.SupportFactory

@Database(
    entities = [
        AppointmentEntity::class,
        BillingInvoiceEntity::class,
        InvoiceTransactionEntity::class,
        QueueEntryEntity::class,
        SyncMetadataEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class ClinicDatabase : RoomDatabase() {

    abstract fun appointmentDao(): AppointmentDao
    abstract fun billingDao(): BillingDao
    abstract fun queueDao(): QueueDao
    abstract fun syncMetadataDao(): SyncMetadataDao

    companion object {
        const val DATABASE_NAME = "dactor_clinic_encrypted.db"

        fun buildDatabase(context: Context, keyManager: DatabaseKeyManager): ClinicDatabase {
            val passphrase = keyManager.getOrCreatePassphrase()
            val supportFactory = SupportFactory(passphrase)

            return Room.databaseBuilder(
                context.applicationContext,
                ClinicDatabase::class.java,
                DATABASE_NAME
            )
                .openHelperFactory(supportFactory)
                .fallbackToDestructiveMigration()
                .build()
        }
    }
}
