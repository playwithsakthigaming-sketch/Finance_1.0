/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Customer,
  Loan,
  WeeklyDue,
  Payment,
  PenaltyLedgerEntry,
  Receipt,
  OutboxMessage,
  AuditLog,
  BusinessSettings,
  DashboardMetrics,
  rupeesToPaise,
  paiseToRupees,
} from './types';
import { generateSchedule, formatDateISO } from './financialEngine';

// Default initial settings
export const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: 'Sri Murugan Finance',
  businessNameTa: 'ஸ்ரீ முருகன் பைனான்ஸ்',
  businessPhone: '+91 98400 12345',
  businessAddress: '45 Bazaar Street, Salem, Tamil Nadu, 636001',
  businessAddressTa: '45 பஜார் தெரு, சேலம், தமிழ்நாடு, 636001',
  currencySymbol: '₹',
  timezone: 'Asia/Kolkata',

  defaultPrincipalPaise: rupeesToPaise(10000),      // ₹10,000
  defaultDeductionPaise: rupeesToPaise(1500),       // ₹1,500
  defaultDurationWeeks: 10,
  defaultWeeklyPrincipalPaise: rupeesToPaise(1000), // ₹1,000
  defaultDueDay: 0,                                 // Sunday
  defaultPenaltyDay: 2,                             // Tuesday
  defaultPenaltyPaise: rupeesToPaise(100),          // ₹100 (₹100 per ₹10,000 / 1%)

  whatsappEnabled: true,
  whatsappAccessToken: '',
  whatsappPhoneNumberId: '',
  whatsappBusinessAccountId: '',
  whatsappVerifyToken: 'finance_mgmt_verify_token_2026',
  senderStatus: 'simulation_mode',
  sendRemindersAutomatically: true,
  sundayReminderHourIST: 9,
  tuesdayEvaluationHourIST: 10,
  tuesdayAlertHourIST: 11,
};

// Storage Keys
const STORAGE_KEYS = {
  CUSTOMERS: 'fms_customers_v2',
  LOANS: 'fms_loans_v2',
  WEEKLY_DUES: 'fms_weekly_dues_v2',
  PAYMENTS: 'fms_payments_v2',
  PENALTIES: 'fms_penalties_v2',
  RECEIPTS: 'fms_receipts_v2',
  OUTBOX: 'fms_outbox_v2',
  AUDIT_LOGS: 'fms_audit_logs_v2',
  SETTINGS: 'fms_settings_v2',
};

// Initial Seed Data setup
export function initializeSeedData(): {
  customers: Customer[];
  loans: Loan[];
  dues: WeeklyDue[];
  payments: Payment[];
  penalties: PenaltyLedgerEntry[];
  receipts: Receipt[];
  outbox: OutboxMessage[];
  auditLogs: AuditLog[];
  settings: BusinessSettings;
} {
  const now = new Date();
  const nowISO = now.toISOString();

  // Create date anchors for realistic demo
  // Let loan start 4 weeks ago so we have past weeks, overdue Tuesday, and upcoming weeks
  const fourWeeksAgo = new Date(now);
  fourWeeksAgo.setDate(now.getDate() - 28);
  const startDateStr = formatDateISO(fourWeeksAgo);

  // 1. Customer 1 (Default Loan Example)
  const cust1: Customer = {
    id: 'cust_001',
    customerCode: 'CUST-0001',
    fullName: 'K. Ramasamy',
    mobileNumber: '+919842100001',
    whatsappNumber: '+919842100001',
    address: '12 Gandhi Road, Shevapet',
    city: 'Salem',
    idProofType: 'Aadhaar',
    idProofNumber: 'XXXX-XXXX-4512',
    status: 'active',
    whatsappConsent: true,
    whatsappConsentTimestamp: startDateStr,
    whatsappConsentSource: 'Loan Application Form Signature',
    internalNotes: 'Vegetable shop owner at Shevapet market. Punctual weekly payer.',
    createdAt: startDateStr,
    updatedAt: nowISO,
  };

  // Customer 2
  const cust2: Customer = {
    id: 'cust_002',
    customerCode: 'CUST-0002',
    fullName: 'S. Meenakshi',
    mobileNumber: '+919842100002',
    whatsappNumber: '+919842100002',
    address: '88 Cherry Road, Hasthampatti',
    city: 'Salem',
    idProofType: 'Voter ID',
    idProofNumber: 'TN/08/123456',
    status: 'active',
    whatsappConsent: true,
    whatsappConsentTimestamp: startDateStr,
    whatsappConsentSource: 'Loan Agreement Verified',
    internalNotes: 'Tailoring boutique. Regular repayments.',
    createdAt: startDateStr,
    updatedAt: nowISO,
  };

  // Customer 3 (Draft loan example)
  const cust3: Customer = {
    id: 'cust_003',
    customerCode: 'CUST-0003',
    fullName: 'P. Selvakumar',
    mobileNumber: '+919842100003',
    whatsappNumber: '+919842100003',
    address: '24 Anna Nagar, Suramangalam',
    city: 'Salem',
    idProofType: 'Driving License',
    idProofNumber: 'TN27 20180004921',
    status: 'active',
    whatsappConsent: true,
    whatsappConsentTimestamp: nowISO,
    whatsappConsentSource: 'Office Walk-in Application',
    internalNotes: 'Tea stall owner. New applicant awaiting loan schedule confirmation.',
    createdAt: nowISO,
    updatedAt: nowISO,
  };

  const customers = [cust1, cust2, cust3];

  // 2. Loan 1 (Master Example: ₹10,000, ₹1,500 deduction, ₹8,500 disbursement, 10 weeks @ ₹1,000/week)
  const loan1: Loan = {
    id: 'loan_001',
    loanCode: 'LN-2026-0001',
    customerId: cust1.id,
    customerName: cust1.fullName,
    originalPrincipalPaise: rupeesToPaise(10000),      // 10,000 INR
    upfrontDeductionPaise: rupeesToPaise(1500),       // 1,500 INR
    netDisbursedPaise: rupeesToPaise(8500),           // 8,500 INR
    interestRatePercent: 0,
    loanDurationWeeks: 10,
    weeklyPrincipalPaise: rupeesToPaise(1000),        // 1,000 INR
    dueDayOfWeek: 0,                                  // Sunday
    penaltyCheckDayOfWeek: 2,                         // Tuesday
    penaltyAmountPaise: rupeesToPaise(150),           // ₹150
    startDate: startDateStr,
    status: 'active',
    notes: 'Standard 10-week microloan. Upfront deduction ₹1,500 recorded separately from principal.',
    createdAt: startDateStr,
    updatedAt: nowISO,
    activatedAt: startDateStr,
  };

  // Generate 10 weekly dues for Loan 1
  const rawDuesLoan1 = generateSchedule({
    loanId: loan1.id,
    customerId: cust1.id,
    startDate: startDateStr,
    loanDurationWeeks: 10,
    weeklyPrincipalPaise: rupeesToPaise(1000),
    scheduledPrincipalTotalPaise: rupeesToPaise(10000),
  });

  // Modify dues to reflect realistic state:
  // Week 1: Fully paid (₹1,000)
  // Week 2: Fully paid (₹1,000)
  // Week 3: Partially paid (₹500 paid, ₹500 remaining)
  // Week 4: Unpaid, missed Sunday, passed Tuesday -> ₹150 penalty assessed once!
  // Weeks 5-10: Future upcoming Sunday dues
  const dues: WeeklyDue[] = rawDuesLoan1.map((due, idx) => {
    if (idx === 0) {
      return {
        ...due,
        paidPrincipalPaise: rupeesToPaise(1000),
        remainingPrincipalPaise: 0,
        paymentStatus: 'paid',
        remindersSuppressed: true,
      };
    } else if (idx === 1) {
      return {
        ...due,
        paidPrincipalPaise: rupeesToPaise(1000),
        remainingPrincipalPaise: 0,
        paymentStatus: 'paid',
        remindersSuppressed: true,
      };
    } else if (idx === 2) {
      return {
        ...due,
        paidPrincipalPaise: rupeesToPaise(500),
        remainingPrincipalPaise: rupeesToPaise(500),
        paymentStatus: 'partially_paid',
        remindersSuppressed: false,
      };
    } else if (idx === 3) {
      return {
        ...due,
        paidPrincipalPaise: 0,
        remainingPrincipalPaise: rupeesToPaise(1000),
        paymentStatus: 'unpaid',
        penaltyAssessedPaise: rupeesToPaise(150), // Assessed once on Tuesday
        isOverdue: true,
        penaltyAssessedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        remindersSuppressed: false,
      };
    }
    return due;
  });

  // Penalty entry for Week 4
  const penalties: PenaltyLedgerEntry[] = [
    {
      id: `pen_loan1_w4`,
      loanId: loan1.id,
      weeklyDueId: dues[3].id,
      customerId: cust1.id,
      customerName: cust1.fullName,
      weekNumber: 4,
      amountPaise: rupeesToPaise(150),
      assessmentDate: formatDateISO(new Date(Date.now() - 2 * 86400000)),
      assessmentReason: 'Tuesday Overdue Evaluation Rule - Missed Week 4 Sunday Due',
      status: 'assessed',
      paidPaise: 0,
      waivedPaise: 0,
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  ];

  // Payments for Loan 1
  const pmt1: Payment = {
    id: 'pmt_001',
    paymentCode: 'PMT-2026-0001',
    idempotencyKey: 'idemp_pmt_001',
    loanId: loan1.id,
    customerId: cust1.id,
    customerName: cust1.fullName,
    weeklyDueId: dues[0].id,
    weekNumber: 1,
    paymentDate: dues[0].dueDate + 'T11:30:00Z',
    amountReceivedPaise: rupeesToPaise(1000),
    paymentMethod: 'cash',
    allocatedToPrincipalPaise: rupeesToPaise(1000),
    allocatedToPenaltyPaise: 0,
    allocations: [
      {
        id: 'alloc_pmt1_w1',
        paymentId: 'pmt_001',
        weeklyDueId: dues[0].id,
        weekNumber: 1,
        principalAmountPaise: rupeesToPaise(1000),
        penaltyAmountPaise: 0,
      },
    ],
    status: 'posted',
    notes: 'Week 1 on-time cash repayment collected at shop',
    recordedBy: 'Admin (System)',
    createdAt: dues[0].dueDate + 'T11:30:00Z',
  };

  const pmt2: Payment = {
    id: 'pmt_002',
    paymentCode: 'PMT-2026-0002',
    idempotencyKey: 'idemp_pmt_002',
    loanId: loan1.id,
    customerId: cust1.id,
    customerName: cust1.fullName,
    weeklyDueId: dues[1].id,
    weekNumber: 2,
    paymentDate: dues[1].dueDate + 'T16:15:00Z',
    amountReceivedPaise: rupeesToPaise(1000),
    paymentMethod: 'upi',
    transactionReference: 'UPI/20260315/88921092',
    allocatedToPrincipalPaise: rupeesToPaise(1000),
    allocatedToPenaltyPaise: 0,
    allocations: [
      {
        id: 'alloc_pmt2_w2',
        paymentId: 'pmt_002',
        weeklyDueId: dues[1].id,
        weekNumber: 2,
        principalAmountPaise: rupeesToPaise(1000),
        penaltyAmountPaise: 0,
      },
    ],
    status: 'posted',
    notes: 'Google Pay UPI repayment',
    recordedBy: 'Admin (System)',
    createdAt: dues[1].dueDate + 'T16:15:00Z',
  };

  const pmt3: Payment = {
    id: 'pmt_003',
    paymentCode: 'PMT-2026-0003',
    idempotencyKey: 'idemp_pmt_003',
    loanId: loan1.id,
    customerId: cust1.id,
    customerName: cust1.fullName,
    weeklyDueId: dues[2].id,
    weekNumber: 3,
    paymentDate: dues[2].dueDate + 'T18:00:00Z',
    amountReceivedPaise: rupeesToPaise(500),
    paymentMethod: 'cash',
    allocatedToPrincipalPaise: rupeesToPaise(500),
    allocatedToPenaltyPaise: 0,
    allocations: [
      {
        id: 'alloc_pmt3_w3',
        paymentId: 'pmt_003',
        weeklyDueId: dues[2].id,
        weekNumber: 3,
        principalAmountPaise: rupeesToPaise(500),
        penaltyAmountPaise: 0,
      },
    ],
    status: 'posted',
    notes: 'Partial payment. Customer promised balance ₹500 next day.',
    recordedBy: 'Admin (System)',
    createdAt: dues[2].dueDate + 'T18:00:00Z',
  };

  const payments = [pmt1, pmt2, pmt3];

  // Receipts for Loan 1 payments
  const rcpt1: Receipt = {
    id: 'rcpt_001',
    receiptNumber: 'RCPT-2026-0001',
    paymentId: pmt1.id,
    loanId: loan1.id,
    loanCode: loan1.loanCode,
    customerId: cust1.id,
    customerName: cust1.fullName,
    customerMobile: cust1.mobileNumber,
    amountPaidPaise: rupeesToPaise(1000),
    principalAllocationPaise: rupeesToPaise(1000),
    penaltyAllocationPaise: 0,
    principalBalanceRemainingPaise: rupeesToPaise(9000),
    penaltyBalanceRemainingPaise: 0,
    totalBalanceRemainingPaise: rupeesToPaise(9000),
    paymentMethod: 'cash',
    issuedDate: pmt1.paymentDate,
    isResent: false,
    resendCount: 0,
    createdAt: pmt1.paymentDate,
  };

  const rcpt2: Receipt = {
    id: 'rcpt_002',
    receiptNumber: 'RCPT-2026-0002',
    paymentId: pmt2.id,
    loanId: loan1.id,
    loanCode: loan1.loanCode,
    customerId: cust1.id,
    customerName: cust1.fullName,
    customerMobile: cust1.mobileNumber,
    amountPaidPaise: rupeesToPaise(1000),
    principalAllocationPaise: rupeesToPaise(1000),
    penaltyAllocationPaise: 0,
    principalBalanceRemainingPaise: rupeesToPaise(8000),
    penaltyBalanceRemainingPaise: 0,
    totalBalanceRemainingPaise: rupeesToPaise(8000),
    paymentMethod: 'upi',
    transactionReference: 'UPI/20260315/88921092',
    issuedDate: pmt2.paymentDate,
    isResent: false,
    resendCount: 0,
    createdAt: pmt2.paymentDate,
  };

  const rcpt3: Receipt = {
    id: 'rcpt_003',
    receiptNumber: 'RCPT-2026-0003',
    paymentId: pmt3.id,
    loanId: loan1.id,
    loanCode: loan1.loanCode,
    customerId: cust1.id,
    customerName: cust1.fullName,
    customerMobile: cust1.mobileNumber,
    amountPaidPaise: rupeesToPaise(500),
    principalAllocationPaise: rupeesToPaise(500),
    penaltyAllocationPaise: 0,
    principalBalanceRemainingPaise: rupeesToPaise(7500),
    penaltyBalanceRemainingPaise: 0,
    totalBalanceRemainingPaise: rupeesToPaise(7500),
    paymentMethod: 'cash',
    issuedDate: pmt3.paymentDate,
    isResent: false,
    resendCount: 0,
    createdAt: pmt3.paymentDate,
  };

  const receipts = [rcpt1, rcpt2, rcpt3];

  // Outbox messages for demo
  const outbox: OutboxMessage[] = [
    {
      id: 'msg_001',
      idempotencyKey: 'rcpt_rcpt_001',
      customerId: cust1.id,
      customerName: cust1.fullName,
      recipientPhone: cust1.whatsappNumber,
      loanId: loan1.id,
      paymentId: pmt1.id,
      receiptId: rcpt1.id,
      messageType: 'payment_receipt',
      language: 'ta',
      templateName: 'payment_receipt_notification_v1',
      renderedText: `கட்டண ரசீது / PAYMENT RECEIPT
ஸ்ரீ முருகன் பைனான்ஸ்
ரசீது எண்: RCPT-2026-0001
பெற்ற தொகை: ₹1,000 (ரொக்கம்)
நிலுவை அசல்: ₹9,000
நன்றி!`,
      status: 'delivered',
      attemptCount: 1,
      maxAttempts: 3,
      whatsappMessageId: 'wamid.HBgMOTE5ODQyMTAwMDAxFQIAERgSMzAyOTM4Nzg=',
      scheduledFor: pmt1.paymentDate,
      sentAt: pmt1.paymentDate,
      deliveredAt: pmt1.paymentDate,
      createdAt: pmt1.paymentDate,
      updatedAt: pmt1.paymentDate,
    },
    {
      id: 'msg_002',
      idempotencyKey: 'tue_overdue_due_loan_001_w4',
      customerId: cust1.id,
      customerName: cust1.fullName,
      recipientPhone: cust1.whatsappNumber,
      loanId: loan1.id,
      weeklyDueId: dues[3].id,
      messageType: 'tuesday_overdue_alert',
      language: 'ta',
      templateName: 'weekly_overdue_alert_v1',
      renderedText: `வணக்கம் K. Ramasamy,
ஸ்ரீ முருகன் பைனான்ஸ்

தங்கள் வாராந்திர தவணை தொகை (வாரம் 4) இன்னும் நிலுவையில் உள்ளது.
நிலுவை அசல்: ₹1,000
தாமத கட்டணம்: ₹150
மொத்த நிலுவை: ₹1,150
தயவுசெய்து இன்றே செலுத்தவும். நன்றி!`,
      status: 'queued',
      attemptCount: 0,
      maxAttempts: 3,
      scheduledFor: nowISO,
      createdAt: nowISO,
      updatedAt: nowISO,
    },
  ];

  // Audit Logs
  const auditLogs: AuditLog[] = [
    {
      id: 'aud_001',
      action: 'SYSTEM_INITIALIZED',
      entityType: 'setting',
      entityId: 'global',
      actorName: 'Super Admin',
      details: 'Finance Management System initialized with ₹10,000 / 10-week default loan rules and Sunday dues.',
      timestamp: startDateStr,
    },
    {
      id: 'aud_002',
      action: 'LOAN_ACTIVATED',
      entityType: 'loan',
      entityId: loan1.loanCode,
      actorName: 'Admin',
      details: `Loan ${loan1.loanCode} activated for ${cust1.fullName}. Original: ₹10,000, Deduction: ₹1,500, Disbursed: ₹8,500.`,
      timestamp: startDateStr,
    },
    {
      id: 'aud_003',
      action: 'PENALTY_ASSESSED',
      entityType: 'penalty',
      entityId: penalties[0].id,
      actorName: 'Tuesday Cron Job',
      details: `Assessed single ₹150 penalty for Week 4 missed Sunday due of Loan ${loan1.loanCode}.`,
      timestamp: penalties[0].createdAt,
    },
  ];

  return {
    customers,
    loans: [loan1],
    dues,
    payments,
    penalties,
    receipts,
    outbox,
    auditLogs,
    settings: DEFAULT_SETTINGS,
  };
}

// Client Storage Repository Class
export class StorageService {
  private static instance: StorageService;

  private constructor() {
    this.ensureInitialized();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private ensureInitialized(): void {
    if (typeof window === 'undefined') return;
    const existing = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (!existing) {
      const seed = initializeSeedData();
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(seed.customers));
      localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(seed.loans));
      localStorage.setItem(STORAGE_KEYS.WEEKLY_DUES, JSON.stringify(seed.dues));
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(seed.payments));
      localStorage.setItem(STORAGE_KEYS.PENALTIES, JSON.stringify(seed.penalties));
      localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(seed.receipts));
      localStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify(seed.outbox));
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(seed.auditLogs));
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(seed.settings));
    }
  }

  // Getters
  public getCustomers(): Customer[] {
    if (typeof window === 'undefined') return [];
    const val = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    return val ? JSON.parse(val) : [];
  }

  public getLoans(): Loan[] {
    if (typeof window === 'undefined') return [];
    const val = localStorage.getItem(STORAGE_KEYS.LOANS);
    return val ? JSON.parse(val) : [];
  }

  public getWeeklyDues(): WeeklyDue[] {
    if (typeof window === 'undefined') return [];
    const val = localStorage.getItem(STORAGE_KEYS.WEEKLY_DUES);
    return val ? JSON.parse(val) : [];
  }

  public getPayments(): Payment[] {
    if (typeof window === 'undefined') return [];
    const val = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
    return val ? JSON.parse(val) : [];
  }

  public getPenalties(): PenaltyLedgerEntry[] {
    if (typeof window === 'undefined') return [];
    const val = localStorage.getItem(STORAGE_KEYS.PENALTIES);
    return val ? JSON.parse(val) : [];
  }

  public getReceipts(): Receipt[] {
    if (typeof window === 'undefined') return [];
    const val = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
    return val ? JSON.parse(val) : [];
  }

  public getOutbox(): OutboxMessage[] {
    if (typeof window === 'undefined') return [];
    const val = localStorage.getItem(STORAGE_KEYS.OUTBOX);
    return val ? JSON.parse(val) : [];
  }

  public getAuditLogs(): AuditLog[] {
    if (typeof window === 'undefined') return [];
    const val = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    return val ? JSON.parse(val) : [];
  }

  public getSettings(): BusinessSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    const val = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return val ? JSON.parse(val) : DEFAULT_SETTINGS;
  }

  // Setters / Updates
  public saveCustomers(customers: Customer[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  }

  public saveLoans(loans: Loan[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(loans));
  }

  public saveWeeklyDues(dues: WeeklyDue[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.WEEKLY_DUES, JSON.stringify(dues));
  }

  public savePayments(payments: Payment[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
  }

  public savePenalties(penalties: PenaltyLedgerEntry[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.PENALTIES, JSON.stringify(penalties));
  }

  public saveReceipts(receipts: Receipt[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(receipts));
  }

  public saveOutbox(outbox: OutboxMessage[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify(outbox));
  }

  public logAudit(action: string, entityType: AuditLog['entityType'], entityId: string, details: string, actorName = 'Admin'): void {
    if (typeof window === 'undefined') return;
    const current = this.getAuditLogs();
    const newLog: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action,
      entityType,
      entityId,
      actorName,
      details,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([newLog, ...current]));
  }

  public saveSettings(settings: BusinessSettings): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    this.logAudit('SETTINGS_UPDATED', 'setting', 'global', 'Business settings updated');
  }

  public updateLoan(updatedLoan: Loan): void {
    if (typeof window === 'undefined') return;
    const loans = this.getLoans();
    const index = loans.findIndex(l => l.id === updatedLoan.id);
    if (index !== -1) {
      loans[index] = updatedLoan;
      this.saveLoans(loans);
    }
  }

  public closeLoan(
    loanId: string,
    notes?: string,
    settleRemainingDues = false
  ): Loan | null {
    if (typeof window === 'undefined') return null;
    const loans = this.getLoans();
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return null;

    const nowISO = new Date().toISOString();
    const updatedLoan: Loan = {
      ...loan,
      status: 'completed',
      completedAt: nowISO,
      closureNotes: notes || 'Loan closed by admin',
      updatedAt: nowISO,
    };

    // Update in loans array
    const updatedLoans = loans.map(l => (l.id === loanId ? updatedLoan : l));
    this.saveLoans(updatedLoans);

    // Update dues: suppress all future reminders, and optionally settle remaining dues
    const dues = this.getWeeklyDues();
    const updatedDues = dues.map(d => {
      if (d.loanId === loanId) {
        if (settleRemainingDues && d.paymentStatus !== 'paid') {
          return {
            ...d,
            paidPrincipalPaise: d.scheduledPrincipalPaise,
            remainingPrincipalPaise: 0,
            paymentStatus: 'paid' as const,
            isOverdue: false,
            remindersSuppressed: true,
            updatedAt: nowISO,
          };
        }
        return {
          ...d,
          remindersSuppressed: true,
          updatedAt: nowISO,
        };
      }
      return d;
    });
    this.saveWeeklyDues(updatedDues);

    // Cancel any queued/pending outbox messages for this loan
    const outbox = this.getOutbox();
    const updatedOutbox = outbox.map(msg => {
      if (msg.loanId === loanId && (msg.status === 'queued' || msg.status === 'processing')) {
        return {
          ...msg,
          status: 'cancelled' as const,
          lastError: 'Cancelled due to loan closure',
          updatedAt: nowISO,
        };
      }
      return msg;
    });
    this.saveOutbox(updatedOutbox);

    this.logAudit(
      'LOAN_CLOSED',
      'loan',
      loan.loanCode,
      `Loan ${loan.loanCode} for ${loan.customerName} was closed by Admin. Notes: ${notes || 'Standard closure'}${settleRemainingDues ? ' (All remaining dues marked as settled)' : ''}. Reminders suppressed.`
    );

    return updatedLoan;
  }

  public reopenLoan(loanId: string): Loan | null {
    if (typeof window === 'undefined') return null;
    const loans = this.getLoans();
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return null;

    const nowISO = new Date().toISOString();
    const updatedLoan: Loan = {
      ...loan,
      status: 'active',
      completedAt: undefined,
      updatedAt: nowISO,
    };

    const updatedLoans = loans.map(l => (l.id === loanId ? updatedLoan : l));
    this.saveLoans(updatedLoans);

    // Re-enable reminders for unpaid dues
    const dues = this.getWeeklyDues();
    const updatedDues = dues.map(d => {
      if (d.loanId === loanId && d.paymentStatus !== 'paid') {
        return {
          ...d,
          remindersSuppressed: false,
          updatedAt: nowISO,
        };
      }
      return d;
    });
    this.saveWeeklyDues(updatedDues);

    this.logAudit(
      'LOAN_REOPENED',
      'loan',
      loan.loanCode,
      `Loan ${loan.loanCode} for ${loan.customerName} was reopened to active status by Admin.`
    );

    return updatedLoan;
  }

  public resetToFactory(): void {
    if (typeof window === 'undefined') return;
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    this.ensureInitialized();
    this.logAudit(
      'SYSTEM_RESET',
      'system',
      'all',
      'System was reset to factory sample data defaults (₹10,000 standard loan demo).'
    );
  }

  public clearAllData(keepSettings: boolean = true): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.WEEKLY_DUES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.PENALTIES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify([]));

    const resetAudit: AuditLog = {
      id: `audit_reset_${Date.now()}`,
      action: 'SYSTEM_RESET',
      entityType: 'system',
      entityId: 'all',
      actorName: 'Admin',
      details: 'All customer, loan, payment, penalty, and message records were wiped clean to blank slate.',
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([resetAudit]));

    if (!keepSettings) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    }
  }

  // Dashboard Aggregator (Strict Ledger Calculation)
  public getDashboardMetrics(): DashboardMetrics {
    const customers = this.getCustomers();
    const loans = this.getLoans();
    const dues = this.getWeeklyDues();
    const payments = this.getPayments().filter(p => p.status === 'posted');
    const penalties = this.getPenalties();
    const outbox = this.getOutbox();

    const activeCustomersCount = customers.filter(c => c.status === 'active').length;
    const activeLoans = loans.filter(l => l.status === 'active');
    const completedLoansCount = loans.filter(l => l.status === 'completed').length;

    let originalPrincipalIssuedPaise = 0;
    let netDisbursedPaise = 0;
    let upfrontDeductionTotalPaise = 0;

    loans.forEach(l => {
      originalPrincipalIssuedPaise += l.originalPrincipalPaise;
      netDisbursedPaise += l.netDisbursedPaise;
      upfrontDeductionTotalPaise += l.upfrontDeductionPaise;
    });

    let principalCollectedPaise = 0;
    payments.forEach(p => {
      principalCollectedPaise += p.allocatedToPrincipalPaise;
    });

    let totalScheduledPrincipal = 0;
    dues.forEach(d => {
      totalScheduledPrincipal += d.scheduledPrincipalPaise;
    });

    const principalOutstandingPaise = Math.max(0, totalScheduledPrincipal - principalCollectedPaise);

    let penaltiesAssessedPaise = 0;
    let penaltiesCollectedPaise = 0;
    let penaltiesWaivedPaise = 0;

    penalties.forEach(pen => {
      penaltiesAssessedPaise += pen.amountPaise;
      penaltiesCollectedPaise += pen.paidPaise;
      penaltiesWaivedPaise += pen.waivedPaise;
    });

    const penaltiesOutstandingPaise = Math.max(0, penaltiesAssessedPaise - penaltiesCollectedPaise - penaltiesWaivedPaise);

    const totalCollectedPaise = principalCollectedPaise + penaltiesCollectedPaise;
    const totalRemainingDuePaise = principalOutstandingPaise + penaltiesOutstandingPaise;

    // Today's metrics
    const todayStr = formatDateISO(new Date());
    let todayExpectedCollectionPaise = 0;
    dues.forEach(d => {
      if (d.dueDate === todayStr) {
        todayExpectedCollectionPaise += (d.scheduledPrincipalPaise - d.paidPrincipalPaise);
      }
    });

    let todayActualCollectionPaise = 0;
    payments.forEach(p => {
      if (p.paymentDate.startsWith(todayStr)) {
        todayActualCollectionPaise += p.amountReceivedPaise;
      }
    });

    // Upcoming Sunday & Overdue
    const upcomingSundayDuesCount = dues.filter(d => d.paymentStatus !== 'paid' && !d.isOverdue).length;
    const tuesdayOverdueCount = dues.filter(d => d.isOverdue && d.paymentStatus !== 'paid').length;
    const partiallyPaidCount = dues.filter(d => d.paymentStatus === 'partially_paid').length;

    const whatsappQueuedCount = outbox.filter(m => m.status === 'queued' || m.status === 'processing').length;
    const whatsappFailedCount = outbox.filter(m => m.status === 'failed').length;

    return {
      activeCustomersCount,
      activeLoansCount: activeLoans.length,
      completedLoansCount,
      originalPrincipalIssuedPaise,
      netDisbursedPaise,
      upfrontDeductionTotalPaise,
      principalCollectedPaise,
      principalOutstandingPaise,
      penaltiesAssessedPaise,
      penaltiesCollectedPaise,
      penaltiesOutstandingPaise,
      totalCollectedPaise,
      totalRemainingDuePaise,
      todayExpectedCollectionPaise,
      todayActualCollectionPaise,
      upcomingSundayDuesCount,
      tuesdayOverdueCount,
      partiallyPaidCount,
      whatsappQueuedCount,
      whatsappFailedCount,
    };
  }
}
