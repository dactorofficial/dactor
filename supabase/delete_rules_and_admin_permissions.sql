-- =========================================================================
-- DACTOR PLATFORM: ROW-LEVEL SECURITY (RLS) & DELETE PERMISSION RULES
-- Integrated with Real Firebase Authentication & Admin Portal Permissions
-- =========================================================================

-- Enable RLS on core tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is an Admin Portal Super Admin
CREATE OR REPLACE FUNCTION is_admin_portal_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'role') IN ('super_admin', 'service_role'),
    (auth.jwt() ->> 'email') ILIKE '%admin@dactor%',
    current_user = 'service_role',
    false
  );
$$;

-- -------------------------------------------------------------------------
-- 1. PROFILES TABLE DELETE RULES
-- Patient can delete own account; Admin Portal has permission to delete any
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_delete_rule" ON profiles;
CREATE POLICY "profiles_delete_rule" ON profiles
FOR DELETE
USING (
    -- 1. Patient deletes own profile (matched by Firebase UID or email)
    auth_uid = auth.uid() OR
    email = (auth.jwt() ->> 'email') OR
    -- 2. Super Admin / Admin Portal permission
    is_admin_portal_user()
);

-- Allow reading and updating profiles for owner and admin
DROP POLICY IF EXISTS "profiles_select_rule" ON profiles;
CREATE POLICY "profiles_select_rule" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_update_rule" ON profiles;
CREATE POLICY "profiles_update_rule" ON profiles
FOR UPDATE
USING (
    auth_uid = auth.uid() OR
    email = (auth.jwt() ->> 'email') OR
    is_admin_portal_user()
);

-- -------------------------------------------------------------------------
-- 2. CLINICS TABLE DELETE RULES
-- Clinic Administrator can delete own clinic; Admin Portal has full permission
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "clinics_delete_rule" ON clinics;
CREATE POLICY "clinics_delete_rule" ON clinics
FOR DELETE
USING (
    contact_email = (auth.jwt() ->> 'email') OR
    is_admin_portal_user()
);

DROP POLICY IF EXISTS "clinics_select_rule" ON clinics;
CREATE POLICY "clinics_select_rule" ON clinics FOR SELECT USING (true);

DROP POLICY IF EXISTS "clinics_update_rule" ON clinics;
CREATE POLICY "clinics_update_rule" ON clinics
FOR UPDATE
USING (
    contact_email = (auth.jwt() ->> 'email') OR
    is_admin_portal_user()
);

-- -------------------------------------------------------------------------
-- 3. DOCTORS TABLE DELETE RULES
-- Doctor, Clinic Admin, or Admin Portal can delete doctor
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "doctors_delete_rule" ON doctors;
CREATE POLICY "doctors_delete_rule" ON doctors
FOR DELETE
USING (
    email = (auth.jwt() ->> 'email') OR
    EXISTS (
        SELECT 1 FROM clinics c
        WHERE (c.id = doctors.clinic_id OR c.id = doctors.primary_clinic_id)
        AND c.contact_email = (auth.jwt() ->> 'email')
    ) OR
    is_admin_portal_user()
);

DROP POLICY IF EXISTS "doctors_select_rule" ON doctors;
CREATE POLICY "doctors_select_rule" ON doctors FOR SELECT USING (true);

DROP POLICY IF EXISTS "doctors_update_rule" ON doctors;
CREATE POLICY "doctors_update_rule" ON doctors
FOR UPDATE
USING (
    email = (auth.jwt() ->> 'email') OR
    EXISTS (
        SELECT 1 FROM clinics c
        WHERE (c.id = doctors.clinic_id OR c.id = doctors.primary_clinic_id)
        AND c.contact_email = (auth.jwt() ->> 'email')
    ) OR
    is_admin_portal_user()
);

-- -------------------------------------------------------------------------
-- 4. APPOINTMENTS, SLOTS & SERVICES DELETE RULES
-- Clinic Owner or Admin Portal has delete permission
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "appointments_delete_rule" ON appointments;
CREATE POLICY "appointments_delete_rule" ON appointments
FOR DELETE
USING (
    patient_email = (auth.jwt() ->> 'email') OR
    EXISTS (
        SELECT 1 FROM clinics c WHERE c.id = appointments.clinic_id
        AND c.contact_email = (auth.jwt() ->> 'email')
    ) OR
    is_admin_portal_user()
);

DROP POLICY IF EXISTS "slots_delete_rule" ON slots;
CREATE POLICY "slots_delete_rule" ON slots
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM clinics c WHERE c.id = slots.clinic_id
        AND c.contact_email = (auth.jwt() ->> 'email')
    ) OR
    is_admin_portal_user()
);

DROP POLICY IF EXISTS "clinic_services_delete_rule" ON clinic_services;
CREATE POLICY "clinic_services_delete_rule" ON clinic_services
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM clinics c WHERE c.id = clinic_services.clinic_id
        AND c.contact_email = (auth.jwt() ->> 'email')
    ) OR
    is_admin_portal_user()
);

-- -------------------------------------------------------------------------
-- 4b. BILLING INVOICES RLS POLICIES
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "billing_invoices_select_rule" ON billing_invoices;
CREATE POLICY "billing_invoices_select_rule" ON billing_invoices FOR SELECT USING (true);

DROP POLICY IF EXISTS "billing_invoices_insert_rule" ON billing_invoices;
CREATE POLICY "billing_invoices_insert_rule" ON billing_invoices FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "billing_invoices_update_rule" ON billing_invoices;
CREATE POLICY "billing_invoices_update_rule" ON billing_invoices FOR UPDATE USING (true);

DROP POLICY IF EXISTS "billing_invoices_delete_rule" ON billing_invoices;
CREATE POLICY "billing_invoices_delete_rule" ON billing_invoices FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM clinics c WHERE c.id = billing_invoices.clinic_id
        AND c.contact_email = (auth.jwt() ->> 'email')
    ) OR
    is_admin_portal_user()
);

-- -------------------------------------------------------------------------
-- 5. FUNCTION TO PURGE EXPIRED CLINIC DATA (Admin Portal & Background Worker)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_expired_archived_clinic_data(p_clinic_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INT := 0;
    v_subcount INT;
BEGIN
    DELETE FROM queue_entries WHERE clinic_id = p_clinic_id;
    GET DIAGNOSTICS v_subcount = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_subcount;

    DELETE FROM lab_reports WHERE clinic_id = p_clinic_id;
    GET DIAGNOSTICS v_subcount = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_subcount;

    DELETE FROM billing_invoices WHERE clinic_id = p_clinic_id;
    GET DIAGNOSTICS v_subcount = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_subcount;

    DELETE FROM appointments WHERE clinic_id = p_clinic_id;
    GET DIAGNOSTICS v_subcount = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_subcount;

    DELETE FROM slots WHERE clinic_id = p_clinic_id;
    GET DIAGNOSTICS v_subcount = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_subcount;

    DELETE FROM clinic_services WHERE clinic_id = p_clinic_id;
    GET DIAGNOSTICS v_subcount = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_subcount;

    DELETE FROM clinics WHERE id = p_clinic_id;
    GET DIAGNOSTICS v_subcount = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_subcount;

    RETURN v_deleted_count;
END;
$$;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION purge_expired_archived_clinic_data(UUID) TO authenticated, service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
