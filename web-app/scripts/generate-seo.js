// Node.js script to dynamically generate SEO sitemaps from Supabase database
// Run: node scripts/generate-seo.js

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SUPABASE_URL = 'https://ojfoofojcpabqegxmsab.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qZm9vZm9qY3BhYnFlZ3htc2FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNTM1MTgsImV4cCI6MjEwNTkyOTUxOH0.pH1yOGykaaQTzlQxeCvcQ78HQwxhTSi4yA8JmvT-Y9Y'
const BASE_URL = 'https://dactorofficial.github.io/dactor'

async function generateSitemap() {
  console.log('Generating dynamic SEO sitemap from Supabase...')
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const today = new Date().toISOString().split('T')[0]

  let clinics = []
  let doctors = []

  try {
    const { data: cData, error: cErr } = await client
      .from('clinics')
      .select('id, name, type, address_text, specialties, updated_at, verification_status, is_archived')
    if (cErr) {
      console.warn('Clinics query notice:', cErr.message)
    } else {
      clinics = (cData || []).filter(c => !c.is_archived)
    }
  } catch (e) {
    console.warn('Error reading clinics:', e)
  }

  try {
    const { data: dData, error: dErr } = await client
      .from('doctors')
      .select('id, full_name, specialty, clinic_id, updated_at')
    if (dErr) {
      console.warn('Doctors query notice:', dErr.message)
    } else {
      doctors = dData || []
    }
  } catch (e) {
    console.warn('Error reading doctors:', e)
  }

  console.log(`Fetched ${clinics.length} clinics and ${doctors.length} doctors from Supabase.`)

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <!-- Core Dactor Portal Routes -->
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>${BASE_URL}/app_logo.png</image:loc>
      <image:title>Dactor - Nepal Healthcare OPD Queue and Diagnostic Ecosystem</image:title>
    </image:image>
  </url>
  <url>
    <loc>${BASE_URL}/?tab=clinics</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${BASE_URL}/?tab=live-queue</loc>
    <lastmod>${today}</lastmod>
    <changefreq>always</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${BASE_URL}/?tab=lab-reports</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${BASE_URL}/?tab=average-time</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${BASE_URL}/?page=support</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`

  // Add individual clinic URLs and direct booking links
  for (const c of clinics) {
    const mod = c.updated_at ? c.updated_at.split('T')[0] : today
    // Direct booking action URL
    xml += `
  <!-- Clinic Booking: ${escapeXml(c.name)} -->
  <url>
    <loc>${BASE_URL}/?clinic=${encodeURIComponent(c.id)}&amp;action=book</loc>
    <lastmod>${mod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.95</priority>
  </url>
  <url>
    <loc>${BASE_URL}/?clinic=${encodeURIComponent(c.id)}</loc>
    <lastmod>${mod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>`
  }

  // Add individual doctor appointment booking URLs
  for (const d of doctors) {
    if (!d.clinic_id) continue
    const mod = d.updated_at ? d.updated_at.split('T')[0] : today
    xml += `
  <!-- Doctor Appointment Booking: ${escapeXml(d.full_name)} -->
  <url>
    <loc>${BASE_URL}/?clinic=${encodeURIComponent(d.clinic_id)}&amp;doctor=${encodeURIComponent(d.id)}&amp;action=book</loc>
    <lastmod>${mod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.95</priority>
  </url>`
  }

  xml += `\n</urlset>\n`

  const publicDir = path.resolve(__dirname, '../public')
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
  }

  const sitemapPath = path.join(publicDir, 'sitemap.xml')
  fs.writeFileSync(sitemapPath, xml, 'utf8')
  console.log(`✅ Successfully generated sitemap with ${6 + (clinics.length * 2) + doctors.length} indexed URLs at: ${sitemapPath}`)
}

function escapeXml(unsafe) {
  if (!unsafe) return ''
  return String(unsafe).replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '\'': return '&apos;'
      case '"': return '&quot;'
    }
  })
}

generateSitemap()
