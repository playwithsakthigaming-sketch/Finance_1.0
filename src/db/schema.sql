-- ====================================================================
-- FINANCE MANAGEMENT SYSTEM - SUPABASE / POSTGRESQL SCHEMA MIGRATION
-- Standard: Integer Paise (1 INR = 100 Paise) for Zero Floating-Point Errors
-- Business Rules: Sunday Dues, Tuesday Penalty (₹150 once per eligible due),
-- Separate Ledger Accounting for Principal and Penalties.
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PROFILES (Admin & Staff Users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'collector')),
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_code TEXT UNIQUE NOT NULL, -- e.g. CUST-0001
    full_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL, -- e.g. +919840012345
    whatsapp_number TEXT NOT NULL,
    address TEXT,
    city TEXT DEFAULT 'Salem',
    id_proof_type TEXT,
    id_proof_number TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklisted')),
    whatsapp_consent BOOLEAN NOT NULL DEFAULT true,
    whatsapp_consent_timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    whatsapp_consent_source TEXT DEFAULT 'loan_application_form',
    internal_notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile_number);
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);

-- 4. LOANS
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_code TEXT UNIQUE NOT NULL, -- e.g. LN-2026-0001
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    
    -- Financial values strictly in Integer Paise
    original_principal_paise BIGINT NOT NULL CHECK (original_principal_paise > 0), -- e.g. 10,000 INR = 1,000,000
    upfront_deduction_paise BIGINT NOT NULL DEFAULT 0 CHECK (upfront_deduction_paise >= 0 AND upfront_deduction_paise <= original_principal_paise), -- e.g. 1,500 INR = 150,000
    net_disbursed_paise BIGINT NOT NULL CHECK (net_disbursed_paise = original_principal_paise - upfront_deduction_paise), -- e.g. 8,500 INR = 850,000
    
    interest_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    loan_duration_weeks INTEGER NOT NULL DEFAULT 10 CHECK (loan_duration_weeks > 0),
    weekly_principal_paise BIGINT NOT NULL CHECK (weekly_principal_paise > 0), -- e.g. 1,000 INR = 100,000
    
    due_day_of_week INTEGER NOT NULL DEFAULT 0, -- 0 = Sunday
    penalty_check_day_of_week INTEGER NOT NULL DEFAULT 2, -- 2 = Tuesday
    penalty_amount_paise BIGINT NOT NULL DEFAULT 15000, -- 150 INR = 15,000 paise
    
    start_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_loans_customer ON loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

-- 5. WEEKLY DUES (Scheduled Repayments)
CREATE TABLE IF NOT EXISTS weekly_dues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    due_code TEXT UNIQUE NOT NULL, -- e.g. DUE-0001-W01
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    week_number INTEGER NOT NULL CHECK (week_number >= 1),
    due_date DATE NOT NULL,
    
    -- Monetary tracking in Paise
    scheduled_principal_paise BIGINT NOT NULL CHECK (scheduled_principal_paise > 0),
    paid_principal_paise BIGINT NOT NULL DEFAULT 0 CHECK (paid_principal_paise >= 0 AND paid_principal_paise <= scheduled_principal_paise),
    remaining_principal_paise BIGINT GENERATED ALWAYS AS (scheduled_principal_paise - paid_principal_paise) STORED,
    
    penalty_assessed_paise BIGINT NOT NULL DEFAULT 0,
    penalty_paid_paise BIGINT NOT NULL DEFAULT 0,
    penalty_waived_paise BIGINT NOT NULL DEFAULT 0,
    
    -- Payment & Overdue state
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid')),
    is_overdue BOOLEAN NOT NULL DEFAULT false,
    penalty_assessed_at TIMESTAMPTZ,
    
    -- Reminder suppression flags
    sunday_reminder_sent_at TIMESTAMPTZ,
    tuesday_overdue_sent_at TIMESTAMPTZ,
    reminders_suppressed BOOLEAN NOT NULL DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    
    CONSTRAINT uq_loan_week UNIQUE(loan_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_dues_date_status ON weekly_dues(due_date, payment_status);
CREATE INDEX IF NOT EXISTS idx_dues_loan ON weekly_dues(loan_id);

-- 6. PENALTY LEDGER (Strict constraint: 1 assessment per weekly due)
CREATE TABLE IF NOT EXISTS penalty_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    weekly_due_id UUID NOT NULL REFERENCES weekly_dues(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    assessment_date DATE NOT NULL,
    assessment_reason TEXT NOT NULL DEFAULT 'Tuesday Overdue Evaluation Rule',
    
    status TEXT NOT NULL DEFAULT 'assessed' CHECK (status IN ('assessed', 'partially_paid', 'paid', 'waived')),
    paid_paise BIGINT NOT NULL DEFAULT 0,
    waived_paise BIGINT NOT NULL DEFAULT 0,
    
    waived_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    waiver_reason TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- CRITICAL BUSINESS RULE: Only one penalty assessment allowed per weekly due
    CONSTRAINT unique_penalty_per_due UNIQUE(weekly_due_id)
);

-- 7. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_code TEXT UNIQUE NOT NULL, -- e.g. PMT-2026-0001
    idempotency_key TEXT UNIQUE,
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    
    payment_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    amount_received_paise BIGINT NOT NULL CHECK (amount_received_paise > 0),
    
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
    transaction_reference TEXT,
    
    allocated_to_principal_paise BIGINT NOT NULL DEFAULT 0 CHECK (allocated_to_principal_paise >= 0),
    allocated_to_penalty_paise BIGINT NOT NULL DEFAULT 0 CHECK (allocated_to_penalty_paise >= 0),
    
    status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'reversed')),
    reversed_at TIMESTAMPTZ,
    reversal_reason TEXT,
    reversed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    notes TEXT,
    recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    
    CONSTRAINT check_payment_allocation CHECK (amount_received_paise = allocated_to_principal_paise + allocated_to_penalty_paise)
);

CREATE INDEX IF NOT EXISTS idx_payments_loan ON payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- 8. PAYMENT ALLOCATIONS (Itemized against specific weekly dues)
CREATE TABLE IF NOT EXISTS payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    weekly_due_id UUID NOT NULL REFERENCES weekly_dues(id) ON DELETE RESTRICT,
    
    principal_amount_paise BIGINT NOT NULL DEFAULT 0 CHECK (principal_amount_paise >= 0),
    penalty_amount_paise BIGINT NOT NULL DEFAULT 0 CHECK (penalty_amount_paise >= 0),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    
    CONSTRAINT check_allocation_non_zero CHECK (principal_amount_paise > 0 OR penalty_amount_paise > 0)
);

-- 9. RECEIPTS
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number TEXT UNIQUE NOT NULL, -- e.g. RCPT-2026-0001
    payment_id UUID NOT NULL UNIQUE REFERENCES payments(id) ON DELETE RESTRICT,
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    
    amount_paid_paise BIGINT NOT NULL,
    principal_allocation_paise BIGINT NOT NULL,
    penalty_allocation_paise BIGINT NOT NULL,
    
    principal_balance_remaining_paise BIGINT NOT NULL,
    penalty_balance_remaining_paise BIGINT NOT NULL,
    total_balance_remaining_paise BIGINT NOT NULL,
    
    issued_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    receipt_pdf_url TEXT,
    is_resent BOOLEAN NOT NULL DEFAULT false,
    resend_count INTEGER NOT NULL DEFAULT 0,
    last_resent_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. GENERAL ACCOUNT LEDGER (Double-entry audit trail)
CREATE TABLE IF NOT EXISTS account_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_code TEXT NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('disbursement', 'upfront_deduction', 'principal_receipt', 'penalty_assessed', 'penalty_receipt', 'penalty_waived', 'payment_reversal')),
    loan_id UUID REFERENCES loans(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    weekly_due_id UUID REFERENCES weekly_dues(id) ON DELETE SET NULL,
    
    debit_paise BIGINT NOT NULL DEFAULT 0,
    credit_paise BIGINT NOT NULL DEFAULT 0,
    balance_after_paise BIGINT NOT NULL,
    
    description TEXT NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. MESSAGE OUTBOX & DELIVERY LOGS (Transactional Outbox Pattern)
CREATE TABLE IF NOT EXISTS message_outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idempotency_key TEXT UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    loan_id UUID REFERENCES loans(id) ON DELETE SET NULL,
    weekly_due_id UUID REFERENCES weekly_dues(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
    
    recipient_phone TEXT NOT NULL,
    message_type TEXT NOT NULL CHECK (message_type IN ('sunday_due_reminder', 'tuesday_overdue_alert', 'payment_receipt', 'manual_notice')),
    language TEXT NOT NULL DEFAULT 'ta' CHECK (language IN ('en', 'ta')),
    
    template_name TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    rendered_text TEXT NOT NULL,
    
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'delivered', 'read', 'failed', 'cancelled')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    
    whatsapp_message_id TEXT,
    last_error TEXT,
    
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_outbox_queue ON message_outbox(status, scheduled_for);

-- 12. WEBHOOK EVENTS (Idempotent Webhook Processing)
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider TEXT NOT NULL DEFAULT 'meta_whatsapp',
    event_id TEXT UNIQUE,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    processing_error TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    processed_at TIMESTAMPTZ
);

-- 13. AUDIT LOGS (Security, Reversals, Configuration Changes)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    actor_name TEXT,
    changes JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 14. APPLICATION SETTINGS
CREATE TABLE IF NOT EXISTS application_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 15. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE penalty_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_settings ENABLE ROW LEVEL SECURITY;

-- Admins full access policy (Authenticated via Supabase / Applet)
CREATE POLICY "Admin full access profiles" ON profiles FOR ALL USING (true);
CREATE POLICY "Admin full access customers" ON customers FOR ALL USING (true);
CREATE POLICY "Admin full access loans" ON loans FOR ALL USING (true);
CREATE POLICY "Admin full access weekly_dues" ON weekly_dues FOR ALL USING (true);
CREATE POLICY "Admin full access payments" ON payments FOR ALL USING (true);
CREATE POLICY "Admin full access payment_allocations" ON payment_allocations FOR ALL USING (true);
CREATE POLICY "Admin full access penalty_ledger" ON penalty_ledger FOR ALL USING (true);
CREATE POLICY "Admin full access account_ledger" ON account_ledger FOR ALL USING (true);
CREATE POLICY "Admin full access receipts" ON receipts FOR ALL USING (true);
CREATE POLICY "Admin full access message_outbox" ON message_outbox FOR ALL USING (true);
CREATE POLICY "Admin full access audit_logs" ON audit_logs FOR ALL USING (true);
CREATE POLICY "Admin full access application_settings" ON application_settings FOR ALL USING (true);
