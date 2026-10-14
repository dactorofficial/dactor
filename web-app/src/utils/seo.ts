import { Clinic, Doctor } from '../types'

/**
 * Dactor Dynamic SEO & Schema.org Structured Data Injector
 * 
 * Supports:
 * - Google Rich Results & Knowledge Graph (MedicalClinic, Physician)
 * - Google Reserve / Appointment Booking Actions (schema.org/ReserveAction)
 * - Generative Engine Optimization (GEO) for AI search engines (ChatGPT, Perplexity, Gemini, Claude)
 * - OpenGraph (Facebook, WhatsApp, LinkedIn) and Twitter Card metadata
 */

const BASE_URL = 'https://dactorofficial.github.io/dactor'
const SCRIPT_ID = 'dactor-dynamic-schema-ldjson'

export function updatePageSEO(options: {
  title?: string
  description?: string
  canonicalUrl?: string
  ogImage?: string
  clinic?: Clinic | null
  doctor?: Doctor | null
  allDoctors?: Doctor[]
}) {
  if (typeof document === 'undefined') return

  const { title, description, canonicalUrl, ogImage, clinic, doctor, allDoctors } = options

  // 1. Update Title Tag
  if (title) {
    document.title = title
    updateMetaTag('title', title)
    updateMetaProperty('og:title', title)
    updateMetaProperty('twitter:title', title)
  }

  // 2. Update Description Tag
  if (description) {
    updateMetaTag('description', description)
    updateMetaProperty('og:description', description)
    updateMetaProperty('twitter:description', description)
  }

  // 3. Update Canonical & OpenGraph URL
  const activeUrl = canonicalUrl || (clinic ? `${BASE_URL}/?clinic=${clinic.id}` : BASE_URL)
  updateMetaProperty('og:url', activeUrl)
  updateMetaProperty('twitter:url', activeUrl)

  let linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!linkCanonical) {
    linkCanonical = document.createElement('link')
    linkCanonical.rel = 'canonical'
    document.head.appendChild(linkCanonical)
  }
  linkCanonical.href = activeUrl

  // 4. Update OpenGraph Image
  const imageUrl = ogImage || clinic?.pictures?.[0] || clinic?.logoUrl || `${BASE_URL}/app_logo.png`
  updateMetaProperty('og:image', imageUrl)
  updateMetaProperty('twitter:image', imageUrl)

  // 5. Inject / Update Schema.org JSON-LD Structured Data
  if (clinic) {
    injectClinicJsonLd(clinic, doctor, allDoctors)
  } else {
    resetDefaultJsonLd()
  }
}

function updateMetaTag(name: string, content: string) {
  let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
  if (!tag) {
    tag = document.createElement('meta')
    tag.name = name
    document.head.appendChild(tag)
  }
  tag.content = content
}

function updateMetaProperty(property: string, content: string) {
  let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('property', property)
    document.head.appendChild(tag)
  }
  tag.content = content
}

/**
 * Builds Schema.org JSON-LD with ReserveAction so Google Search surfaces
 * a "Book Online" / "Make an Appointment" rich action leading directly to Dactor.
 */
function injectClinicJsonLd(clinic: Clinic, selectedDoctor?: Doctor | null, doctors: Doctor[] = []) {
  const isLab = clinic.type === 'diagnostic_lab' || clinic.name.toLowerCase().includes('lab')
  const clinicUrl = `${BASE_URL}/?clinic=${clinic.id}`
  const bookUrl = `${BASE_URL}/?clinic=${clinic.id}&action=book`

  // Base Schema for the Clinic
  const clinicSchema: any = {
    '@context': 'https://schema.org',
    '@type': isLab ? 'DiagnosticLab' : 'MedicalClinic',
    '@id': `${clinicUrl}#clinic`,
    name: clinic.name,
    description: clinic.description || `${clinic.name} - Online doctor appointments, OPD queue tracking, and diagnostic reports in Nepal.`,
    url: clinicUrl,
    telephone: clinic.contactPhone || undefined,
    email: clinic.contactEmail || undefined,
    image: clinic.pictures && clinic.pictures.length > 0 ? clinic.pictures : `${BASE_URL}/app_logo.png`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: clinic.addressText || 'Nepal',
      addressLocality: clinic.city || 'Kathmandu',
      addressCountry: 'NP',
    },
    priceRange: 'NPR',
    // Google Reserve / Appointment Booking Action
    potentialAction: {
      '@type': 'ReserveAction',
      name: `Book Appointment at ${clinic.name}`,
      target: {
        '@type': 'EntryPoint',
        urlTemplate: bookUrl,
        inLanguage: 'en',
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
          'http://schema.org/AndroidPlatform',
        ],
      },
      result: {
        '@type': 'MedicalReservation',
        name: `OPD Appointment at ${clinic.name}`,
      },
    },
  }

  if (clinic.latitude && clinic.longitude) {
    clinicSchema.geo = {
      '@type': 'GeoCoordinates',
      latitude: clinic.latitude,
      longitude: clinic.longitude,
    }
  }

  if (clinic.specialties && clinic.specialties.length > 0) {
    clinicSchema.medicalSpecialty = clinic.specialties
  }

  // Add individual Physicians working at this clinic
  const physicianSchemas: any[] = []
  const docsToInclude = selectedDoctor ? [selectedDoctor] : doctors

  for (const doc of docsToInclude) {
    const docBookUrl = `${BASE_URL}/?clinic=${clinic.id}&doctor=${doc.id}&action=book`
    physicianSchemas.push({
      '@context': 'https://schema.org',
      '@type': 'Physician',
      '@id': `${clinicUrl}#doctor-${doc.id}`,
      name: doc.fullName,
      jobTitle: doc.specialty || 'Medical Specialist',
      medicalSpecialty: doc.specialties && doc.specialties.length > 0 ? doc.specialties : doc.specialty,
      worksFor: {
        '@type': 'MedicalClinic',
        name: clinic.name,
        url: clinicUrl,
      },
      potentialAction: {
        '@type': 'ReserveAction',
        name: `Book Appointment with ${doc.fullName}`,
        target: {
          '@type': 'EntryPoint',
          urlTemplate: docBookUrl,
          inLanguage: 'en',
          actionPlatform: [
            'http://schema.org/DesktopWebPlatform',
            'http://schema.org/MobileWebPlatform',
            'http://schema.org/AndroidPlatform',
          ],
        },
        result: {
          '@type': 'MedicalReservation',
          name: `Doctor Consultation with ${doc.fullName}`,
        },
      },
    })
  }

  const fullGraph = {
    '@context': 'https://schema.org',
    '@graph': [clinicSchema, ...physicianSchemas],
  }

  let scriptEl = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
  if (!scriptEl) {
    scriptEl = document.createElement('script')
    scriptEl.id = SCRIPT_ID
    scriptEl.type = 'application/ld+json'
    document.head.appendChild(scriptEl)
  }
  scriptEl.textContent = JSON.stringify(fullGraph, null, 2)
}

function resetDefaultJsonLd() {
  const existing = document.getElementById(SCRIPT_ID)
  if (existing) {
    existing.remove()
  }
}
