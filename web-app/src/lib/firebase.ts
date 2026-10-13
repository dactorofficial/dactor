// Firebase & Real Google OAuth Authentication for Dactor Web App
// Authenticates exclusively through official Google OAuth dialogs (Firebase Auth & Google Identity)
import { supabase } from './supabase'

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCc1ho812HhFLO3-XeNcDT_1Y68BdpzObU',
  authDomain: 'dactor-ea1e1.firebaseapp.com',
  projectId: 'dactor-ea1e1',
  storageBucket: 'dactor-ea1e1.firebasestorage.app',
  messagingSenderId: '429529188002',
  appId: '1:429529188002:web:cd7cf4e561779910ab79fb',
  measurementId: 'G-9SK7JVV6XM',
}

export interface FirebaseAuthUser {
  uid: string
  email: string
  displayName?: string
  photoURL?: string
  idToken?: string
  refreshToken?: string
}

/**
 * Check if the browser just returned from a Firebase signInWithRedirect
 */
export async function checkRedirectGoogleUser(): Promise<FirebaseAuthUser | null> {
  try {
    if (typeof window !== 'undefined' && (window as any).dactorFirebase?.getRedirectResult) {
      const result = await (window as any).dactorFirebase.getRedirectResult()
      if (result && result.user && result.user.email) {
        const u = result.user
        const userObj: FirebaseAuthUser = {
          uid: u.uid,
          email: u.email.toLowerCase().trim(),
          displayName: u.displayName || undefined,
          photoURL: u.photoURL || undefined,
        }
        localStorage.setItem('dactor_google_user', JSON.stringify(userObj))
        return userObj
      }
    }
  } catch (err) {
    console.warn('Redirect check notice:', err)
  }
  return null
}

/**
 * Real Google Sign-In with official Google Account Chooser (prompt: 'select_account')
 * Strictly calls official Google OAuth. No mock accounts, no editable email inputs.
 */
export async function signInWithFirebaseGoogle(): Promise<FirebaseAuthUser> {
  // 1. Try Firebase Auth popup with official Google Provider
  if (typeof window !== 'undefined' && (window as any).dactorFirebase?.signInWithGoogle) {
    try {
      // Force account selector so user can pick which Google account to use
      const result = await (window as any).dactorFirebase.signInWithGoogle()
      if (result && result.user && result.user.email) {
        const u = result.user
        const userObj: FirebaseAuthUser = {
          uid: u.uid,
          email: u.email.toLowerCase().trim(),
          displayName: u.displayName || undefined,
          photoURL: u.photoURL || undefined,
        }
        localStorage.setItem('dactor_google_user', JSON.stringify(userObj))
        return userObj
      }
    } catch (fbErr: any) {
      console.warn('Firebase Google Sign-In popup notice:', fbErr)
      const code = fbErr?.code || ''
      const msg = fbErr?.message || ''

      if (code === 'auth/popup-closed-by-user' || msg.includes('popup-closed-by-user')) {
        throw new Error('Google Sign-In was cancelled: popup was closed before completing.')
      }

      // If popup was blocked by browser, trigger official Google Redirect flow
      if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
        if ((window as any).dactorFirebase?.signInWithRedirect) {
          await (window as any).dactorFirebase.signInWithRedirect()
          return new Promise(() => {}) // Browser is navigating to accounts.google.com
        }
        throw new Error(`Google Sign-In popup was blocked by your browser. Please allow popups for ${window.location.hostname}.`)
      }

      if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
        // Fallback to Supabase Google OAuth if domain is pending in Firebase console
        try {
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: window.location.origin + window.location.pathname,
              queryParams: { prompt: 'select_account' },
            },
          })
          if (error) throw error
          if (data?.url) {
            window.location.href = data.url
            return new Promise(() => {})
          }
        } catch (sbErr: any) {
          throw new Error(
            `Google OAuth Domain Authorization: Please ensure "${window.location.hostname}" (or "rajanpurbe.github.io") is added in Firebase Console -> Authentication -> Settings -> Authorized Domains.`
          )
        }
      }

      throw new Error(fbErr.message || 'Google Sign-In failed. Please try again.')
    }
  }

  // 2. Fallback to Supabase Google OAuth
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) throw error
    if (data?.url) {
      window.location.href = data.url
      return new Promise(() => {})
    }
  } catch (sbErr: any) {
    throw new Error(sbErr.message || 'Google OAuth Sign-In failed.')
  }

  throw new Error('Google Sign-In service could not be initialized.')
}

export async function signOutFirebase(): Promise<void> {
  firebaseSignOut()
}

export function firebaseSignOut(): void {
  try {
    if (typeof window !== 'undefined' && (window as any).dactorFirebase?.signOut) {
      ;(window as any).dactorFirebase.signOut().catch(() => {})
    }
    localStorage.removeItem('dactor_google_user')
    localStorage.removeItem('dactor_patient_session')
    localStorage.removeItem('dactor_auth_logged_in')
    localStorage.removeItem('dactor_auth_email')
    localStorage.removeItem('dactor_auth_role')
  } catch {}
}

/**
 * Real Firebase Authentication Account Deletion Rule
 * Permanently deletes the current authenticated Firebase user.
 */
export async function deleteFirebaseUserAccount(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && (window as any).dactorFirebase?.auth?.currentUser) {
      await (window as any).dactorFirebase.auth.currentUser.delete()
      firebaseSignOut()
      return true
    }
    return false
  } catch (err) {
    console.warn('Firebase user deletion notice:', err)
    firebaseSignOut()
    return false
  }
}
