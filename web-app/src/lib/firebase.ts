// Firebase Client Configuration & Lightweight REST Auth for Dactor Web App
// Connected with Firebase Project: dactor-ea1e1

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBymdhtyr58U3Ms7csIZ5DUBDJ9CLzZreE',
  authDomain: 'dactor-ea1e1.firebaseapp.com',
  projectId: 'dactor-ea1e1',
  storageBucket: 'dactor-ea1e1.firebasestorage.app',
  messagingSenderId: '429529188002',
  appId: '1:429529188002:web:dactor-patient-portal',
}

export interface FirebaseAuthUser {
  uid: string
  email: string
  displayName?: string
  photoURL?: string
  idToken?: string
  refreshToken?: string
}

export function formatFirebaseError(msg: string): string {
  if (msg.includes('EMAIL_NOT_FOUND')) return 'No account found with this email address.'
  if (msg.includes('INVALID_PASSWORD')) return 'Incorrect password entered. Please try again.'
  if (msg.includes('EMAIL_EXISTS')) return 'This email is already registered. Please log in.'
  if (msg.includes('WEAK_PASSWORD')) return 'Password must be at least 6 characters long.'
  if (msg.includes('INVALID_EMAIL')) return 'Please enter a valid email address.'
  if (msg.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) return 'Too many attempts. Please try again later.'
  return msg
}

export async function signOutFirebase(): Promise<void> {
  firebaseSignOut()
}

// 1. Sign In With Email & Password via Google Identity Toolkit REST API
export async function firebaseSignInWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; user?: FirebaseAuthUser; error?: string }> {
  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        returnSecureToken: true,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      const msg = data?.error?.message || 'Failed to sign in'
      return { success: false, error: formatFirebaseError(msg) }
    }

    const user: FirebaseAuthUser = {
      uid: data.localId,
      email: data.email,
      displayName: data.displayName || email.split('@')[0],
      idToken: data.idToken,
      refreshToken: data.refreshToken,
    }

    return { success: true, user }
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during login' }
  }
}

// 2. Sign Up With Email & Password via Google Identity Toolkit REST API
export async function firebaseSignUpWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<{ success: boolean; user?: FirebaseAuthUser; error?: string }> {
  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_CONFIG.apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        returnSecureToken: true,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      const msg = data?.error?.message || 'Failed to create account'
      return { success: false, error: formatFirebaseError(msg) }
    }

    // Update display name if provided
    if (displayName && data.idToken) {
      try {
        const updateUrl = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${FIREBASE_CONFIG.apiKey}`
        await fetch(updateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken: data.idToken,
            displayName: displayName.trim(),
            returnSecureToken: true,
          }),
        })
      } catch {}
    }

    const user: FirebaseAuthUser = {
      uid: data.localId,
      email: data.email,
      displayName: displayName || email.split('@')[0],
      idToken: data.idToken,
      refreshToken: data.refreshToken,
    }

    return { success: true, user }
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during signup' }
  }
}

// 3. Send Password Reset Email via Google Identity Toolkit REST API
export async function firebaseSendPasswordReset(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_CONFIG.apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'PASSWORD_RESET',
        email: email.trim().toLowerCase(),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      const msg = data?.error?.message || 'Failed to send password reset'
      return { success: false, error: formatFirebaseError(msg) }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' }
  }
}

export async function signInWithFirebaseGoogle(): Promise<{ email: string; displayName?: string; uid?: string } | null> {
  try {
    const cached = localStorage.getItem('dactor_google_user')
    if (cached) {
      return JSON.parse(cached)
    }
  } catch {}
  return null
}

export function firebaseSignOut(): void {
  try {
    localStorage.removeItem('dactor_google_user')
    localStorage.removeItem('dactor_patient_session')
    localStorage.removeItem('dactor_auth_logged_in')
    localStorage.removeItem('dactor_auth_email')
  } catch {}
}

