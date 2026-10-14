/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Paise,
  Customer,
  Loan,
  WeeklyDue,
  Payment,
  PaymentAllocation,
  PenaltyLedgerEntry,
  Receipt,
  OutboxMessage,
  rupeesToPaise,
  paiseToRupees,
} from './types';

// ====================================================================
// CALENDAR & DATE UTILITIES (ASIA/KOLKATA RESTRAINT)
// ====================================================================

/**
 * Returns YYYY-MM-DD string for a given Date
 */
export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculate the next Sunday from a given start date.
 * If start date is itself Sunday, repayment starts next Sunday (7 days later),
 * or on the same Sunday if configured. Standard microfinance practice is the following Sunday.
 */
export function getFirstDueSunday(startDateStr: string): Date {
  const start = new Date(startDateStr + 'T00:00:00');
  const day = start.getDay(); // 0 is Sunday
  const daysUntilSunday = (7 - day) % 7;
  const firstSunday = new Date(start);
  // If loan starts on Sunday, the first repayment is 7 days later
  const shift = daysUntilSunday === 0 ? 7 : daysUntilSunday;
  firstSunday.setDate(start.getDate() + shift);
  return firstSunday;
}

/**
 * Generate weekly schedule of dues
 */
export function generateSchedule(params: {
  loanId: string;
  customerId: string;
  startDate: string;
  loanDurationWeeks: number;
  weeklyPrincipalPaise: Paise;
  scheduledPrincipalTotalPaise: Paise;
}): WeeklyDue[] {
  const dues: WeeklyDue[] = [];
  const firstSunday = getFirstDueSunday(params.startDate);

  for (let week = 1; week <= params.loanDurationWeeks; week++) {
    const dueDate = new Date(firstSunday);
    dueDate.setDate(firstSunday.getDate() + (week - 1) * 7);
    const dueDateStr = formatDateISO(dueDate);

    // Guard against rounding discrepancy on final week
    const isLastWeek = week === params.loanDurationWeeks;
    const standardAmount = params.weeklyPrincipalPaise;
    const priorTotal = standardAmount * (week - 1);
    const scheduledAmount = isLastWeek
      ? params.scheduledPrincipalTotalPaise - priorTotal
      : standardAmount;

    dues.push({
      id: `due_${params.loanId}_w${week}`,
      dueCode: `DUE-${params.loanId.slice(-4)}-W${String(week).padStart(2, '0')}`,
      loanId: params.loanId,
      customerId: params.customerId,
      weekNumber: week,
      dueDate: dueDateStr,
      scheduledPrincipalPaise: scheduledAmount,
      paidPrincipalPaise: 0,
      remainingPrincipalPaise: scheduledAmount,
      penaltyAssessedPaise: 0,
      penaltyPaidPaise: 0,
      penaltyWaivedPaise: 0,
      paymentStatus: 'unpaid',
      isOverdue: false,
      remindersSuppressed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return dues;
}

// ====================================================================
// TUESDAY OVERDUE & PENALTY EVALUATION ENGINE
// ====================================================================

/**
 * Calculates automatic penalty based on loan original principal:
 * ₹10,000 loan -> ₹100 penalty (10,000 paise)
 * ₹20,000 loan -> ₹200 penalty (20,000 paise)
 * Formula: 1% of principal, minimum ₹100
 */
export function calculateAutoPenaltyPaise(originalPrincipalPaise: number): number {
  return Math.max(10000, Math.round(originalPrincipalPaise * 0.01));
}

export interface PenaltyEvaluationResult {
  assessedCount: number;
  assessedPaise: Paise;
  updatedDues: WeeklyDue[];
  newPenaltyEntries: PenaltyLedgerEntry[];
  queuedAlerts: OutboxMessage[];
}

/**
 * Evaluates whether an unpaid weekly due has reached its Tuesday evaluation day.
 * - Due day is Sunday.
 * - Tuesday is 2 days after Sunday (due date + 2 days).
 * - A due is eligible for evaluation only if current evaluation date >= Tuesday.
 * - If unpaid and no penalty has been assessed yet, assess penalty ONCE.
 *   (₹100 for ₹10,000 loan; ₹200 for ₹20,000 loan or loan-configured amount).
 * - Never assess twice for the same due (strict idempotency).
 */
export function evaluateTuesdayPenalties(params: {
  dues: WeeklyDue[];
  loans: Loan[];
  customers: Customer[];
  existingPenalties: PenaltyLedgerEntry[];
  currentDateStr: string; // YYYY-MM-DD
  penaltyAmountPaise?: Paise;
}): PenaltyEvaluationResult {
  const currentEvalDate = new Date(params.currentDateStr + 'T00:00:00');

  const updatedDues: WeeklyDue[] = [];
  const newPenaltyEntries: PenaltyLedgerEntry[] = [];
  const queuedAlerts: OutboxMessage[] = [];
  let assessedCount = 0;
  let assessedPaise = 0;

  // Build lookup of existing penalties by due id
  const penaltyByDueId = new Map<string, PenaltyLedgerEntry>();
  params.existingPenalties.forEach(p => {
    penaltyByDueId.set(p.weeklyDueId, p);
  });

  const loansMap = new Map<string, Loan>(params.loans.map(l => [l.id, l]));
  const customersMap = new Map<string, Customer>(params.customers.map(c => [c.id, c]));

  for (const due of params.dues) {
    const loan = loansMap.get(due.loanId);
    if (!loan || loan.status !== 'active') {
      continue;
    }

    // Determine auto penalty: loan specific setting, or proportional (10k -> 100, 20k -> 200), or passed param
    const effectivePenaltyPaise =
      loan.penaltyAmountPaise ||
      params.penaltyAmountPaise ||
      calculateAutoPenaltyPaise(loan.originalPrincipalPaise);

    const dueDate = new Date(due.dueDate + 'T00:00:00');
    // Tuesday evaluation date is 2 days after Sunday due date
    const tuesdayEvalDate = new Date(dueDate);
    tuesdayEvalDate.setDate(dueDate.getDate() + 2);

    const isPastOrOnTuesday = currentEvalDate >= tuesdayEvalDate;
    const isUnpaid = due.paidPrincipalPaise < due.scheduledPrincipalPaise;
    const hasAlreadyBeenAssessed = due.penaltyAssessedPaise > 0 || penaltyByDueId.has(due.id);

    // Rule: Must be on or after Tuesday, unpaid, and NEVER assessed before for this weekly due
    if (isPastOrOnTuesday && isUnpaid && !hasAlreadyBeenAssessed) {
      const now = new Date().toISOString();
      const penaltyId = `pen_${due.id}_${Date.now()}`;
      const customer = customersMap.get(due.customerId);

      const penaltyEntry: PenaltyLedgerEntry = {
        id: penaltyId,
        loanId: due.loanId,
        weeklyDueId: due.id,
        customerId: due.customerId,
        customerName: customer ? customer.fullName : 'Customer',
        weekNumber: due.weekNumber,
        amountPaise: effectivePenaltyPaise,
        assessmentDate: params.currentDateStr,
        assessmentReason: `Tuesday Overdue Check - Week ${due.weekNumber} Principal Unpaid`,
        status: 'assessed',
        paidPaise: 0,
        waivedPaise: 0,
        createdAt: now,
      };

      const updatedDue: WeeklyDue = {
        ...due,
        penaltyAssessedPaise: effectivePenaltyPaise,
        isOverdue: true,
        penaltyAssessedAt: now,
        updatedAt: now,
      };

      assessedCount++;
      assessedPaise += effectivePenaltyPaise;
      newPenaltyEntries.push(penaltyEntry);
      updatedDues.push(updatedDue);

      // Queue WhatsApp overdue alert if customer consented and reminders not suppressed
      if (customer && customer.whatsappConsent && !due.remindersSuppressed) {
        const remainingPrincipal = due.scheduledPrincipalPaise - due.paidPrincipalPaise;
        const totalOutstanding = remainingPrincipal + effectivePenaltyPaise;

        const renderedText = `வணக்கம் ${customer.fullName},
ஸ்ரீ முருகன் பைனான்ஸ் (Sri Murugan Finance)

தங்கள் வாராந்திர தவணை தொகை இன்னும் நிலுவையில் உள்ளது.

கடன் எண் (Loan ID): ${loan.loanCode}
வாரம் (Week): ${due.weekNumber}
தவணை தேதி (Due Date): ${due.dueDate}
நிலுவை அசல் (Remaining Principal): ₹${(remainingPrincipal / 100).toLocaleString('en-IN')}
தாமத கட்டணம் (Penalty Assessed): ₹${(effectivePenaltyPaise / 100).toLocaleString('en-IN')}
மொத்த நிலுவை (Total Outstanding): ₹${(totalOutstanding / 100).toLocaleString('en-IN')}

ஏற்கனவே செலுத்தியிருந்தால் இந்த தகவலை புறக்கணிக்கவும் அல்லது தொடர்பு கொள்ளவும்.
நன்றி!`;

        queuedAlerts.push({
          id: `msg_tue_${due.id}_${Date.now()}`,
          idempotencyKey: `tue_overdue_${due.id}`,
          customerId: customer.id,
          customerName: customer.fullName,
          recipientPhone: customer.whatsappNumber,
          loanId: loan.id,
          weeklyDueId: due.id,
          messageType: 'tuesday_overdue_alert',
          language: 'ta',
          templateName: 'weekly_overdue_alert_v1',
          renderedText,
          status: 'queued',
          attemptCount: 0,
          maxAttempts: 3,
          scheduledFor: now,
          createdAt: now,
          updatedAt: now,
        });
      }
    } else if (isPastOrOnTuesday && isUnpaid && hasAlreadyBeenAssessed && !due.isOverdue) {
      // Ensure overdue flag is marked
      updatedDues.push({
        ...due,
        isOverdue: true,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return {
    assessedCount,
    assessedPaise,
    updatedDues,
    newPenaltyEntries,
    queuedAlerts,
  };
}

// ====================================================================
// LOAN CLOSURE WORKFLOW (LOAN CLOSE OPTION)
// ====================================================================

export function closeLoan(params: {
  loan: Loan;
  allDuesForLoan: WeeklyDue[];
  closingReason?: string;
  closedBy?: string;
}): {
  updatedLoan: Loan;
  updatedDues: WeeklyDue[];
} {
  const now = new Date().toISOString();
  const updatedLoan: Loan = {
    ...params.loan,
    status: 'completed',
    completedAt: now,
    notes: params.closingReason
      ? `${params.loan.notes || ''} [Closed by ${params.closedBy || 'Admin'}: ${params.closingReason}]`
      : params.loan.notes,
    updatedAt: now,
  };

  // Suppress all remaining reminders for this loan so no future alerts are sent
  const updatedDues = params.allDuesForLoan.map(d => ({
    ...d,
    remindersSuppressed: true,
    updatedAt: now,
  }));

  return {
    updatedLoan,
    updatedDues,
  };
}

// ====================================================================
// PAYMENT POSTING & ALLOCATION ENGINE
// ====================================================================

export interface PostPaymentParams {
  paymentCode: string;
  idempotencyKey?: string;
  loan: Loan;
  customer: Customer;
  allDuesForLoan: WeeklyDue[];
  allPenaltiesForLoan: PenaltyLedgerEntry[];
  targetDueId?: string;
  paymentDate: string;
  amountReceivedPaise: Paise;
  allocatedToPrincipalPaise: Paise;
  allocatedToPenaltyPaise: Paise;
  paymentMethod: Payment['paymentMethod'];
  transactionReference?: string;
  notes?: string;
  recordedBy: string;
}

export interface PostPaymentResult {
  payment: Payment;
  receipt: Receipt;
  updatedDues: WeeklyDue[];
  updatedPenalties: PenaltyLedgerEntry[];
  queuedReceiptMessage?: OutboxMessage;
}

/**
 * Posts a payment, allocates principal and penalties accurately in integer paise,
 * marks dues Paid / Partially Paid, suppresses reminders for fully settled dues,
 * and generates a unique receipt.
 */
export function postPayment(params: PostPaymentParams): PostPaymentResult {
  const {
    paymentCode,
    idempotencyKey,
    loan,
    customer,
    allDuesForLoan,
    allPenaltiesForLoan,
    targetDueId,
    paymentDate,
    amountReceivedPaise,
    allocatedToPrincipalPaise,
    allocatedToPenaltyPaise,
    paymentMethod,
    transactionReference,
    notes,
    recordedBy,
  } = params;

  if (amountReceivedPaise !== allocatedToPrincipalPaise + allocatedToPenaltyPaise) {
    throw new Error('Allocation mismatch: Principal + Penalty allocation must equal amount received');
  }

  const paymentId = `pmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  // 1. Allocate Principal across dues
  let remainingPrincipalToAllocate = allocatedToPrincipalPaise;
  const updatedDues: WeeklyDue[] = [];
  const paymentAllocations: PaymentAllocation[] = [];

  // Sort dues by week number
  const duesSorted = [...allDuesForLoan].sort((a, b) => a.weekNumber - b.weekNumber);

  // If a target due was explicitly selected, prioritize it
  const prioritizedDues = targetDueId
    ? [
        ...duesSorted.filter(d => d.id === targetDueId),
        ...duesSorted.filter(d => d.id !== targetDueId),
      ]
    : duesSorted;

  for (const due of prioritizedDues) {
    const dueRemainingPrincipal = due.scheduledPrincipalPaise - due.paidPrincipalPaise;
    let allocatedForThisDue = 0;

    if (remainingPrincipalToAllocate > 0 && dueRemainingPrincipal > 0) {
      allocatedForThisDue = Math.min(remainingPrincipalToAllocate, dueRemainingPrincipal);
      remainingPrincipalToAllocate -= allocatedForThisDue;
    }

    const newPaidPrincipal = due.paidPrincipalPaise + allocatedForThisDue;
    const newRemainingPrincipal = due.scheduledPrincipalPaise - newPaidPrincipal;

    let newStatus = due.paymentStatus;
    let remindersSuppressed = due.remindersSuppressed;
    let isOverdue = due.isOverdue;

    if (newPaidPrincipal >= due.scheduledPrincipalPaise) {
      newStatus = 'paid';
      remindersSuppressed = true; // CRITICAL: Suppress future reminders for fully settled week!
      isOverdue = false;
    } else if (newPaidPrincipal > 0) {
      newStatus = 'partially_paid';
    }

    if (allocatedForThisDue > 0) {
      paymentAllocations.push({
        id: `alloc_${paymentId}_w${due.weekNumber}`,
        paymentId,
        weeklyDueId: due.id,
        weekNumber: due.weekNumber,
        principalAmountPaise: allocatedForThisDue,
        penaltyAmountPaise: 0, // penalty will be added below if applicable
      });
    }

    updatedDues.push({
      ...due,
      paidPrincipalPaise: newPaidPrincipal,
      remainingPrincipalPaise: newRemainingPrincipal,
      paymentStatus: newStatus,
      remindersSuppressed,
      isOverdue,
      updatedAt: now,
    });
  }

  // 2. Allocate Penalty across unpaid penalties
  let remainingPenaltyToAllocate = allocatedToPenaltyPaise;
  const updatedPenalties: PenaltyLedgerEntry[] = [];

  for (const penalty of allPenaltiesForLoan) {
    const penaltyRemaining = penalty.amountPaise - penalty.paidPaise - penalty.waivedPaise;
    let penaltyAllocated = 0;

    if (remainingPenaltyToAllocate > 0 && penaltyRemaining > 0) {
      penaltyAllocated = Math.min(remainingPenaltyToAllocate, penaltyRemaining);
      remainingPenaltyToAllocate -= penaltyAllocated;

      const newPaid = penalty.paidPaise + penaltyAllocated;
      const isSettled = newPaid + penalty.waivedPaise >= penalty.amountPaise;

      updatedPenalties.push({
        ...penalty,
        paidPaise: newPaid,
        status: isSettled ? 'paid' : 'partially_paid',
      });

      // Update weekly due penalty paid status if matches
      const targetDueIdx = updatedDues.findIndex(d => d.id === penalty.weeklyDueId);
      if (targetDueIdx >= 0) {
        updatedDues[targetDueIdx] = {
          ...updatedDues[targetDueIdx],
          penaltyPaidPaise: updatedDues[targetDueIdx].penaltyPaidPaise + penaltyAllocated,
          updatedAt: now,
        };
      }

      // Add to allocations
      const existingAlloc = paymentAllocations.find(a => a.weeklyDueId === penalty.weeklyDueId);
      if (existingAlloc) {
        existingAlloc.penaltyAmountPaise += penaltyAllocated;
      } else {
        paymentAllocations.push({
          id: `alloc_pen_${paymentId}_${penalty.id}`,
          paymentId,
          weeklyDueId: penalty.weeklyDueId,
          weekNumber: penalty.weekNumber,
          principalAmountPaise: 0,
          penaltyAmountPaise: penaltyAllocated,
        });
      }
    } else {
      updatedPenalties.push(penalty);
    }
  }

  // 3. Create authoritative Payment record
  const primaryAlloc = paymentAllocations[0];
  const payment: Payment = {
    id: paymentId,
    paymentCode,
    idempotencyKey,
    loanId: loan.id,
    customerId: customer.id,
    customerName: customer.fullName,
    weeklyDueId: primaryAlloc ? primaryAlloc.weeklyDueId : undefined,
    weekNumber: primaryAlloc ? primaryAlloc.weekNumber : undefined,
    paymentDate,
    amountReceivedPaise,
    paymentMethod,
    transactionReference,
    allocatedToPrincipalPaise,
    allocatedToPenaltyPaise,
    allocations: paymentAllocations,
    status: 'posted',
    notes,
    recordedBy,
    createdAt: now,
  };

  // 4. Calculate total outstanding balances after this payment
  let totalScheduledPrincipal = 0;
  let totalPaidPrincipal = 0;
  let totalPenaltyAssessed = 0;
  let totalPenaltyPaid = 0;
  let totalPenaltyWaived = 0;

  for (const d of updatedDues) {
    totalScheduledPrincipal += d.scheduledPrincipalPaise;
    totalPaidPrincipal += d.paidPrincipalPaise;
    totalPenaltyAssessed += d.penaltyAssessedPaise;
    totalPenaltyPaid += d.penaltyPaidPaise;
    totalPenaltyWaived += d.penaltyWaivedPaise;
  }

  const principalBalanceRemainingPaise = Math.max(0, totalScheduledPrincipal - totalPaidPrincipal);
  const penaltyBalanceRemainingPaise = Math.max(0, totalPenaltyAssessed - totalPenaltyPaid - totalPenaltyWaived);
  const totalBalanceRemainingPaise = principalBalanceRemainingPaise + penaltyBalanceRemainingPaise;

  // 5. Generate Receipt
  const receiptNumber = `RCPT-${Date.now().toString().slice(-6)}`;
  const receipt: Receipt = {
    id: `rcpt_${paymentId}`,
    receiptNumber,
    paymentId,
    loanId: loan.id,
    loanCode: loan.loanCode,
    customerId: customer.id,
    customerName: customer.fullName,
    customerMobile: customer.mobileNumber,
    amountPaidPaise: amountReceivedPaise,
    principalAllocationPaise: allocatedToPrincipalPaise,
    penaltyAllocationPaise: allocatedToPenaltyPaise,
    principalBalanceRemainingPaise,
    penaltyBalanceRemainingPaise,
    totalBalanceRemainingPaise,
    paymentMethod,
    transactionReference,
    issuedDate: paymentDate,
    isResent: false,
    resendCount: 0,
    createdAt: now,
  };

  // 6. Queue WhatsApp Receipt Notification
  let queuedReceiptMessage: OutboxMessage | undefined;
  if (customer.whatsappConsent) {
    const renderedText = `கட்டண ரசீது / PAYMENT RECEIPT
ஸ்ரீ முருகன் பைனான்ஸ் (Sri Murugan Finance)
----------------------------------------
ரசீது எண் (Receipt No): ${receiptNumber}
வாடிக்கையாளர் (Customer): ${customer.fullName}
கடன் எண் (Loan ID): ${loan.loanCode}
செலுத்திய தொகை (Paid Amount): ₹${(amountReceivedPaise / 100).toLocaleString('en-IN')}
செலுத்திய முறை (Method): ${paymentMethod.toUpperCase()}
தேதி (Date): ${paymentDate.split('T')[0]}

பிரிவு (Allocation):
• அசல் வரவு (Principal): ₹${(allocatedToPrincipalPaise / 100).toLocaleString('en-IN')}
• அபராத வரவு (Penalty): ₹${(allocatedToPenaltyPaise / 100).toLocaleString('en-IN')}

மீதமுள்ள இருப்பு (Balance):
• நிலுவை அசல் (Principal Due): ₹${(principalBalanceRemainingPaise / 100).toLocaleString('en-IN')}
• நிலுவை அபராதம் (Penalty Due): ₹${(penaltyBalanceRemainingPaise / 100).toLocaleString('en-IN')}
• மொத்த நிலுவை (Total Balance): ₹${(totalBalanceRemainingPaise / 100).toLocaleString('en-IN')}

தங்கள் பணம் வெற்றிகரமாக வரவு வைக்கப்பட்டது. நன்றி!`;

    queuedReceiptMessage = {
      id: `msg_rcpt_${receipt.id}_${Date.now()}`,
      idempotencyKey: `rcpt_${receipt.id}`,
      customerId: customer.id,
      customerName: customer.fullName,
      recipientPhone: customer.whatsappNumber,
      loanId: loan.id,
      paymentId: payment.id,
      receiptId: receipt.id,
      messageType: 'payment_receipt',
      language: 'ta',
      templateName: 'payment_receipt_notification_v1',
      renderedText,
      status: 'queued',
      attemptCount: 0,
      maxAttempts: 3,
      scheduledFor: now,
      createdAt: now,
      updatedAt: now,
    };
  }

  return {
    payment,
    receipt,
    updatedDues,
    updatedPenalties,
    queuedReceiptMessage,
  };
}

// ====================================================================
// PAYMENT REVERSAL WORKFLOW
// ====================================================================

export function reversePayment(params: {
  payment: Payment;
  dues: WeeklyDue[];
  penalties: PenaltyLedgerEntry[];
  reversalReason: string;
  reversedBy: string;
}): {
  updatedPayment: Payment;
  updatedDues: WeeklyDue[];
  updatedPenalties: PenaltyLedgerEntry[];
} {
  const { payment, dues, penalties, reversalReason, reversedBy } = params;
  const now = new Date().toISOString();

  if (payment.status === 'reversed') {
    throw new Error('This payment is already reversed');
  }

  const updatedDues = dues.map(due => {
    const alloc = payment.allocations.find(a => a.weeklyDueId === due.id);
    if (!alloc) return due;

    const revertedPaidPrincipal = Math.max(0, due.paidPrincipalPaise - alloc.principalAmountPaise);
    const revertedRemaining = due.scheduledPrincipalPaise - revertedPaidPrincipal;
    const isPaid = revertedPaidPrincipal >= due.scheduledPrincipalPaise;

    return {
      ...due,
      paidPrincipalPaise: revertedPaidPrincipal,
      remainingPrincipalPaise: revertedRemaining,
      paymentStatus: (isPaid ? 'paid' : revertedPaidPrincipal > 0 ? 'partially_paid' : 'unpaid') as WeeklyDue['paymentStatus'],
      remindersSuppressed: isPaid,
      updatedAt: now,
    };
  });

  const updatedPenalties = penalties.map(pen => {
    const alloc = payment.allocations.find(a => a.weeklyDueId === pen.weeklyDueId && a.penaltyAmountPaise > 0);
    if (!alloc) return pen;

    const revertedPaid = Math.max(0, pen.paidPaise - alloc.penaltyAmountPaise);
    return {
      ...pen,
      paidPaise: revertedPaid,
      status: (revertedPaid >= pen.amountPaise ? 'paid' : revertedPaid > 0 ? 'partially_paid' : 'assessed') as PenaltyLedgerEntry['status'],
    };
  });

  const updatedPayment: Payment = {
    ...payment,
    status: 'reversed',
    reversedAt: now,
    reversalReason,
    reversedBy,
  };

  return {
    updatedPayment,
    updatedDues,
    updatedPenalties,
  };
}
