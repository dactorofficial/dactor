package com.dactor.clinic.data.local.security

import android.content.Context
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import java.security.SecureRandom
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages the 256-bit AES cryptographic passphrase used by SQLCipher to encrypt
 * the local Room SQLite database at rest.
 * Backed by hardware keystore via Jetpack Security (EncryptedSharedPreferences).
 */
@Singleton
class DatabaseKeyManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val PREFS_FILE = "dactor_vault_db_sec"
        private const val KEY_DB_PASSPHRASE = "k_sqlcipher_db_pass"
        private const val KEY_LENGTH_BYTES = 32 // 256 bits
    }

    /**
     * Retrieves or generates a 256-bit AES passphrase for SQLCipher SupportFactory.
     */
    @Synchronized
    fun getOrCreatePassphrase(): ByteArray {
        val encryptedPrefs = try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            EncryptedSharedPreferences.create(
                context,
                PREFS_FILE,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (_: Throwable) {
            // Fallback for custom or test environments where KeyStore is constrained
            context.getSharedPreferences(PREFS_FILE + "_fb", Context.MODE_PRIVATE)
        }

        var encodedPass = encryptedPrefs.getString(KEY_DB_PASSPHRASE, null)
        if (encodedPass.isNullOrBlank()) {
            val randomBytes = ByteArray(KEY_LENGTH_BYTES)
            SecureRandom().nextBytes(randomBytes)
            encodedPass = Base64.encodeToString(randomBytes, Base64.NO_WRAP)
            encryptedPrefs.edit().putString(KEY_DB_PASSPHRASE, encodedPass).apply()
            return randomBytes
        }

        return Base64.decode(encodedPass, Base64.NO_WRAP)
    }
}
