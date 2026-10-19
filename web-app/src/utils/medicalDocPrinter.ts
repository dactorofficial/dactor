import { Appointment, BillingInvoice } from '../types'
import { parsePaymentRecords, extractCleanClinicalRemarks } from './paymentLedger'

/**
 * Universal printer for official medical appointment invoice & bill receipt.
 * Itemizes services, procedural additions, payment logs, and remaining balance.
 */
export function printAppointmentBill(appt: Appointment, invoice?: BillingInvoice | null): void {
  const win = window.open('', '_blank', 'width=800,height=750')
  if (!win) return

  const clinicTitle = appt.clinic?.name || 'Dactor Certified Healthcare Center'
  const clinicAddr = appt.clinic?.addressText || 'Kathmandu, Nepal'
  const docTitle = appt.doctor?.fullName || 'General OPD Specialist'
  const docSpec = appt.doctor?.specialty || 'General Medicine'

  const inv = invoice
  const effectiveTotal = inv?.totalAmount && inv.totalAmount > 0 ? inv.totalAmount : (appt.feeAmount || 0)
  const effectivePaid = inv ? inv.paidAmount : (appt.paymentStatus === 'paid' ? effectiveTotal : 0)
  const effectiveBalance = Math.max(0, effectiveTotal - effectivePaid)
  const isPaid = effectiveBalance <= 0 && effectiveTotal > 0

  const paymentLogs = parsePaymentRecords(inv?.remarks, effectivePaid, inv?.paidAt)
  const cleanRemarks = extractCleanClinicalRemarks(inv?.remarks)

  const rawItems = inv?.items && inv.items.length > 0 ? inv.items : []
  const items = rawItems.length > 0
    ? rawItems.map((it) => ({
        name: it.itemName || it.name || 'Clinical Service',
        quantity: it.quantity || 1,
        price: it.price || 0,
        total: it.total || (it.price * (it.quantity || 1)),
      }))
    : [
        {
          name: `Doctor Consultation & OPD Entry (${appt.appointmentDate})`,
          quantity: 1,
          price: effectiveTotal,
          total: effectiveTotal,
        },
      ]

  const itemsRowsHtml = items
    .map(
      (it, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${it.name}</strong></td>
        <td style="text-align:center;">${it.quantity}</td>
        <td style="text-align:right;">Rs. ${it.price}</td>
        <td style="text-align:right;font-weight:700;">Rs. ${it.total}</td>
      </tr>`
    )
    .join('')

  const paymentLogsHtml = paymentLogs.length > 0
    ? `
      <div style="margin-top:20px;">
        <h4 style="margin:0 0 8px;font-size:12px;color:#166534;text-transform:uppercase;letter-spacing:0.5px;">Payment Receipts & Time Log</h4>
        <table style="width:100%;border-collapse:collapse;border:1px solid #bbf7d0;">
          <thead>
            <tr style="background:#dcfce7;color:#14532d;font-size:10px;text-transform:uppercase;">
              <th style="padding:6px;">Date & Time Log</th>
              <th style="padding:6px;">Note / Mode</th>
              <th style="padding:6px;text-align:right;">Paid (NPR)</th>
            </tr>
          </thead>
          <tbody>
            ${paymentLogs
              .map(
                (p) => `
              <tr style="font-size:12px;border-bottom:1px solid #e2e8f0;">
                <td style="padding:6px;font-family:monospace;">${p.dateTime}</td>
                <td style="padding:6px;color:#475569;">${p.note || 'Payment Received'}</td>
                <td style="padding:6px;text-align:right;font-weight:700;color:#15803d;">Rs. ${p.amount}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
    : ''

  const cleanRemarksHtml = cleanRemarks
    ? `
      <div style="margin-top:14px;padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:11px;">
        <strong style="color:#0f172a;">Doctor Clinical Remarks & Prescriptions:</strong>
        <p style="margin:4px 0 0;color:#334155;white-space:pre-wrap;">${cleanRemarks}</p>
      </div>`
    : ''

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Dactor Official Bill - #${appt.trackingCode10Digit}</title>
        <style>
          body { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; padding: 28px; color: #0f172a; background: #fff; }
          .box { max-width: 680px; margin: 0 auto; border: 2px solid #0d9488; border-radius: 16px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f0fdfa; padding-bottom: 14px; margin-bottom: 14px; }
          .badge { background: ${isPaid ? '#ecfdf5' : '#fffbeb'}; color: ${isPaid ? '#047857' : '#b45309'}; border: 1px solid ${isPaid ? '#a7f3d0' : '#fde68a'}; padding: 5px 12px; border-radius: 999px; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
          .code-box { background: #f0fdf4; border: 1px dashed #14b8a6; border-radius: 12px; padding: 10px 14px; margin: 12px 0; text-align: center; }
          .code { font-family: monospace; font-size: 26px; font-weight: 900; letter-spacing: 4px; color: #0f766e; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px 6px; text-align: left; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
          th { color: #64748b; text-transform: uppercase; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; }
          .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="box">
          <div class="header">
            <div>
              <h2 style="margin:0;font-size:20px;color:#0f172a;">${clinicTitle}</h2>
              <p style="margin:3px 0 0;font-size:12px;color:#64748b;">${clinicAddr}</p>
              <p style="margin:2px 0 0;font-size:11px;font-weight:700;color:#0d9488;">Official Medical Invoice & OPD Receipt</p>
            </div>
            <span class="badge">${isPaid ? 'PAID FULL' : (effectivePaid > 0 ? 'PARTIAL PAID' : 'PAYABLE AT CLINIC')}</span>
          </div>

          <div class="code-box">
            <div style="font-size:10px;text-transform:uppercase;color:#0f766e;font-weight:800;letter-spacing:1px;">10-Digit Live OPD Queue Token</div>
            <div class="code">#${appt.trackingCode10Digit}</div>
            <div style="font-size:11px;color:#475569;margin-top:2px;">Present this token at the reception desk for instant check-in</div>
          </div>

          <table style="margin-bottom:16px;">
            <tr><th style="width:30%;">Patient Name</th><td><strong>${appt.patientName}</strong> (${appt.patientAge || '–'} Yrs, ${appt.patientGender || '–'})</td></tr>
            <tr><th>Attending Doctor</th><td>Dr. ${docTitle} (${docSpec})</td></tr>
            <tr><th>Date & Time</th><td><strong>${appt.appointmentDate}</strong> • ${appt.appointmentTime}</td></tr>
            <tr><th>Contact Phone</th><td><span style="font-family:monospace;">${appt.patientMobile || '–'}</span></td></tr>
          </table>

          <div style="margin-top:10px;">
            <h4 style="margin:0 0 6px;font-size:11px;color:#334155;text-transform:uppercase;letter-spacing:0.5px;">Services & Procedures</h4>
            <table style="border:1px solid #e2e8f0;">
              <thead style="background:#f8fafc;">
                <tr>
                  <th style="width:30px;">#</th>
                  <th>Description</th>
                  <th style="text-align:center;">Qty</th>
                  <th style="text-align:right;">Rate</th>
                  <th style="text-align:right;">Total (NPR)</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRowsHtml}
              </tbody>
            </table>
          </div>

          ${paymentLogsHtml}

          <div style="margin-top:16px;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:10px;padding:12px;font-size:12px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <span style="color:#475569;">Total Combined Bill:</span>
              <strong style="font-size:14px;color:#0f172a;">Rs. ${effectiveTotal}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;color:#15803d;font-weight:700;">
              <span>Total Paid to Date:</span>
              <span>Rs. ${effectivePaid}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding-top:6px;border-top:1px dashed #99f6e4;color:#b91c1c;font-weight:800;font-size:13px;">
              <span>Balance Due:</span>
              <span>Rs. ${effectiveBalance}</span>
            </div>
          </div>

          ${cleanRemarksHtml}

          <div class="footer">
            <p style="margin:0;font-weight:700;color:#334155;">Verified by Dactor Unified Health Cloud Network • Computer Generated Official Receipt</p>
            <p style="margin:3px 0 0;font-size:10px;">Printed on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
          </div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
    </html>
  `)
  win.document.close()
}

/**
 * Universal printer for official clinical prescription (Rx) document.
 * Parses diagnosis, medicine table, clinical remarks, and triggers print.
 */
export function printPrescription(appt: Appointment): void {
  const win = window.open('', '_blank', 'width=800,height=750')
  if (!win) return

  let parsedRx: {
    diagnosis?: string
    medicines?: Array<{ name: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }>
    advice?: string
  } | null = null

  try {
    if (appt.notes && (appt.notes.trim().startsWith('{') || appt.notes.trim().startsWith('['))) {
      parsedRx = JSON.parse(appt.notes)
    }
  } catch {}

  const diagnosisText = parsedRx?.diagnosis || appt.notes || 'Routine Clinical Consultation'
  const adviceText = parsedRx?.advice || ''
  const medicines = parsedRx?.medicines || []

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>℞ Prescription - #${appt.trackingCode10Digit}</title>
        <style>
          body { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; padding: 28px; color: #0f172a; background: #fff; }
          .box { max-width: 680px; margin: 0 auto; border: 2px solid #2563eb; border-radius: 16px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #eff6ff; padding-bottom: 14px; margin-bottom: 14px; }
          .rx-title { color: #2563eb; font-size: 24px; font-weight: 900; margin: 0; }
          .tag { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 999px; font-weight: 800; font-size: 11px; }
          .token-bar { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 8px 12px; margin: 12px 0; display: flex; justify-content: space-between; font-size: 12px; }
          .section { margin-top: 16px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 12px; }
          .section-title { font-weight: 800; color: #1e293b; margin-bottom: 6px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
          th, td { padding: 8px 6px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { font-size: 10px; text-transform: uppercase; color: #64748b; background: #f1f5f9; }
          .footer { margin-top: 24px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; color: #64748b; }
          .signature { border-top: 1px solid #94a3b8; width: 140px; text-align: center; padding-top: 4px; font-weight: 700; color: #0f172a; }
        </style>
      </head>
      <body>
        <div class="box">
          <div class="header">
            <div>
              <h1 class="rx-title">℞ PRESCRIPTION</h1>
              <p style="margin: 3px 0 0; font-size: 12px; color: #64748b; font-weight: 600;">Dactor Medical Network Record</p>
            </div>
            <span class="tag">OFFICIAL DIGITAL RX</span>
          </div>

          <div class="token-bar">
            <span><strong>Token:</strong> #${appt.trackingCode10Digit}</span>
            <span><strong>Date:</strong> ${appt.appointmentDate} (${appt.appointmentTime || 'OPD'})</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; margin-bottom: 12px;">
            <div style="background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #f1f5f9;">
              <span style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block;">Attending Doctor</span>
              <strong style="color: #0f172a;">${appt.doctor?.fullName || 'OPD Specialist'}</strong>
              <span style="display: block; color: #2563eb; font-size: 11px;">${appt.doctor?.specialty || 'General Medicine'}</span>
            </div>
            <div style="background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #f1f5f9;">
              <span style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block;">Patient Details</span>
              <strong style="color: #0f172a;">${appt.patientName}</strong>
              <span style="display: block; color: #64748b; font-size: 11px;">${appt.patientAge || '-'} Yrs • ${appt.patientGender || '-'} • ${appt.patientMobile || ''}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Clinical Diagnosis / Impression</div>
            <div style="font-weight: 600; color: #0f172a;">${diagnosisText}</div>
          </div>

          ${
            medicines.length > 0
              ? `
              <div class="section" style="padding: 6px 12px;">
                <div class="section-title" style="margin-top: 6px;">Prescribed Medicines (Rx)</div>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Medicine</th>
                      <th>Dosage</th>
                      <th>Frequency</th>
                      <th>Duration</th>
                      <th>Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${medicines
                      .map(
                        (m, i) => `
                      <tr>
                        <td>${i + 1}</td>
                        <td style="font-weight: 700; color: #0f172a;">${m.name}</td>
                        <td>${m.dosage || '-'}</td>
                        <td>${m.frequency || '-'}</td>
                        <td>${m.duration || '-'}</td>
                        <td style="color: #2563eb;">${m.instructions || '-'}</td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
              : ''
          }

          ${
            adviceText
              ? `
              <div class="section">
                <div class="section-title">Special Advice / Clinical Instructions</div>
                <div style="color: #334155;">${adviceText}</div>
              </div>
            `
              : ''
          }

          <div class="footer">
            <div>
              <p style="margin: 0; font-weight: 600;">Clinic: ${appt.clinic?.name || 'Dactor Clinic'}</p>
              <p style="margin: 2px 0 0;">Validated via Dactor Electronic Health Record</p>
            </div>
            <div class="signature">
              Doctor's Signature
            </div>
          </div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
    </html>
  `)
  win.document.close()
}
