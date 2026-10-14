/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

// ====================================================================
// FINANCIAL DATA TYPES (STRICT INTEGER PAISE, NO FLOATING POINT)
// 1 INR = 100 Paise
// ====================================================================

export type Paise = number;

export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: Paise): number {
  return Math.round(paise) / 100;
}

export function formatINR(paise: Paise): string {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(rupees);
}

export function formatINRWithDecimals(paise: Paise): string {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(rupees);
}

export type SupportedLanguage = 'en' | 'ta';

export type LoanStatus = 'draft' | 'active' | 'completed' | 'cancelled' | 'closed';
export type DuePaymentStatus = 'unpaid' | 'partially_paid' | 'paid';
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
export type MessageDeliveryStatus = 'queued' | 'processing' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled';
export type MessageType = 'sunday_due_reminder' | 'tuesday_overdue_alert' | 'payment_receipt' | 'manual_notice';

/**
 * Auto-calculates penalty based on original principal:
 * ₹10,000 -> ₹100 penalty
 * ₹20,000 -> ₹200 penalty
 * Formula: 1% of principal (₹100 per ₹10,000), minimum ₹50
 */
export function calculateAutoPenaltyRupees(principalRupees: number): number {
  if (!principalRupees || principalRupees <= 0) return 100;
  return Math.max(50, Math.round(principalRupees / 100));
}

export function calculateAutoPenaltyPaise(principalPaise: Paise): Paise {
  const rupees = paiseToRupees(principalPaise);
  return rupeesToPaise(calculateAutoPenaltyRupees(rupees));
}

// ====================================================================
// CORE ENTITY MODELS
// ====================================================================

export interface Customer {
  id: string;
  customerCode: string;
  fullName: string;
  mobileNumber: string; // e.g. +91 98400 12345
  whatsappNumber: string;
  address: string;
  city: string;
  idProofType?: string;
  idProofNumber?: string;
  status: 'active' | 'inactive' | 'blacklisted';
  whatsappConsent: boolean;
  whatsappConsentTimestamp: string;
  whatsappConsentSource: string;
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  loanCode: string; // e.g. LN-2026-0001
  customerId: string;
  customerName: string;
  
  // Financial amounts strictly in integer paise
  originalPrincipalPaise: Paise;      // Default: 10,000 INR = 1,000,000
  upfrontDeductionPaise: Paise;       // Default: 1,500 INR = 150,000
  netDisbursedPaise: Paise;           // Default: 8,500 INR = 850,000
  
  interestRatePercent: number;        // Default: 0.00
  loanDurationWeeks: number;          // Default: 10
  weeklyPrincipalPaise: Paise;        // Default: 1,000 INR = 100,000
  
  dueDayOfWeek: number;               // 0 = Sunday
  penaltyCheckDayOfWeek: number;      // 2 = Tuesday
  penaltyAmountPaise: Paise;          // Default: 100 INR = 10,000 (100 per 10k)
  
  startDate: string;                  // YYYY-MM-DD
  status: LoanStatus;
  notes?: string;
  closureNotes?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  completedAt?: string;
}

export interface WeeklyDue {
  id: string;
  dueCode: string;
  loanId: string;
  customerId: string;
  weekNumber: number;                 // 1 to 10
  dueDate: string;                    // YYYY-MM-DD (Sunday)
  
  scheduledPrincipalPaise: Paise;     // 1,000 INR
  paidPrincipalPaise: Paise;          // 0 to scheduledPrincipalPaise
  remainingPrincipalPaise: Paise;     // scheduledPrincipalPaise - paidPrincipalPaise
  
  penaltyAssessedPaise: Paise;        // 150 INR if Tuesday rule triggered
  penaltyPaidPaise: Paise;            // amount paid toward penalty
  penaltyWaivedPaise: Paise;          // amount waived by admin
  
  paymentStatus: DuePaymentStatus;
  isOverdue: boolean;
  penaltyAssessedAt?: string;
  
  sundayReminderSentAt?: string;
  tuesdayOverdueSentAt?: string;
  remindersSuppressed: boolean;       // Set to true once fully paid
  
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  weeklyDueId: string;
  weekNumber: number;
  principalAmountPaise: Paise;
  penaltyAmountPaise: Paise;
}

export interface Payment {
  id: string;
  paymentCode: string;
  idempotencyKey?: string;
  loanId: string;
  customerId: string;
  customerName: string;
  weeklyDueId?: string;               // primary due if allocated to one
  weekNumber?: number;
  
  paymentDate: string;
  amountReceivedPaise: Paise;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  
  allocatedToPrincipalPaise: Paise;
  allocatedToPenaltyPaise: Paise;
  
  allocations: PaymentAllocation[];
  
  status: 'posted' | 'reversed';
  reversedAt?: string;
  reversalReason?: string;
  reversedBy?: string;
  
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;              // e.g. RCPT-2026-0001
  paymentId: string;
  loanId: string;
  loanCode: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  
  amountPaidPaise: Paise;
  principalAllocationPaise: Paise;
  penaltyAllocationPaise: Paise;
  
  principalBalanceRemainingPaise: Paise;
  penaltyBalanceRemainingPaise: Paise;
  totalBalanceRemainingPaise: Paise;
  
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  issuedDate: string;
  
  isResent: boolean;
  resendCount: number;
  lastResentAt?: string;
  createdAt: string;
}

export interface PenaltyLedgerEntry {
  id: string;
  loanId: string;
  weeklyDueId: string;
  customerId: string;
  customerName: string;
  weekNumber: number;
  
  amountPaise: Paise;                 // 15,000 paise (₹150)
  assessmentDate: string;
  assessmentReason: string;
  
  status: 'assessed' | 'partially_paid' | 'paid' | 'waived';
  paidPaise: Paise;
  waivedPaise: Paise;
  
  waivedBy?: string;
  waiverReason?: string;
  createdAt: string;
}

export interface OutboxMessage {
  id: string;
  idempotencyKey: string;
  customerId: string;
  customerName: string;
  recipientPhone: string;
  loanId?: string;
  weeklyDueId?: string;
  paymentId?: string;
  receiptId?: string;
  
  messageType: MessageType;
  language: SupportedLanguage;
  templateName: string;
  renderedText: string;
  
  status: MessageDeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt?: string;
  
  whatsappMessageId?: string;
  lastError?: string;
  
  scheduledFor: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: 'customer' | 'loan' | 'payment' | 'penalty' | 'whatsapp' | 'setting' | 'system';
  entityId: string;
  actorName: string;
  details: string;
  timestamp: string;
}

export interface BusinessSettings {
  businessName: string;
  businessNameTa: string;
  businessPhone: string;
  businessAddress: string;
  businessAddressTa: string;
  currencySymbol: string;
  timezone: string;
  
  // Loan defaults
  defaultPrincipalPaise: Paise;       // 10,000 INR
  defaultDeductionPaise: Paise;       // 1,500 INR
  defaultDurationWeeks: number;       // 10
  defaultWeeklyPrincipalPaise: Paise; // 1,000 INR
  defaultDueDay: number;              // 0 (Sunday)
  defaultPenaltyDay: number;          // 2 (Tuesday)
  defaultPenaltyPaise: Paise;         // 100 INR (100 per 10k)
  
  // WhatsApp Configuration
  whatsappEnabled: boolean;
  whatsappAccessToken: string;
  whatsappPhoneNumberId: string;
  whatsappBusinessAccountId: string;
  whatsappVerifyToken: string;
  senderStatus: 'connected' | 'not_connected' | 'simulation_mode';
  sendRemindersAutomatically: boolean;
  sundayReminderHourIST: number;      // e.g. 9 for 9:00 AM
  tuesdayEvaluationHourIST: number;   // e.g. 10 for 10:00 AM
  tuesdayAlertHourIST: number;        // e.g. 11 for 11:00 AM
}

export interface DashboardMetrics {
  activeCustomersCount: number;
  activeLoansCount: number;
  completedLoansCount: number;
  
  originalPrincipalIssuedPaise: Paise;
  netDisbursedPaise: Paise;
  upfrontDeductionTotalPaise: Paise;
  
  principalCollectedPaise: Paise;
  principalOutstandingPaise: Paise;
  
  penaltiesAssessedPaise: Paise;
  penaltiesCollectedPaise: Paise;
  penaltiesOutstandingPaise: Paise;
  
  totalCollectedPaise: Paise;
  totalRemainingDuePaise: Paise;
  
  todayExpectedCollectionPaise: Paise;
  todayActualCollectionPaise: Paise;
  
  upcomingSundayDuesCount: number;
  tuesdayOverdueCount: number;
  partiallyPaidCount: number;
  
  whatsappQueuedCount: number;
  whatsappFailedCount: number;
}

// ====================================================================
// ZOD VALIDATION SCHEMAS
// ====================================================================

export const CustomerFormSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  mobileNumber: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Valid mobile number with country code is required (e.g., +919840012345)'),
  whatsappNumber: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Valid WhatsApp number is required'),
  address: z.string().min(3, 'Address is required'),
  city: z.string().default('Salem'),
  idProofType: z.string().optional(),
  idProofNumber: z.string().optional(),
  whatsappConsent: z.boolean().default(true),
  whatsappConsentSource: z.string().default('Customer Application Form'),
  internalNotes: z.string().optional(),
});

export const LoanFormSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  originalPrincipalRupees: z.number().positive('Original principal must be positive'),
  upfrontDeductionRupees: z.number().min(0, 'Upfront deduction cannot be negative'),
  loanDurationWeeks: z.number().int().min(1, 'Duration must be at least 1 week').max(52, 'Maximum 52 weeks'),
  weeklyPrincipalRupees: z.number().positive('Weekly principal repayment must be positive'),
  penaltyAmountRupees: z.number().min(0, 'Penalty amount cannot be negative'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid start date (YYYY-MM-DD) required'),
  notes: z.string().optional(),
}).refine(data => data.upfrontDeductionRupees <= data.originalPrincipalRupees, {
  message: 'Upfront deduction cannot exceed original principal',
  path: ['upfrontDeductionRupees'],
}).refine(data => {
  const calculatedTotal = data.weeklyPrincipalRupees * data.loanDurationWeeks;
  return Math.abs(calculatedTotal - data.originalPrincipalRupees) < 0.01;
}, {
  message: 'Weekly principal multiplied by duration must equal the original principal',
  path: ['weeklyPrincipalRupees'],
});

export const PaymentFormSchema = z.object({
  loanId: z.string().min(1, 'Loan is required'),
  amountReceivedRupees: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'cheque', 'other']),
  transactionReference: z.string().optional(),
  allocatedToPrincipalRupees: z.number().min(0, 'Principal allocation cannot be negative'),
  allocatedToPenaltyRupees: z.number().min(0, 'Penalty allocation cannot be negative'),
  targetDueId: z.string().optional(),
  notes: z.string().optional(),
}).refine(data => {
  const total = data.allocatedToPrincipalRupees + data.allocatedToPenaltyRupees;
  return Math.abs(total - data.amountReceivedRupees) < 0.01;
}, {
  message: 'Total allocation (principal + penalty) must exactly match the amount received',
  path: ['amountReceivedRupees'],
});

export const WaiverFormSchema = z.object({
  penaltyId: z.string().min(1, 'Penalty record is required'),
  waiverReason: z.string().min(5, 'A documented reason for waiver is mandatory'),
  waivedBy: z.string().min(2, 'Admin identity is required'),
});
