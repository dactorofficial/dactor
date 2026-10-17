# DACTOR — Comprehensive Master Handoff Document

> **Last Updated**: October 10, 2026  
> **Platform**: Nepal Clinic Management, OPD Scheduling & Live Queue Tracking Ecosystem  
> **Author / Maintainer**: Antigravity Assistant Pair Programming Sessions  

---

## ⚠️ MANDATORY GLOBAL RULE: Automatic APK Versioning & Naming

> **CRITICAL RULE FOR ALL ASSISTANTS & BUILD COMMANDS**:  
> Whenever an APK is generated or commanded by the user to be generated, you **MUST** strictly follow this procedure:
> 1. **Increment the Version Every Time**: Before building, inspect `app/build.gradle.kts` for the target app (`clinic-app` or `patient-app`).
>    - Increment **`versionCode`** by `+1` (integer: e.g., `1` ➔ `2` ➔ `3`).
>    - Increment **`versionName`** (semantic version: e.g., `"1.0"` ➔ `"1.0.1"` ➔ `"1.0.2"`).
>    - **NEVER** build an APK with a duplicate or unbumped version.
> 2. **Explicit Version in Output APK Name**: The resulting APK **MUST** include its version tag in the filename and be placed in `APKs/`:
>    - **Clinic App**: `APKs/Dactor-ClinicApp-v<versionName>.apk` *(e.g., `APKs/Dactor-ClinicApp-v1.0.1.apk`)*
>    - **Patient App**: `APKs/Dactor-PatientApp-v<versionName>.apk` *(e.g., `APKs/Dactor-PatientApp-v1.0.1.apk`)*
> 3. **Easy Version Tracking**:
>    - Each build increases the version number so the user and team can effortlessly track the latest release.
>    - Update the **APK Version Registry** in this document with each new release.
>    - Report the exact version and file location to the user upon build completion.

---

## 1. Executive Summary & Live Endpoints

The DACTOR platform consists of three tightly coupled applications operating on a unified Supabase cloud database, with Firebase strictly handling push notifications.

| Component | Platform / Tech | Source Folder | Live Deployment / Artifacts | Current Latest Version |
|---|---|---|---|---|
| **Super Admin Console** | React 18 + Vite + TypeScript + Tailwind | `admin-panel/` | [Live Site on GitHub Pages](https://dactorofficial.github.io/admin-portal/) <br> GitHub: `https://github.com/dactorofficial/admin-portal` | v1.0 |
| **Clinic & Doctor App** | Android Native (Kotlin + Jetpack Compose + Hilt) | `clinic-app/` | `APKs/Dactor-ClinicApp-v1.0.41.apk` | v1.0.41 (Code 41) |
| **Patient App** | Android Native (Kotlin + Jetpack Compose + Hilt) | `patient-app/` | `APKs/Dactor-PatientApp-v1.0.49.apk` | v1.0.49 (Code 49) |
| **Cloud Backend & Storage** | Supabase (PostgreSQL + Auth + Storage + Realtime) | `supabase/` | Project URL: `https://ojfoofojcpabqegxmsab.supabase.co` | Cloud Live |

---

## 2. Key Architecture Decisions & Boundaries

1. **Dual Backend Boundary**:
   - **Supabase**: Primary database (PostgreSQL), Supabase Auth, Supabase Storage buckets, and Realtime WebSocket subscriptions.
   - **Firebase**: Dedicated solely to Google OAuth authentication verification and Firebase Cloud Messaging (FCM) for push notifications.
2. **Universal 10-Digit Tracking Code**:
   - Every appointment or receptionist walk-in generates a unique 10-digit numeric tracking code (e.g. `9841203841`).
   - Patients can track queue position, doctor presence, and lab test results with zero mandatory account creation.
   - Guest codes can be retroactively linked to an account via the profile screen.
3. **Doctor Physical In-Clinic Presence**:
   - Managed via a toggle switch on the clinic dashboard; displayed in real-time to waiting patients as "Doctor is Physically Inside Clinic" (Green) or "Away / Not Arrived" (Red).
4. **Patient PII Masking**:
   - Name and phone number are masked on public queue displays (e.g., `Ra*** Ku***`, `+977 98****1234`).
5. **Atomic 5-Minute Slot Reservation Lock**:
   - Built on PostgreSQL functions `acquire_slot_lock` and `release_slot_lock` to prevent double booking during payment checkout.

---

## 3. Work Completed & Resolved in This Session

### A. Clinic Picture & Doctor Document Upload to Supabase Storage
- **Problem Diagnosed**:
  - The admin portal was unable to display clinic photos, doctor profile avatars, and registration documents.
  - Diagnosis revealed that Supabase Storage had **no buckets created**, and the Android mobile app was calling `uri.toString()`, writing local Android device content URIs (`content://...`) straight into the database instead of uploading the binary file.
- **Supabase Storage Infrastructure Created**:
  - `clinic_photos` (Public: true, 50MB limit) — Clinic photos & registration documents.
  - `doctor_photos` (Public: true, 50MB limit) — Doctor profile avatars.
  - `doctor-kyc` (Public: true, 50MB limit) — NMC licenses & medical degree certificates.
  - RLS policies configured allowing public reads and authenticated/anon uploads.
- **Mobile Code Updated (`clinic-app`)**:
  - `ClinicRepository.kt`: Added `uploadClinicFile(fileName, fileBytes, bucketName)`.
  - `DoctorRepository.kt`: Added `uploadProfilePicture(fileName, fileBytes)`.
  - `ClinicLoginScreen.kt`: Updated both Clinic and Doctor registration flows to read file streams via `context.contentResolver.openInputStream(uri)`, upload bytes to Supabase Storage, and save the returned public HTTPS URLs into `Clinic.pictures`, `Clinic.registrationDocUrl`, and `Doctor.profilePictureUrl`.
  - `DoctorDashboardScreen.kt`: Updated profile photo edit modal to upload new avatar files to Supabase Storage.
  - `DoctorKYCScreen.kt`: Sanitized file names (replacing spaces with underscores) before upload.
- **Admin Portal Updated (`admin-panel`)**:
  - `DoctorKYC.tsx`: Updated `fetchDoctors` to resolve Supabase Storage v2 public URLs (`supabase.storage.from(bucket).getPublicUrl(cleanPath).data.publicUrl`). Added fallback image suppression for legacy submissions with `content://` URIs.
  - `ClinicVerification.tsx`: Updated `parseClinicMeta` to resolve relative storage paths to public URLs and added visual "Old Mobile URI" badges for legacy data.

### B. Clinic Activation & Subscription System
- **Problem Diagnosed**:
  - Adding clinic activations showed "0 Active Licenses" or remained in non-activated status.
- **Root Cause & Resolution**:
  - Column schema migrations were missing for activation fields.
  - Executed SQL migrations adding:
    - `is_activated BOOLEAN DEFAULT TRUE`
    - `activation_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')`
    - `activation_plan VARCHAR(50) DEFAULT '1_month'`
    - `activation_paid_amount DECIMAL(10, 2) DEFAULT 0.00`
    - `activation_notes TEXT`
    - `activation_payment_proof_url TEXT`
    - `is_archived BOOLEAN DEFAULT FALSE`
    - `archived_at TIMESTAMPTZ`
    - `deletion_scheduled_at TIMESTAMPTZ`
  - Updated `ClinicActivation.tsx` metric calculations:
    - Active licenses: clinics where `is_activated === true` AND `daysLeft > 7`.
    - Expiring soon: `is_activated === true` AND `daysLeft <= 7 && daysLeft > 0`.
    - Expired: `!is_activated` OR `daysLeft <= 0`.
  - Verified on live admin portal: Active Licenses metric card accurately displays active clinics count and green badges (e.g. "30 Days Left").

### C. Branding & Adaptive App Icons
- Generated and deployed pixel-perfect adaptive launcher icons across all DPI densities (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`) for both `clinic-app` and `patient-app`.
- Configured adaptive XML vectors and round icons.

### D. Automated Deployment & GitHub Pages
- Initialized Git repository for `admin-panel`.
- Created remote repository on GitHub: `https://github.com/dactorofficial/admin-portal`.
- Configured GitHub Actions workflow `.github/workflows/static.yml` for automated Vite React build and Pages deployment.
- Live URL active: `https://dactorofficial.github.io/admin-portal/`.

### E. Medical Taxonomy, Dynamic Symptom Search & Bidirectional Booking
- **Master Taxonomy Management in Super Admin Console (`admin-panel`)**:
  - Added new `/taxonomy` route and sidebar entry with Stethoscope icon (`MedicalTaxonomy.tsx`).
  - **Clinic Specialties Management**: Full CRUD over `medical_specialties` table. Admin can add/edit clinical departments, descriptions, icons, and comma-separated symptom search keywords.
  - **Doctor Qualifications Management**: Full CRUD over `medical_qualifications` table (MBBS, MD, MS, BDS, MDS, DM, MCh, fellowships, diplomas). Admin can add/edit recognized medical degrees.
  - **Interactive Symptom Simulator**: Real-time query test bench showing how patient keywords (e.g., "eye", "teeth", "skin", "chest pain") map to specialties.
  - **Multi-Specialty Selection in Clinic Editor (`ClinicEditor.tsx`)**: Allows assigning and toggling multiple specialties per clinic.
- **Clinic & Doctor App Customization (`clinic-app`)**:
  - Clinics choose **multiple** specialties during registration and in settings via interactive multi-select chips (`ClinicLoginScreen.kt`, `ClinicSettingsScreen.kt`).
  - Doctors select qualification and specialty from dynamic master lists during registration and dashboard settings (`ClinicLoginScreen.kt`, `DoctorDashboardScreen.kt`).
- **Patient App Smart Symptom Search & Bidirectional Booking (`patient-app`)**:
  - **Dynamic Symptom Keyword Matching (`DiscoveryScreen.kt`)**: Searches match natural language symptoms (e.g., "eye", "vision", "cataract", "teeth", "skin", "chest") against `medical_specialties.search_keywords`. Shows real-time "🎯 Matched Condition / Department" badge.
  - **Bidirectional Booking Navigation**:
    - *Patient clicks Clinic*: Navigates to `BookingScreen(clinicId)`. Patient chooses doctor -> chooses slot -> completes booking.
    - *Patient clicks Doctor*: Opens "Select Practicing Clinic" modal resolving doctor's affiliated clinics via `doctorRepository.getClinicsForDoctor(doctor)`. When a clinic is selected, navigates to `BookingScreen(clinicId, doctorId)` where that doctor is pre-selected and their slots are filtered immediately.

### F. Persistent Notification Permission Enforcer
- **Requirement**: Ask for notification permissions on app launch. If not granted, persistently block access with an informative modal dialog directing user to grant permission until allowed.
- **Implementation**:
  - Created `NotificationPermissionEnforcer.kt` in both `clinic-app` and `patient-app`.
  - Added reactive lifecycle observer (`ON_RESUME`) to recheck permissions automatically when returning from System Settings.
  - Non-dismissible Dialog (`dismissOnBackPress = false`, `dismissOnClickOutside = false`) that blocks interactions until `POST_NOTIFICATIONS` is granted.
  - Successfully verified live on connected physical device.

### G. OpenStreetMap Leaflet Fix & Live GPS Location Proximity
- **Problem**: In Patient App, clinic map did not render due to unescaped JavaScript string literals breaking Leaflet initialization.
- **Resolution**:
  - Refactored `ClinicMapView.kt` to escape strings using `JSONObject.quote()` and added fallback HTML rendering.
  - Added live GPS location retrieval in `PatientMainScreen.kt`, computing real-time distance in kilometers (`calculateDistanceKm()`) and displaying `• X.X km` proximity on clinic cards.
  - Added "📍 Use Current GPS Location" button in location dialog.
  - Verified on physical test device: Leaflet WebView renders clinic pin with coordinates and directions button.

### H. Strongly Typed PostgREST Serialization & Supabase Image Persistence
- **Problem**: In `clinic-app`, updating clinic/doctor info or photos failed due to serialization crashes from generic `Map<String, Any?>` sent to PostgREST.
- **Resolution**:
  - Replaced unstructured Maps with strongly typed `@Serializable` data classes: `ClinicUpdateDto`, `ClinicBaseUpdateDto`, and `DoctorUpdateDto`.
  - Updated `ClinicSettingsScreen.kt` photo picker to read raw bytes via `contentResolver.openInputStream(uri)`, generate unique filenames, upload to `clinic_photos` in Supabase Storage, and persist the HTTPS public URL.
  - Updated Admin Portal (`ClinicVerification.tsx`, `DoctorKYC.tsx`, `ClinicEditor.tsx`) to properly parse Postgres array formats (`{url1,url2}`) and render images.

### I. Generated APKs & Deployment Status
- Debug APKs built successfully:
  - `APKs/clinic-app-debug.apk` (23.95 MB)
  - `APKs/patient-app-debug.apk` (23.56 MB)
- Deployed and verified on test phone via ADB.
- Admin Portal committed and pushed to `origin/main` on GitHub, verified live on GitHub Pages.

---

## 4. Database Schema Reference (PostgreSQL / Supabase)

### Key Tables & Extended Columns:
1. **`clinics`**:
   - `id` (UUID, PK)
   - `name` (TEXT)
   - `type` (VARCHAR: `single_visit`, `multi_visit`, `diagnostic_lab`)
   - `specialties` (TEXT[] DEFAULT '{}' — Array of clinical departments)
   - `verification_status` (VARCHAR: `pending`, `approved`, `rejected`)
   - `contact_phone`, `contact_email`, `address_text`, `latitude`, `longitude`
   - `pan_number` (VARCHAR(20))
   - `manager_phone` (VARCHAR(50))
   - `registration_doc_url` (TEXT — Public Supabase Storage URL)
   - `pictures` (TEXT[] — Array of Public Supabase Storage URLs)
   - `is_activated` (BOOLEAN DEFAULT TRUE)
   - `activation_expires_at` (TIMESTAMPTZ)
   - `activation_plan` (VARCHAR: `1_month`, `12_months`)
   - `activation_paid_amount` (DECIMAL(10, 2))
   - `activation_notes` (TEXT)
   - `is_archived` (BOOLEAN DEFAULT FALSE)
   - `archived_at` (TIMESTAMPTZ)
   - `deletion_scheduled_at` (TIMESTAMPTZ)
   - `payment_gateway_provider` (VARCHAR: `esewa`, `khalti`)
   - `is_direct_payment_enabled` (BOOLEAN)

2. **`doctors`**:
   - `id` (UUID, PK)
   - `clinic_id` (UUID, FK -> clinics.id, NULLABLE)
   - `full_name` (TEXT)
   - `email` (TEXT)
   - `gender` (VARCHAR(20))
   - `age` (INT)
   - `starting_practicing_year` (INT)
   - `profile_picture_url` (TEXT — Public Supabase Storage URL)
   - `specialty` (TEXT)
   - `specialties` (TEXT[] DEFAULT '{}')
   - `education` (VARCHAR(255) — Medical Qualification/Degree)
   - `nmc_license_number` (TEXT)
   - `license_doc_url` (TEXT — Public Supabase Storage URL)
   - `certificates_doc_url` (TEXT — Public Supabase Storage URL)
   - `personal_mobile_number`, `public_mobile_number`
   - `kyc_status` (VARCHAR: `pending`, `approved`, `rejected`)
   - `is_in_clinic` (BOOLEAN DEFAULT FALSE)
   - `consultation_fee` (DECIMAL)

3. **`medical_specialties`** (Master Department & Symptom Taxonomy):
   - `id` (UUID, PK)
   - `name` (VARCHAR(100) UNIQUE)
   - `category` (VARCHAR(50))
   - `description` (TEXT)
   - `search_keywords` (TEXT — Comma-separated symptom keywords for patient matching)
   - `icon` (VARCHAR(50) DEFAULT 'stethoscope')
   - `is_active` (BOOLEAN DEFAULT TRUE)

4. **`medical_qualifications`** (Master Medical Degrees):
   - `id` (UUID, PK)
   - `degree_name` (VARCHAR(100) UNIQUE)
   - `level` (VARCHAR(50) — Undergraduate, Postgraduate, Super-Specialty, Fellowship, Diploma)
   - `field_of_study` (VARCHAR(100))
   - `description` (TEXT)
   - `is_active` (BOOLEAN DEFAULT TRUE)

5. **`appointments`**:
   - `id` (UUID, PK), `clinic_id`, `doctor_id`, `user_id`
   - `tracking_code` (VARCHAR(10) UNIQUE)
   - `status` (VARCHAR: `pending`, `confirmed`, `completed`, `cancelled`)
   - `is_paid` (BOOLEAN), `payment_amount` (DECIMAL)

6. **`queue_entries`**:
   - `id` (UUID, PK), `clinic_id`, `doctor_id`, `appointment_id`
   - `queue_number` (INT), `position` (INT)
   - `status` (VARCHAR: `waiting`, `in_consultation`, `completed`, `skipped`)

---

## 5. Storage Buckets Reference

| Bucket Name | Access | Allowed File Types | Target Usage |
|---|---|---|---|
| `clinic_photos` | Public | Images, PDFs | Clinic showcase photos (up to 4) & PAN/Registration certificate |
| `doctor_photos` | Public | Images (JPG, PNG, WebP) | Doctor profile avatar photos |
| `doctor-kyc` | Public | Images, PDFs | Official NMC License document & Medical Degree certificates |

**Public URL Format**:
`https://ojfoofojcpabqegxmsab.supabase.co/storage/v1/object/public/<bucket_name>/<file_name>`

---

## 6. How to Build & Run Each Project

### Super Admin Portal (`admin-panel/`)
```bash
cd admin-panel
npm install
npm run dev        # Runs local Vite dev server on http://localhost:3000
npm run build      # Produces optimized dist/ bundle for GitHub Pages
git push origin main # Automatically triggers GitHub Actions deployment to Pages
```

### Automated Mobile Build with Versioning (Recommended)
Use the automated build script to auto-increment version codes and produce versioned APKs:
```powershell
# Build both apps with automatic version increment:
.\build_apks.ps1 -App All

# Or build individually:
.\build_apks.ps1 -App Clinic
.\build_apks.ps1 -App Patient
```

### Manual Build Procedure (Strict Rule Compliance)

#### Clinic & Doctor App (`clinic-app/`)
1. Open `clinic-app/app/build.gradle.kts`.
2. Increment `versionCode` (e.g. `1` -> `2`) and `versionName` (e.g. `"1.0"` -> `"1.0.1"`).
3. Build the APK:
```powershell
cd clinic-app
./gradlew.bat assembleDebug
```
4. Copy the output to `APKs/` with the version in the name:
```powershell
Copy-Item "app/build2/outputs/apk/debug/app-debug.apk" "..\APKs\Dactor-ClinicApp-v1.0.1.apk" -Force
```

#### Patient App (`patient-app/`)
1. Open `patient-app/app/build.gradle.kts`.
2. Increment `versionCode` (e.g. `1` -> `2`) and `versionName` (e.g. `"1.0"` -> `"1.0.1"`).
3. Build the APK:
```powershell
cd patient-app
./gradlew.bat assembleDebug
```
4. Copy the output to `APKs/` with the version in the name:
```powershell
Copy-Item "app/build2/outputs/apk/debug/app-debug.apk" "..\APKs\Dactor-PatientApp-v1.0.1.apk" -Force
```

### Installing on Connected Devices
Run the install script, which automatically resolves the latest versioned APK:
```powershell
.\install_apps.ps1
```

---

## 7. APK Version Registry (Release History)

| Date | App | Version Name | Version Code | Filename | Key Changes |
|---|---|---|---|---|---|
| 2026-10-10 | Clinic & Doctor | v1.0.0 | 1 | `APKs/Dactor-ClinicApp-debug.apk` | Initial debug build (Base) |
| 2026-10-10 | Patient | v1.0.0 | 1 | `APKs/Dactor-PatientApp-debug.apk` | Initial debug build (Base) |
| 2026-10-11 | Clinic & Doctor | v1.0.1 | 2 | `APKs/Dactor-ClinicApp-v1.0.1.apk` | Upgraded to AGP 8.5.2, SDK XML v4 support, in-process compilation |
| 2026-10-11 | Patient | v1.0.1 | 2 | `APKs/Dactor-PatientApp-v1.0.1.apk` | Upgraded to AGP 8.5.2, SDK XML v4 support, in-process compilation |
| 2026-10-12 | Patient | v1.0.5 | 6 | `APKs/Dactor-PatientApp-v1.0.5.apk` | Redesigned Live Queue UI matching reference mockup: medical pine teal #0D5C4D theme, Contigo pill, white booking code card, concentric token badge, aligned stepper, integrated clinic/doctor card with inside presence banner, solid Reschedule & outlined Google Maps buttons, secondary tracking card |
| 2026-10-12 | Clinic & Doctor | v1.0.9 | 10 | `APKs/Dactor-ClinicApp-v1.0.9.apk` | Fix add slot in future appointments: dynamic doctor active clinic ID resolution, published OPD slots card with deletion, quick duration chips, daytime defaults for future dates, blue dot on calendar for published slots |
| 2026-10-12 | Patient | v1.0.6 | 7 | `APKs/Dactor-PatientApp-v1.0.6.apk` | Fix live tracking queue position: displays exact live count of patients ahead in line in concentric circle badge & main screen with "Token #X" pill; handles NOW/UP NEXT states; cache force-refresh support |
| 2026-10-14 | Patient | v1.0.32 | 32 | `APKs/Dactor-PatientApp-v1.0.32.apk` | Fix search page: replaced squished chunked(3) specialty chips with dynamic wrapping `FlowRow`, added maxLines=1 with ellipsis, fixed brace balance in PatientMainScreen & NotificationsScreen, and configured SSD build cache |
| 2026-10-14 | Clinic & Doctor | v1.0.30 | 30 | `APKs/Dactor-ClinicApp-v1.0.30.apk` | Resilient network gate (eliminates false "No internet connection" banner); multi-visit cumulative billing with timestamped payment log & date-wise directory; resolved duplicate variable collisions; on-demand formal PDF generator |
| 2026-10-14 | Patient | v1.0.40 | 40 | `APKs/Dactor-PatientApp-v1.0.40.apk` | Resilient network gate (eliminates false "No internet connection" banner); FlowRow specialty chips; live Payment Receipts & Time Log timeline on Queue Status screen; clean clinical remarks; updated PDF invoice with payment receipt table |
| 2026-10-16 | Patient | v1.0.45 | 45 | `APKs/Dactor-PatientApp-v1.0.45.apk` | Show all doctors on clinic profile: replaced single-doctor firstOrNull restriction with full consulting doctors list, per-doctor booking navigation, forceRefresh doctor roster, interactive clinic link in booking screen |
| 2026-10-16 | Clinic & Doctor | v1.0.38 | 38 | `APKs/Dactor-ClinicApp-v1.0.38.apk` | Generated fresh release APK: local Android SDK resolution, JBR JDK 17 support, and build6 output parity |
| 2026-10-16 | Patient | v1.0.46 | 46 | `APKs/Dactor-PatientApp-v1.0.46.apk` | Fixed SHA ID permanently: integrated shared project debug keystore (`keystores/debug.keystore`), updated `google-services.json` from Firebase, verified SHA-1 `b65ff6c53826dfbf360ec3fd2d75af2e83ea2c79` |
| 2026-10-16 | Clinic & Doctor | v1.0.39 | 39 | `APKs/Dactor-ClinicApp-v1.0.39.apk` | Fixed SHA ID permanently: integrated shared project debug keystore (`keystores/debug.keystore`), updated `google-services.json` from Firebase, verified SHA-1 `b65ff6c53826dfbf360ec3fd2d75af2e83ea2c79` |
| 2026-10-17 | Clinic & Doctor | v1.0.41 | 41 | `APKs/Dactor-ClinicApp-v1.0.41.apk` | Filtered out system_config:support from specialty list, dynamic multi-laptop SDK/Java paths, permanent shared keystore verified SHA-1: `b65ff6c53826dfbf360ec3fd2d75af2e83ea2c79` |
| 2026-10-17 | Patient | v1.0.49 | 49 | `APKs/Dactor-PatientApp-v1.0.49.apk` | Added 1-tap Save Code option on QueueStatusScreen for logged-in users with Supabase claim, resolved system_config specialty filter, fixed BookingScreen reschedule syntax, permanent shared keystore verified SHA-1: `b65ff6c53826dfbf360ec3fd2d75af2e83ea2c79` |

---

## 8. Support Desk URL Publisher & Network-Wide "Contact Us" Integration (October 2026)

### A. Admin Portal Support URL Publisher
- Created `admin-panel/src/pages/SupportSettings.tsx` accessible via `/support-settings` with Globe navigation icon and quick action card in Dashboard.
- Supports custom support site URL publishing with quick presets (Dactor Support Desk, WhatsApp Helpline, Direct Support Email).
- Dual-layer real-time cloud persistence: reads/writes to Supabase `system_settings` or `medical_specialties` (`category = 'system_config'`, `name = 'system_config:support_url'`).

### B. Web Application & Fallback Support Desk
- Created `web-app/src/pages/Support.tsx` with contact form, WhatsApp direct link, phone/email contact cards, and FAQ accordion.
- Available at `https://dactorofficial.github.io/support` and hash route `/#support`.
- Dynamic fallback resolution: `getSupportUrl()` in `web-app/src/services/db.ts` queries Supabase, falls back to `localStorage`, and defaults to `https://dactorofficial.github.io/support`.

### C. Verification Screen & Profile Settings "Contact Support" Buttons
- **Verification Screens**:
  - Clinic Portal (`web-app/src/pages/ClinicPortal.tsx` & `clinic-app` `ClinicLoginScreen.kt`): Prominent "Contact Dactor Support & Onboarding Desk" button displayed when clinic account is in `pending_verification` state.
  - Doctor Portal (`web-app/src/pages/DoctorPortal.tsx` & `clinic-app` `DoctorKYCScreen.kt`): Prominent "Contact Dactor Practitioner Support Desk" button displayed when practitioner KYC is pending review.
- **Profile Settings Screens**:
  - Clinic Settings (`ClinicPortal.tsx` & `ClinicSettingsScreen.kt`): Dedicated "Contact Us & Dactor Helpdesk Support" section.
  - Doctor Profile Settings (`DoctorPortal.tsx`): Dedicated "Contact Us & Practitioner Helpdesk" card.
  - Patient Profile Settings (`PatientPortal.tsx` & `ProfileScreen.kt`): "Contact Us & Dactor Helpdesk Support" entry opening the live support destination.

### D. Build & Release Constraint Compliance
- Per explicit user instruction **"dont make apk"**, zero Gradle APK build tasks were executed (`assembleDebug` / `assembleRelease` avoided).
- Web App built and deployed cleanly to GitHub Pages (`dactorofficial.github.io`).
- Admin Portal built and committed to `https://github.com/dactorofficial/admin-portal.git`.

---

## 10. Decoupling Working Hours & Manual Slot Publishing ("Add slot") (October 2026)

### A. Working Hours Decoupled from Online Booking Slots
- **Informational Working Hours**: Clinic operating hours and weekly schedules are strictly informational (informing patients of general operating windows). They never auto-generate booking slots.
- **Removed Automatic 7-Day Slot Generation**: Removed the automatic loop in `clinic-app/app/src/main/java/com/dactor/clinic/ui/slots/SlotManagerScreen.kt` that was inserting slots into Supabase for 7 days ahead on saving the weekly schedule.
- **Strict Manual Slot Publishing**: Booking slots exist in the database and appear to patients if and only if staff/doctors explicitly create them.

### B. Standardized Button Label to "Add slot"
- **`clinic-app`**:
  - `SlotManagerScreen.kt`: Button updated from `Publish Slot for $selectedDate` ➔ `Add slot`. Dialog title updated to `Add Slot ($selectedDate)` and submit button to `Add slot`.
  - `FutureAppointmentsScreen.kt`: FAB label updated to `Add slot`, submit button updated from `Publish Slot` ➔ `Add slot`, and empty state prompt updated.
- **`web-app`**:
  - `ClinicPortal.tsx`: Button updated from `Publish Timed Slot` ➔ `Add slot`, and header updated to `Add Timed Slot`.
- **`patient-app`**:
  - Buttons previously showing awkward or clipped `Book on another date` streamlined to `Book` (with availability status clearly indicated above the button).

### C. Release Constraint
- Per user instruction **"no apk generation"**, zero APKs were compiled. All changes are committed directly into the codebase and web build.

---

## 12. Booking Confirmation Enrichment & Unrestricted Slot Publishing (October 2026)

### A. Complete Booking Confirmation Screen Details
- **Root Cause of Empty Fields**: `AppointmentConfirmedScreen.kt` previously took `clinicName` and `doctorName` only as empty default parameters without resolving `clinicRepository` or `doctorRepository`, omitted patient name entirely, and defaulted time window to a static `09:30` point string.
- **Enriched Information Display**:
  - **Clinic & Facility**: Resolves `clinicRepository.getClinicById(appt.clinicId)` to show full clinic name (e.g., `Patan Clinic`) with hospital badge icon.
  - **Consulting Doctor**: Resolves `doctorRepository.getDoctorById(appt.doctorId)` to show full doctor name and specialty (e.g., `Dr. Kshitiz • Ophthalmology`) with specialist icon.
  - **Patient Name**: Displays `appt.patientName` (e.g., `Nitup (User)`) with dedicated patient badge icon.
  - **Slot Time Window**: Formats the full slot interval (e.g., `09:00 AM – 12:00 PM`) using `slotRepository.getSlotById(appt.slotId)` or normalized slot interval, accompanied by the formatted appointment date (e.g., `Saturday, 17 Oct 2026`).
- **Zero-Flicker Session Caching**:
  - Added `saveLastConfirmedAppointment()` and `getLastConfirmedAppointment()` to `UserSessionManager.kt`.
  - `PaymentScreen.kt` and `BookingFormScreen.kt` immediately persist the confirmed appointment summary to local storage prior to navigation, ensuring instant, non-empty rendering while asynchronous Supabase resolution verifies freshness.
- **Navigation Wiring**:
  - Updated `DactorNavHost.kt` to inject `clinicRepository`, `doctorRepository`, and `slotRepository` into `AppointmentConfirmedScreen`.

### B. Unrestricted Slot Publishing (After-Hours & Closed Days)
- **Clinic App (`clinic-app`)**:
  - `SlotManagerScreen.kt`: Relaxed `hasTimeError` check to `isDateInPast || isInvalidInterval`. Removed the restrictive `isTimeInPast` lock (`startMinutes < minAllowedMinutesToday`) that previously prevented clinic staff from adding after-hours or current-session slots.
  - `FutureAppointmentsScreen.kt`: Relaxed `hasTimeError` check to `isDateInPast || isInvalidInterval`. Removed the block (`startMinutes <= currentMinutesToday`) that erroneously flagged ongoing slots (e.g., 9 to 12 slot opened at 10 AM) as past.
  - Added helpful status confirmation: `✓ Slot Time Window: START to END — Can be published anytime, even on closed days or outside regular hours.`
  - Enabled override authority so clinics can freely publish slots on declared holidays, weekends, or outside regular informational working hours.
- **Web Portal (`web-app`)**:
  - Confirmed that `handlePublishSlot` in `ClinicPortal.tsx` publishes slots directly to Supabase without any restrictive constraints on clinic hours or closed days.

### C. Generative UI Interactive Preview
- Created `C:\Users\nitup\.gemini\antigravity\brain\2aa84235-d09f-4d53-b5ff-9f9d82ad3056/booking_success_ui_preview.html` adhering strictly to the user's explicit preference (**keep original theme**):
  - Uses Tailwind CSS with Dactor design tokens (emerald green `#059669`, clean card typography, and blue-tinted 10-digit tracking card).
  - Showcases complete metadata: Clinic Name, Doctor Name with Specialty, Patient Name, and the full `09:00 AM – 12:00 PM` Slot Time Window.
  - Interactive demonstration controls for copy-code toast, sample switching (9-12 slot vs. after-hours), and navigation preview.

### D. Release Constraint Compliance
- Per explicit instruction **"no apk generation"**, zero APK binaries were compiled. All code changes are committed directly in source files.

---

## 13. Next Recommended Priorities
1. **Confirmation Screen Live Review**: Open the Generative UI preview in the chat/browser to confirm the visual presentation of the redesigned booking confirmation screen.
2. **Physical App Booking Verification**: Perform a test booking on the patient app to verify that Clinic Name, Doctor Name, Patient Name, and the full `09:00 AM – 12:00 PM` slot window render cleanly.
3. **Clinic Slot Creation After-Hours**: Open the Clinic app on a closed day or after operating hours, tap "Add slot", and verify that slots can be published without validation errors.


