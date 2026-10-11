// Dactor Firebase Web SDK Configuration
// Project: dactor-ea1e1

export const firebaseConfig = {
  apiKey: "AIzaSyCc1ho812HhFLO3-XeNcDT_1Y68BdpzObU",
  authDomain: "dactor-ea1e1.firebaseapp.com",
  projectId: "dactor-ea1e1",
  storageBucket: "dactor-ea1e1.firebasestorage.app",
  messagingSenderId: "429529188002",
  appId: "1:429529188002:web:cd7cf4e561779910ab79fb",
  measurementId: "G-9SK7JVV6XM",
}

declare global {
  interface Window {
    dactorFirebase?: {
      app: any
      auth: any
      googleProvider: any
      signInWithGoogle: () => Promise<{ user: { email: string | null; displayName: string | null; uid: string } }>
      signOut: () => Promise<void>
      onAuthStateChanged: (callback: (user: any) => void) => () => void
      initialized: boolean
      error?: string
    }
  }
}

/**
 * Triggers Google Sign-in popup via Firebase Auth.
 */
export async function signInWithFirebaseGoogle(): Promise<{ email: string; displayName?: string; uid: string }> {
  if (typeof window === 'undefined') {
    throw new Error('Window is not defined.')
  }

  // Wait briefly if Firebase script is still loading
  let attempts = 0
  while (!window.dactorFirebase && attempts < 10) {
    await new Promise((r) => setTimeout(r, 150))
    attempts++
  }

  if (!window.dactorFirebase || !window.dactorFirebase.signInWithGoogle) {
    throw new Error('Firebase Auth SDK is not available yet. Please refresh the page.')
  }

  try {
    const result = await window.dactorFirebase.signInWithGoogle()
    const email = result?.user?.email || 'authenticated.doctor@dactor.health'
    const displayName = result?.user?.displayName || 'Doctor / Clinic Staff'
    const uid = result?.user?.uid || ''

    return { email, displayName, uid }
  } catch (error: any) {
    console.error('Firebase Google Sign-In error:', error)
    throw error
  }
}

/**
 * Signs out the current Firebase user.
 */
export async function signOutFirebase(): Promise<void> {
  if (window.dactorFirebase?.signOut) {
    try {
      await window.dactorFirebase.signOut()
    } catch (err) {
      console.warn('Firebase signOut notice:', err)
    }
  }
}
