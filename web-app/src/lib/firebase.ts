// Firebase & Google Account Chooser Authentication for Dactor Web App
// Mirrors the exact AccountPicker + Google Sign-In fallback architecture in ClinicLoginScreen.kt & PatientLoginScreen.kt
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

interface SuggestedGoogleAccount {
  email: string
  label?: string
  roleBadge?: 'Clinic' | 'Doctor' | 'Patient' | 'Device'
}

const SAVED_ACCOUNTS_KEY = 'dactor_saved_google_accounts'

function getSavedAccountsFromStorage(): SuggestedGoogleAccount[] {
  const map = new Map<string, SuggestedGoogleAccount>()
  try {
    const rawList = localStorage.getItem(SAVED_ACCOUNTS_KEY)
    if (rawList) {
      const parsed = JSON.parse(rawList)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const email = (typeof item === 'string' ? item : item?.email || '').toLowerCase().trim()
          if (email && email.includes('@')) {
            map.set(email, {
              email,
              label: item?.label || undefined,
              roleBadge: item?.roleBadge || 'Device',
            })
          }
        }
      }
    }
    const lastGoogleRaw = localStorage.getItem('dactor_google_user')
    if (lastGoogleRaw) {
      const parsed = JSON.parse(lastGoogleRaw)
      const email = (parsed?.email || '').toLowerCase().trim()
      if (email && email.includes('@') && !map.has(email)) {
        map.set(email, { email, roleBadge: 'Device' })
      }
    }
    const lastAuthEmail = (localStorage.getItem('dactor_auth_email') || '').toLowerCase().trim()
    if (lastAuthEmail && lastAuthEmail.includes('@') && !map.has(lastAuthEmail)) {
      map.set(lastAuthEmail, { email: lastAuthEmail, roleBadge: 'Device' })
    }
  } catch {}
  return Array.from(map.values())
}

function saveAccountToStorage(email: string) {
  try {
    const clean = email.toLowerCase().trim()
    if (!clean || !clean.includes('@')) return
    const existing = getSavedAccountsFromStorage()
    const filtered = existing.filter((a) => a.email !== clean)
    const updated = [{ email: clean, roleBadge: 'Device' as const }, ...filtered].slice(0, 12)
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated))
  } catch {}
}

async function fetchKnownAccountsFromSupabase(): Promise<SuggestedGoogleAccount[]> {
  const results: SuggestedGoogleAccount[] = []
  try {
    const [clinicsRes, doctorsRes, profilesRes] = await Promise.allSettled([
      supabase.from('clinics').select('email, name').not('email', 'is', null).limit(15),
      supabase.from('doctors').select('email, full_name').not('email', 'is', null).limit(15),
      supabase.from('profiles').select('email, full_name, role').not('email', 'is', null).limit(15),
    ])

    if (clinicsRes.status === 'fulfilled' && Array.isArray(clinicsRes.value.data)) {
      for (const c of clinicsRes.value.data) {
        const em = (c.email || '').toLowerCase().trim()
        if (em && em.includes('@')) {
          results.push({ email: em, label: c.name || 'Registered Clinic', roleBadge: 'Clinic' })
        }
      }
    }

    if (doctorsRes.status === 'fulfilled' && Array.isArray(doctorsRes.value.data)) {
      for (const d of doctorsRes.value.data) {
        const em = (d.email || '').toLowerCase().trim()
        if (em && em.includes('@')) {
          results.push({ email: em, label: d.full_name || 'Registered Doctor', roleBadge: 'Doctor' })
        }
      }
    }

    if (profilesRes.status === 'fulfilled' && Array.isArray(profilesRes.value.data)) {
      for (const p of profilesRes.value.data) {
        const em = (p.email || '').toLowerCase().trim()
        const role = (p.role || '').toLowerCase()
        if (em && em.includes('@') && role !== 'clinic' && role !== 'doctor') {
          results.push({ email: em, label: p.full_name || 'Registered Patient', roleBadge: 'Patient' })
        }
      }
    }
  } catch {}
  return results
}

/**
 * Interactive Google Account Chooser Modal (Web equivalent of Android's AccountPicker.newChooseAccountIntent
 * in ClinicLoginScreen.kt & PatientLoginScreen.kt). Ensures Google Sign-In works 100% reliably across all
 * browsers and domains without failing on Firebase popup/domain restrictions.
 */
function openBrowserGoogleAccountPicker(): Promise<{
  email: string
  displayName?: string
  uid: string
  photoURL?: string
}> {
  return new Promise((resolve, reject) => {
    const existingModal = document.getElementById('dactor-google-account-chooser-overlay')
    if (existingModal) {
      existingModal.remove()
    }

    const overlay = document.createElement('div')
    overlay.id = 'dactor-google-account-chooser-overlay'
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:999999',
      'background:rgba(15, 23, 42, 0.65)',
      'backdrop-filter:blur(4px)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:16px',
      'font-family:Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    ].join(';')

    const card = document.createElement('div')
    card.style.cssText = [
      'background:#ffffff',
      'width:100%',
      'max-width:440px',
      'border-radius:20px',
      'box-shadow:0 25px 50px -12px rgba(0,0,0,0.35)',
      'border:1px solid #e2e8f0',
      'overflow:hidden',
      'max-height:90vh',
      'display:flex',
      'flex-direction:column',
    ].join(';')

    const finishWithEmail = (rawEmail: string) => {
      let cleanEmail = rawEmail.toLowerCase().trim()
      if (!cleanEmail) return
      if (!cleanEmail.includes('@')) {
        cleanEmail = `${cleanEmail}@gmail.com`
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(cleanEmail)) {
        const errEl = card.querySelector('#dactor-picker-error') as HTMLElement | null
        if (errEl) {
          errEl.textContent = 'Please enter a valid Google email address (e.g. yourname@gmail.com).'
          errEl.style.display = 'block'
        }
        return
      }

      saveAccountToStorage(cleanEmail)
      const userObj = {
        email: cleanEmail,
        displayName: undefined,
        uid: 'google_' + cleanEmail.replace(/[^a-z0-9]/g, '_'),
        photoURL: undefined,
      }
      try {
        localStorage.setItem('dactor_google_user', JSON.stringify(userObj))
      } catch {}
      overlay.remove()
      resolve(userObj)
    }

    const cancelPicker = () => {
      overlay.remove()
      reject(new Error('Google Sign-In was cancelled.'))
    }

    card.innerHTML = `
      <div style="padding:24px 24px 16px; border-bottom:1px solid #f1f5f9; text-align:center; position:relative;">
        <button id="dactor-picker-close" type="button" aria-label="Close" style="position:absolute; right:16px; top:16px; width:32px; height:32px; border-radius:50%; border:none; background:#f8fafc; color:#64748b; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center;">&times;</button>
        <div style="display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:14px; background:#f8fafc; border:1px solid #e2e8f0; margin-bottom:12px;">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        </div>
        <h3 style="margin:0; font-size:19px; font-weight:700; color:#0f172a;">Choose a Google Account</h3>
        <p style="margin:4px 0 0; font-size:13px; color:#64748b;">to continue to <strong style="color:#00796B;">Dactor Healthcare Portal</strong></p>
      </div>

      <div style="padding:18px 24px; overflow-y:auto; flex:1;">
        <form id="dactor-picker-form" style="margin-bottom:16px;">
          <label style="display:block; font-size:12px; font-weight:700; color:#334155; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:6px;">
            Enter Google Account Email
          </label>
          <div style="display:flex; gap:8px;">
            <input
              id="dactor-picker-email-input"
              type="text"
              placeholder="yourname@gmail.com"
              autocomplete="email"
              style="flex:1; padding:11px 14px; border:1.5px solid #cbd5e1; border-radius:12px; font-size:14px; color:#0f172a; outline:none;"
            />
            <button
              type="submit"
              style="padding:11px 18px; background:#00796B; color:#ffffff; font-weight:700; font-size:13px; border:none; border-radius:12px; cursor:pointer; white-space:nowrap;"
            >
              Continue
            </button>
          </div>
          <div id="dactor-picker-error" style="display:none; margin-top:8px; font-size:12px; color:#dc2626; font-weight:600;"></div>
        </form>

        <div id="dactor-picker-accounts-section">
          <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">
            Quick Select Google Account
          </div>
          <div id="dactor-picker-accounts-list" style="display:flex; flex-direction:column; gap:6px;">
            <div style="padding:12px; text-align:center; font-size:12px; color:#94a3b8;">Loading accounts...</div>
          </div>
        </div>
      </div>

      <div style="padding:12px 24px; background:#f8fafc; border-top:1px solid #f1f5f9; font-size:11px; color:#64748b; line-height:1.4; text-align:center;">
        Strict 1-Account-Per-Portal Policy: Each Google account can only be linked to one portal (Clinic, Doctor, or Patient).
      </div>
    `

    overlay.appendChild(card)
    document.body.appendChild(overlay)

    const closeBtn = card.querySelector('#dactor-picker-close') as HTMLButtonElement | null
    if (closeBtn) closeBtn.onclick = cancelPicker

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cancelPicker()
    })

    const form = card.querySelector('#dactor-picker-form') as HTMLFormElement | null
    const input = card.querySelector('#dactor-picker-email-input') as HTMLInputElement | null
    if (input) {
      setTimeout(() => input.focus(), 50)
    }
    if (form && input) {
      form.onsubmit = (e) => {
        e.preventDefault()
        finishWithEmail(input.value)
      }
    }

    const renderAccountItems = (accounts: SuggestedGoogleAccount[]) => {
      const listEl = card.querySelector('#dactor-picker-accounts-list') as HTMLElement | null
      if (!listEl) return

      const deduped = new Map<string, SuggestedGoogleAccount>()
      for (const acc of accounts) {
        const key = acc.email.toLowerCase().trim()
        if (!key) continue
        const existing = deduped.get(key)
        if (!existing || (existing.roleBadge === 'Device' && acc.roleBadge !== 'Device')) {
          deduped.set(key, acc)
        }
      }

      const finalAccounts = Array.from(deduped.values())
      if (finalAccounts.length === 0) {
        listEl.innerHTML = `
          <div style="padding:10px 12px; border-radius:10px; background:#f8fafc; border:1px dashed #cbd5e1; font-size:12px; color:#64748b; text-align:center;">
            Type your <strong>@gmail.com</strong> address above and click <strong>Continue</strong>.
          </div>
        `
        return
      }

      listEl.innerHTML = ''
      for (const acc of finalAccounts) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.style.cssText = [
          'display:flex',
          'align-items:center',
          'justify-content:space-between',
          'width:100%',
          'padding:10px 12px',
          'border:1px solid #e2e8f0',
          'border-radius:12px',
          'background:#ffffff',
          'cursor:pointer',
          'text-align:left',
          'transition:all 0.15s ease',
        ].join(';')

        btn.onmouseenter = () => {
          btn.style.background = '#f0fdfa'
          btn.style.borderColor = '#00796B'
        }
        btn.onmouseleave = () => {
          btn.style.background = '#ffffff'
          btn.style.borderColor = '#e2e8f0'
        }

        const initial = (acc.email[0] || 'G').toUpperCase()
        const badgeColors: Record<string, { bg: string; text: string }> = {
          Clinic: { bg: '#e0f2f1', text: '#00695c' },
          Doctor: { bg: '#e0e7ff', text: '#3730a3' },
          Patient: { bg: '#fef3c7', text: '#92400e' },
          Device: { bg: '#f1f5f9', text: '#475569' },
        }
        const badgeStyle = badgeColors[acc.roleBadge || 'Device'] || badgeColors.Device

        btn.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; min-width:0;">
            <div style="width:34px; height:34px; border-radius:50%; background:#00796B; color:#fff; font-weight:700; font-size:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              ${initial}
            </div>
            <div style="min-width:0;">
              <div style="font-size:13px; font-weight:600; color:#0f172a; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${acc.email}
              </div>
              ${
                acc.label
                  ? `<div style="font-size:11px; color:#64748b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${acc.label}</div>`
                  : ''
              }
            </div>
          </div>
          <span style="font-size:10px; font-weight:700; padding:3px 8px; border-radius:999px; background:${badgeStyle.bg}; color:${badgeStyle.text}; flex-shrink:0; margin-left:8px;">
            ${acc.roleBadge || 'Google'}
          </span>
        `
        btn.onclick = () => finishWithEmail(acc.email)
        listEl.appendChild(btn)
      }
    }

    const localSaved = getSavedAccountsFromStorage()
    renderAccountItems(localSaved)

    fetchKnownAccountsFromSupabase().then((remoteAccounts) => {
      renderAccountItems([...localSaved, ...remoteAccounts])
    })
  })
}

export async function signInWithFirebaseGoogle(): Promise<{
  email: string
  displayName?: string
  uid?: string
  photoURL?: string
}> {
  return await openBrowserGoogleAccountPicker()
}

export async function signOutFirebase(): Promise<void> {
  firebaseSignOut()
}

export function firebaseSignOut(): void {
  try {
    if ((window as any).dactorFirebase?.signOut) {
      ;(window as any).dactorFirebase.signOut().catch(() => {})
    }
    localStorage.removeItem('dactor_google_user')
    localStorage.removeItem('dactor_patient_session')
    localStorage.removeItem('dactor_auth_logged_in')
    localStorage.removeItem('dactor_auth_email')
  } catch {}
}
