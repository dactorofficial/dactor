export interface Clinic {
  id: string
  name: string
  type?: string // polyclinic, diagnostic_lab, opd_clinic, single_visit, multi_visit, etc.
  verificationStatus?: string // approved, pending, rejected
  contactPhone?: string
  contactEmail?: string
  addressText?: string
  latitude?: number
  longitude?: number
  city?: string
  autoNotifyThreshold?: number
  description?: string
  panNumber?: string
  managerPhone?: string
  registrationDocUrl?: string
  pictures?: string[]
  specialties?: string[]
  createdAt?: string
  updatedAt?: string
  isArchived?: boolean
  archivedAt?: string
  deletionScheduledAt?: string
  logoUrl?: string
  isOnBreak?: boolean
  breakUpdatedAt?: string
  weeklyScheduleJson?: string
  declaredHolidays?: string[]
  avgConsultationTimeMinutes?: number
  averageConsultationMinutes?: number
  manualAvgConsultationTimeMinutes?: number
  calculatedAvgConsultationTimeMinutes?: number
  avgTimeMode?: string
  // Subscription & Activation fields
  isActivated?: boolean
  activationExpiresAt?: string
  activationPlan?: string
  activationPaidAmount?: number
  activationNotes?: string
  activationPaymentProofUrl?: string
  // Payment Gateway Config fields
  paymentGatewayProvider?: string
  paymentApiKey?: string
  paymentSecretKey?: string
  merchantId?: string
  isDirectPaymentEnabled?: boolean
}

export interface ClinicInvitation {
  id: string
  clinicId: string
  clinicName?: string
  doctorId?: string
  invitedEmail: string
  invitedName: string
  role: 'doctor' | 'lab_technician'
  specialty?: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  createdAt: string
}

export interface DayScheduleInfo {
  day: string
  isOpen: boolean
  openTime: string
  closeTime: string
  hasBreak: boolean
  breakStart: string
  breakEnd: string
}

export interface Doctor {
  id: string
  fullName: string
  email: string
  specialty?: string
  specialties?: string[]
  education?: string
  nmcLicenseNumber?: string
  experienceYears?: number
  startingPracticingYear?: number
  gender?: string
  age?: number
  personalMobileNumber?: string
  publicMobileNumber?: string
  consultationFee?: number
  isInClinic?: boolean
  clinicId?: string
  activeClinicId?: string
  kycStatus?: string // approved, pending, rejected
  profilePictureUrl?: string
  description?: string
  bio?: string
  practitionerRole?: string // doctor or lab_technician
  isLabTechnician?: boolean
}

export interface Slot {
  id: string
  clinicId: string
  doctorId: string
  slotDate: string
  startTime: string
  endTime: string
  maxCapacity: number
  bookedCount: number
  isAvailable?: boolean
  isBreak?: boolean
  isPublished?: boolean
}

export interface ClinicService {
  id: string
  clinicId: string
  serviceName: string
  price: number
  category?: string
  description?: string
  isAvailable?: boolean
}

export interface Appointment {
  id: string
  trackingCode10Digit: string
  userId?: string | null
  clinicId: string
  doctorId?: string | null
  slotId?: string | null
  patientName: string
  patientAge?: number | null
  patientGender?: string | null
  patientMobile?: string | null
  patientEmail?: string | null
  appointmentDate: string
  appointmentTime: string
  checkinStatus: string // booked, waiting, in_consultation, completed, cancelled, no_show
  paymentStatus: string // unpaid, paid, partial
  paymentMethod?: string
  feeAmount: number
  queueNumber?: number
  queuePosition?: number
  notes?: string
  isWalkin?: boolean
  optInEarlyCall?: boolean
  createdAt?: string
  updatedAt?: string
  selectedTests?: string[]
  selectedLabTests?: string[] | string
  // Joined fields for display
  clinic?: Clinic
  doctor?: Doctor
}

export interface LabReport {
  id: string
  appointmentId?: string
  trackingCode10Digit: string
  patientName: string
  clinicId: string
  testName: string
  reportFileUrl?: string
  reportFileType?: string // pdf, image
  status: 'sample_collected' | 'processing' | 'prepared' | 'delivered'
  uploadedAt?: string
  sampleCollectedAt?: string
  preparedAt?: string
  technicianNotes?: string
}

export interface DactorNotification {
  id: string
  userId?: string
  clinicId?: string
  title: string
  message: string
  type: string // queue_update, lab_report, appointment_reminder, clinic_broadcast
  metaJson?: string
  isRead: boolean
  createdAt: string
  // Parsed template metadata
  leftLabel?: string
  leftValue?: string
  rightLabel?: string
  rightValue?: string
  trackingCode?: string
}

export interface MedicalSpecialty {
  id: string
  name: string
  description?: string
  iconName?: string
}

export interface MedicalQualification {
  id: string
  degreeName: string
  fullTitle?: string
}

export interface BillingInvoice {
  id: string
  appointmentId: string
  clinicId: string
  totalAmount: number
  paidAmount: number
  balanceDue: number
  paymentStatus: string // paid, partial, unpaid
  paidAt?: string
  remarks?: string
  receiptUrl?: string
  items?: { id?: string; itemName?: string; name?: string; quantity: number; price: number; total?: number }[]
  createdAt?: string
}

export interface QueueEntry {
  id: string
  appointmentId: string
  clinicId: string
  doctorId?: string
  queuePosition: number
  status: string // waiting, inside, completed, no_show
  calledAt?: string
  insideAt?: string
  completedAt?: string
}

export interface PatientProfile {
  id: string
  authUid?: string
  email: string
  fullName?: string
  role?: string
  phone?: string
  gender?: string
  age?: number
  photoUrl?: string
  isArchived?: boolean
  archivedAt?: string
  deletionScheduledAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface PatientTransactionRecord {
  id: string
  appointmentId: string
  trackingCode: string
  clinicName: string
  doctorName: string
  patientName: string
  appointmentDate: string
  appointmentTime: string
  amount: number
  paymentStatus: string // "paid", "failed", "pending", "bypassed", "free"
  paymentMethod: string // "esewa", "khalti", "fonepay", "connectips", "bypass", "cash"
  transactionId: string
  createdAt: string
}

export interface GatewayCredentialItem {
  id: string
  title: string
  accountIdentifier: string
  merchantCode?: string
  qrImageUrl?: string
  testBypassEnabled?: boolean
  isEnabled: boolean
}

export interface PaymentGatewaysConfig {
  esewa?: GatewayCredentialItem
  khalti?: GatewayCredentialItem
  fonepay?: GatewayCredentialItem
  connectips?: GatewayCredentialItem
  directBank?: GatewayCredentialItem
  testBypassAllowed?: boolean
}

export interface SupportTicket {
  id: string
  ticketCode: string
  name?: string
  email: string
  phone: string
  role: 'clinic' | 'doctor' | 'patient' | 'other'
  category: string
  customReason?: string
  message?: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  createdAt: string
  resolvedAt?: string
  adminNotes?: string
}
