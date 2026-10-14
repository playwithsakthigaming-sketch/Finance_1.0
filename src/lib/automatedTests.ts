/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  generateSchedule,
  evaluateTuesdayPenalties,
  postPayment,
  reversePayment,
} from './financialEngine';
import {
  Customer,
  Loan,
  WeeklyDue,
  PenaltyLedgerEntry,
  rupeesToPaise,
  paiseToRupees,
} from './types';

export interface TestResultItem {
  id: string;
  category: 'loan_math' | 'penalty_rules' | 'payments' | 'whatsapp' | 'scheduling';
  name: string;
  passed: boolean;
  message: string;
  details?: string;
  durationMs: number;
}

export interface TestSuiteReport {
  total: number;
  passed: number;
  failed: number;
  results: TestResultItem[];
  executedAt: string;
}

export function runAutomatedTestSuite(): TestSuiteReport {
  const results: TestResultItem[] = [];

  const runTest = (
    id: string,
    category: TestResultItem['category'],
    name: string,
    fn: () => void
  ) => {
    const start = performance.now();
    try {
      fn();
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      results.push({
        id,
        category,
        name,
        passed: true,
        message: 'Assertion passed successfully',
        durationMs,
      });
    } catch (err: any) {
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      results.push({
        id,
        category,
        name,
        passed: false,
        message: err.message || 'Assertion failed',
        details: err.stack,
        durationMs,
      });
    }
  };

  // ====================================================================
  // 1. LOAN CALCULATIONS TESTS
  // ====================================================================

  runTest('T1.1', 'loan_math', '₹10,000 principal, ₹1,500 deduction yields ₹8,500 net disbursement', () => {
    const original = rupeesToPaise(10000); // 1,000,000
    const deduction = rupeesToPaise(1500); // 150,000
    const net = original - deduction;

    if (net !== rupeesToPaise(8500)) {
      throw new Error(`Expected net disbursement to be 850,000 paise (₹8,500), got ${net}`);
    }
  });

  runTest('T1.2', 'loan_math', 'Ten weekly principal dues generated at exactly ₹1,000 each with zero interest', () => {
    const dues = generateSchedule({
      loanId: 'test_loan_10k',
      customerId: 'test_cust_1',
      startDate: '2026-10-01',
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      scheduledPrincipalTotalPaise: rupeesToPaise(10000),
    });

    if (dues.length !== 10) {
      throw new Error(`Expected 10 weekly dues, got ${dues.length}`);
    }

    dues.forEach((due, i) => {
      if (due.scheduledPrincipalPaise !== rupeesToPaise(1000)) {
        throw new Error(`Week ${i + 1} scheduled amount was ${due.scheduledPrincipalPaise}, expected 100,000 paise`);
      }
      if (due.weekNumber !== i + 1) {
        throw new Error(`Week number mismatch: expected ${i + 1}, got ${due.weekNumber}`);
      }
    });

    const sumPrincipal = dues.reduce((sum, d) => sum + d.scheduledPrincipalPaise, 0);
    if (sumPrincipal !== rupeesToPaise(10000)) {
      throw new Error(`Schedule total sum ${sumPrincipal} does not match ₹10,000 principal`);
    }
  });

  runTest('T1.3', 'loan_math', 'All generated due dates fall strictly on Sunday', () => {
    const dues = generateSchedule({
      loanId: 'test_loan_sunday',
      customerId: 'test_cust_1',
      startDate: '2026-10-14', // Wednesday
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      scheduledPrincipalTotalPaise: rupeesToPaise(10000),
    });

    dues.forEach(due => {
      const date = new Date(due.dueDate + 'T00:00:00');
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0) {
        throw new Error(`Due date ${due.dueDate} has dayOfWeek ${dayOfWeek}, expected 0 (Sunday)`);
      }
    });
  });

  // ====================================================================
  // 2. TUESDAY PENALTY RULES TESTS
  // ====================================================================

  runTest('T2.1', 'penalty_rules', 'No penalty before Tuesday evaluation day', () => {
    const testLoan: Loan = {
      id: 'loan_pen_1',
      loanCode: 'LN-TEST-001',
      customerId: 'cust_pen_1',
      customerName: 'Test Customer',
      originalPrincipalPaise: rupeesToPaise(10000),
      upfrontDeductionPaise: rupeesToPaise(1500),
      netDisbursedPaise: rupeesToPaise(8500),
      interestRatePercent: 0,
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      dueDayOfWeek: 0,
      penaltyCheckDayOfWeek: 2,
      penaltyAmountPaise: rupeesToPaise(150),
      startDate: '2026-10-01',
      status: 'active',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const dues = generateSchedule({
      loanId: testLoan.id,
      customerId: testLoan.customerId,
      startDate: '2026-10-01',
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      scheduledPrincipalTotalPaise: rupeesToPaise(10000),
    });

    // Week 1 due is Sunday 2026-10-04. Monday is 2026-10-05.
    const resultMonday = evaluateTuesdayPenalties({
      dues,
      loans: [testLoan],
      customers: [{
        id: 'cust_pen_1',
        customerCode: 'CUST-P1',
        fullName: 'Test Customer',
        mobileNumber: '+919842100001',
        whatsappNumber: '+919842100001',
        address: 'Salem',
        city: 'Salem',
        status: 'active',
        whatsappConsent: true,
        whatsappConsentTimestamp: '2026-10-01',
        whatsappConsentSource: 'form',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      }],
      existingPenalties: [],
      currentDateStr: '2026-10-05', // Monday (before Tuesday)
    });

    if (resultMonday.assessedCount !== 0) {
      throw new Error(`Expected 0 penalties on Monday, assessed ${resultMonday.assessedCount}`);
    }
  });

  runTest('T2.2', 'penalty_rules', 'Eligible unpaid due on Tuesday receives exactly ₹150 penalty', () => {
    const testLoan: Loan = {
      id: 'loan_pen_2',
      loanCode: 'LN-TEST-002',
      customerId: 'cust_pen_2',
      customerName: 'Test Customer 2',
      originalPrincipalPaise: rupeesToPaise(10000),
      upfrontDeductionPaise: rupeesToPaise(1500),
      netDisbursedPaise: rupeesToPaise(8500),
      interestRatePercent: 0,
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      dueDayOfWeek: 0,
      penaltyCheckDayOfWeek: 2,
      penaltyAmountPaise: rupeesToPaise(150),
      startDate: '2026-10-01',
      status: 'active',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const dues = generateSchedule({
      loanId: testLoan.id,
      customerId: testLoan.customerId,
      startDate: '2026-10-01',
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      scheduledPrincipalTotalPaise: rupeesToPaise(10000),
    });

    // Week 1 due is 2026-10-04 (Sunday). Tuesday is 2026-10-06.
    const resultTuesday = evaluateTuesdayPenalties({
      dues,
      loans: [testLoan],
      customers: [{
        id: 'cust_pen_2',
        customerCode: 'CUST-P2',
        fullName: 'Test Customer 2',
        mobileNumber: '+919842100002',
        whatsappNumber: '+919842100002',
        address: 'Salem',
        city: 'Salem',
        status: 'active',
        whatsappConsent: true,
        whatsappConsentTimestamp: '2026-10-01',
        whatsappConsentSource: 'form',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      }],
      existingPenalties: [],
      currentDateStr: '2026-10-06', // Tuesday
    });

    if (resultTuesday.assessedCount !== 1) {
      throw new Error(`Expected 1 penalty on Tuesday, assessed ${resultTuesday.assessedCount}`);
    }
    if (resultTuesday.assessedPaise !== rupeesToPaise(150)) {
      throw new Error(`Expected 15,000 paise (₹150), got ${resultTuesday.assessedPaise}`);
    }
  });

  runTest('T2.3', 'penalty_rules', 'Fully paid weekly due receives NO penalty on Tuesday', () => {
    const testLoan: Loan = {
      id: 'loan_pen_3',
      loanCode: 'LN-TEST-003',
      customerId: 'cust_pen_3',
      customerName: 'Paid Customer',
      originalPrincipalPaise: rupeesToPaise(10000),
      upfrontDeductionPaise: rupeesToPaise(1500),
      netDisbursedPaise: rupeesToPaise(8500),
      interestRatePercent: 0,
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      dueDayOfWeek: 0,
      penaltyCheckDayOfWeek: 2,
      penaltyAmountPaise: rupeesToPaise(150),
      startDate: '2026-10-01',
      status: 'active',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const dues = generateSchedule({
      loanId: testLoan.id,
      customerId: testLoan.customerId,
      startDate: '2026-10-01',
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      scheduledPrincipalTotalPaise: rupeesToPaise(10000),
    });

    // Mark Week 1 fully paid
    dues[0].paidPrincipalPaise = rupeesToPaise(1000);
    dues[0].paymentStatus = 'paid';

    const resultTuesday = evaluateTuesdayPenalties({
      dues,
      loans: [testLoan],
      customers: [{
        id: 'cust_pen_3',
        customerCode: 'CUST-P3',
        fullName: 'Paid Customer',
        mobileNumber: '+919842100003',
        whatsappNumber: '+919842100003',
        address: 'Salem',
        city: 'Salem',
        status: 'active',
        whatsappConsent: true,
        whatsappConsentTimestamp: '2026-10-01',
        whatsappConsentSource: 'form',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      }],
      existingPenalties: [],
      currentDateStr: '2026-10-06', // Tuesday
    });

    if (resultTuesday.assessedCount !== 0) {
      throw new Error(`Expected 0 penalties for paid due, but assessed ${resultTuesday.assessedCount}`);
    }
  });

  runTest('T2.4', 'penalty_rules', 'Idempotency: Re-running Tuesday check 5 times assesses penalty ONLY ONCE', () => {
    const testLoan: Loan = {
      id: 'loan_pen_4',
      loanCode: 'LN-TEST-004',
      customerId: 'cust_pen_4',
      customerName: 'Idempotent Customer',
      originalPrincipalPaise: rupeesToPaise(10000),
      upfrontDeductionPaise: rupeesToPaise(1500),
      netDisbursedPaise: rupeesToPaise(8500),
      interestRatePercent: 0,
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      dueDayOfWeek: 0,
      penaltyCheckDayOfWeek: 2,
      penaltyAmountPaise: rupeesToPaise(150),
      startDate: '2026-10-01',
      status: 'active',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    let dues = generateSchedule({
      loanId: testLoan.id,
      customerId: testLoan.customerId,
      startDate: '2026-10-01',
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      scheduledPrincipalTotalPaise: rupeesToPaise(10000),
    });

    let existingPenalties: PenaltyLedgerEntry[] = [];
    const customer: Customer = {
      id: 'cust_pen_4',
      customerCode: 'CUST-P4',
      fullName: 'Idempotent Customer',
      mobileNumber: '+919842100004',
      whatsappNumber: '+919842100004',
      address: 'Salem',
      city: 'Salem',
      status: 'active',
      whatsappConsent: true,
      whatsappConsentTimestamp: '2026-10-01',
      whatsappConsentSource: 'form',
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    };

    // Run 1st time
    const res1 = evaluateTuesdayPenalties({
      dues,
      loans: [testLoan],
      customers: [customer],
      existingPenalties,
      currentDateStr: '2026-10-06',
    });

    if (res1.assessedCount !== 1) {
      throw new Error(`First run expected 1 assessment, got ${res1.assessedCount}`);
    }

    // Merge updates
    dues = dues.map(d => res1.updatedDues.find(u => u.id === d.id) || d);
    existingPenalties = [...existingPenalties, ...res1.newPenaltyEntries];

    // Run 4 more times
    for (let run = 2; run <= 5; run++) {
      const repeated = evaluateTuesdayPenalties({
        dues,
        loans: [testLoan],
        customers: [customer],
        existingPenalties,
        currentDateStr: '2026-10-06',
      });

      if (repeated.assessedCount !== 0) {
        throw new Error(`Run ${run} failed idempotency! Assessed ${repeated.assessedCount} extra penalties.`);
      }
    }

    if (existingPenalties.length !== 1) {
      throw new Error(`Total penalties should remain exactly 1, but got ${existingPenalties.length}`);
    }
  });

  runTest('T2.5', 'penalty_rules', 'Auto penalty: ₹10,000 loan -> ₹100 penalty, ₹20,000 loan -> ₹200 penalty (1%)', () => {
    const loan10k: Loan = {
      id: 'loan_10k',
      loanCode: 'LN-10K',
      customerId: 'cust_10k',
      customerName: 'Customer 10k',
      originalPrincipalPaise: rupeesToPaise(10000),
      upfrontDeductionPaise: rupeesToPaise(1500),
      netDisbursedPaise: rupeesToPaise(8500),
      interestRatePercent: 0,
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      dueDayOfWeek: 0,
      penaltyCheckDayOfWeek: 2,
      penaltyAmountPaise: 0 as any, // Unset to trigger auto-calculation
      startDate: '2026-10-01',
      status: 'active',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const loan20k: Loan = {
      id: 'loan_20k',
      loanCode: 'LN-20K',
      customerId: 'cust_20k',
      customerName: 'Customer 20k',
      originalPrincipalPaise: rupeesToPaise(20000),
      upfrontDeductionPaise: rupeesToPaise(3000),
      netDisbursedPaise: rupeesToPaise(17000),
      interestRatePercent: 0,
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(2000),
      dueDayOfWeek: 0,
      penaltyCheckDayOfWeek: 2,
      penaltyAmountPaise: 0 as any, // Unset to trigger auto-calculation
      startDate: '2026-10-01',
      status: 'active',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const dues10k = generateSchedule({
      loanId: loan10k.id,
      customerId: loan10k.customerId,
      startDate: '2026-10-01',
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      scheduledPrincipalTotalPaise: rupeesToPaise(10000),
    });

    const dues20k = generateSchedule({
      loanId: loan20k.id,
      customerId: loan20k.customerId,
      startDate: '2026-10-01',
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(2000),
      scheduledPrincipalTotalPaise: rupeesToPaise(20000),
    });

    const eval10k = evaluateTuesdayPenalties({
      dues: dues10k,
      loans: [loan10k],
      customers: [{
        id: 'cust_10k',
        customerCode: 'CUST-10K',
        fullName: 'Customer 10k',
        mobileNumber: '+919842100010',
        whatsappNumber: '+919842100010',
        address: 'Salem',
        city: 'Salem',
        status: 'active',
        whatsappConsent: true,
        whatsappConsentTimestamp: '2026-10-01',
        whatsappConsentSource: 'form',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      }],
      existingPenalties: [],
      currentDateStr: '2026-10-06', // Tuesday
    });

    const eval20k = evaluateTuesdayPenalties({
      dues: dues20k,
      loans: [loan20k],
      customers: [{
        id: 'cust_20k',
        customerCode: 'CUST-20K',
        fullName: 'Customer 20k',
        mobileNumber: '+919842100020',
        whatsappNumber: '+919842100020',
        address: 'Salem',
        city: 'Salem',
        status: 'active',
        whatsappConsent: true,
        whatsappConsentTimestamp: '2026-10-01',
        whatsappConsentSource: 'form',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      }],
      existingPenalties: [],
      currentDateStr: '2026-10-06', // Tuesday
    });

    if (eval10k.assessedPaise !== rupeesToPaise(100)) {
      throw new Error(`Expected ₹100 penalty for ₹10,000 loan, got ₹${paiseToRupees(eval10k.assessedPaise)}`);
    }
    if (eval20k.assessedPaise !== rupeesToPaise(200)) {
      throw new Error(`Expected ₹200 penalty for ₹20,000 loan, got ₹${paiseToRupees(eval20k.assessedPaise)}`);
    }
  });

  // ====================================================================
  // 3. PAYMENT MANAGEMENT TESTS
  // ====================================================================

  runTest('T3.1', 'payments', 'Full payment of ₹1,000 marks due paid and suppresses future reminders', () => {
    const customer: Customer = {
      id: 'cust_pmt_1',
      customerCode: 'CUST-PMT1',
      fullName: 'Ramasamy',
      mobileNumber: '+919842100001',
      whatsappNumber: '+919842100001',
      address: 'Salem',
      city: 'Salem',
      status: 'active',
      whatsappConsent: true,
      whatsappConsentTimestamp: '2026-10-01',
      whatsappConsentSource: 'form',
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    };

    const loan: Loan = {
      id: 'loan_pmt_1',
      loanCode: 'LN-PMT-001',
      customerId: customer.id,
      customerName: customer.fullName,
      originalPrincipalPaise: rupeesToPaise(10000),
      upfrontDeductionPaise: rupeesToPaise(1500),
      netDisbursedPaise: rupeesToPaise(8500),
      interestRatePercent: 0,
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      dueDayOfWeek: 0,
      penaltyCheckDayOfWeek: 2,
      penaltyAmountPaise: rupeesToPaise(150),
      startDate: '2026-10-01',
      status: 'active',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const dues = generateSchedule({
      loanId: loan.id,
      customerId: customer.id,
      startDate: '2026-10-01',
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      scheduledPrincipalTotalPaise: rupeesToPaise(10000),
    });

    const postResult = postPayment({
      paymentCode: 'PMT-TEST-001',
      loan,
      customer,
      allDuesForLoan: dues,
      allPenaltiesForLoan: [],
      paymentDate: '2026-10-04T12:00:00Z',
      amountReceivedPaise: rupeesToPaise(1000),
      allocatedToPrincipalPaise: rupeesToPaise(1000),
      allocatedToPenaltyPaise: 0,
      paymentMethod: 'cash',
      recordedBy: 'Admin',
    });

    const updatedWeek1 = postResult.updatedDues.find(d => d.weekNumber === 1);
    if (!updatedWeek1) throw new Error('Week 1 not found in updated dues');
    if (updatedWeek1.paymentStatus !== 'paid') {
      throw new Error(`Expected paymentStatus 'paid', got ${updatedWeek1.paymentStatus}`);
    }
    if (updatedWeek1.remindersSuppressed !== true) {
      throw new Error('Expected remindersSuppressed to be true after full payment!');
    }
    if (postResult.receipt.principalBalanceRemainingPaise !== rupeesToPaise(9000)) {
      throw new Error(`Expected principal balance 900,000 paise, got ${postResult.receipt.principalBalanceRemainingPaise}`);
    }
  });

  runTest('T3.2', 'payments', 'Partial payment of ₹500 leaves ₹500 principal remaining and status partially_paid', () => {
    const customer: Customer = {
      id: 'cust_pmt_2',
      customerCode: 'CUST-PMT2',
      fullName: 'Ramasamy',
      mobileNumber: '+919842100001',
      whatsappNumber: '+919842100001',
      address: 'Salem',
      city: 'Salem',
      status: 'active',
      whatsappConsent: true,
      whatsappConsentTimestamp: '2026-10-01',
      whatsappConsentSource: 'form',
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    };

    const loan: Loan = {
      id: 'loan_pmt_2',
      loanCode: 'LN-PMT-002',
      customerId: customer.id,
      customerName: customer.fullName,
      originalPrincipalPaise: rupeesToPaise(10000),
      upfrontDeductionPaise: rupeesToPaise(1500),
      netDisbursedPaise: rupeesToPaise(8500),
      interestRatePercent: 0,
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      dueDayOfWeek: 0,
      penaltyCheckDayOfWeek: 2,
      penaltyAmountPaise: rupeesToPaise(150),
      startDate: '2026-10-01',
      status: 'active',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const dues = generateSchedule({
      loanId: loan.id,
      customerId: customer.id,
      startDate: '2026-10-01',
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      scheduledPrincipalTotalPaise: rupeesToPaise(10000),
    });

    const postResult = postPayment({
      paymentCode: 'PMT-TEST-002',
      loan,
      customer,
      allDuesForLoan: dues,
      allPenaltiesForLoan: [],
      paymentDate: '2026-10-04T12:00:00Z',
      amountReceivedPaise: rupeesToPaise(500),
      allocatedToPrincipalPaise: rupeesToPaise(500),
      allocatedToPenaltyPaise: 0,
      paymentMethod: 'cash',
      recordedBy: 'Admin',
    });

    const updatedWeek1 = postResult.updatedDues.find(d => d.weekNumber === 1);
    if (!updatedWeek1) throw new Error('Week 1 not found');
    if (updatedWeek1.paymentStatus !== 'partially_paid') {
      throw new Error(`Expected partially_paid, got ${updatedWeek1.paymentStatus}`);
    }
    if (updatedWeek1.remainingPrincipalPaise !== rupeesToPaise(500)) {
      throw new Error(`Expected ₹500 remaining principal, got ${updatedWeek1.remainingPrincipalPaise}`);
    }
    if (updatedWeek1.remindersSuppressed === true) {
      throw new Error('Reminders should NOT be suppressed for partial payments!');
    }
  });

  runTest('T3.3', 'payments', 'Payment reversal restores due balances and preserves audit trail', () => {
    const customer: Customer = {
      id: 'cust_pmt_3',
      customerCode: 'CUST-PMT3',
      fullName: 'Ramasamy',
      mobileNumber: '+919842100001',
      whatsappNumber: '+919842100001',
      address: 'Salem',
      city: 'Salem',
      status: 'active',
      whatsappConsent: true,
      whatsappConsentTimestamp: '2026-10-01',
      whatsappConsentSource: 'form',
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    };

    const loan: Loan = {
      id: 'loan_pmt_3',
      loanCode: 'LN-PMT-003',
      customerId: customer.id,
      customerName: customer.fullName,
      originalPrincipalPaise: rupeesToPaise(10000),
      upfrontDeductionPaise: rupeesToPaise(1500),
      netDisbursedPaise: rupeesToPaise(8500),
      interestRatePercent: 0,
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      dueDayOfWeek: 0,
      penaltyCheckDayOfWeek: 2,
      penaltyAmountPaise: rupeesToPaise(150),
      startDate: '2026-10-01',
      status: 'active',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const dues = generateSchedule({
      loanId: loan.id,
      customerId: customer.id,
      startDate: '2026-10-01',
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      scheduledPrincipalTotalPaise: rupeesToPaise(10000),
    });

    const posted = postPayment({
      paymentCode: 'PMT-TEST-REV',
      loan,
      customer,
      allDuesForLoan: dues,
      allPenaltiesForLoan: [],
      paymentDate: '2026-10-04T12:00:00Z',
      amountReceivedPaise: rupeesToPaise(1000),
      allocatedToPrincipalPaise: rupeesToPaise(1000),
      allocatedToPenaltyPaise: 0,
      paymentMethod: 'cash',
      recordedBy: 'Admin',
    });

    const reversed = reversePayment({
      payment: posted.payment,
      dues: posted.updatedDues,
      penalties: posted.updatedPenalties,
      reversalReason: 'Wrong receipt issued by mistake',
      reversedBy: 'Super Admin',
    });

    if (reversed.updatedPayment.status !== 'reversed') {
      throw new Error(`Expected payment status 'reversed', got ${reversed.updatedPayment.status}`);
    }
    const week1Reverted = reversed.updatedDues.find(d => d.weekNumber === 1);
    if (!week1Reverted || week1Reverted.paidPrincipalPaise !== 0) {
      throw new Error(`Expected paidPrincipalPaise to revert to 0, got ${week1Reverted?.paidPrincipalPaise}`);
    }
    if (week1Reverted.paymentStatus !== 'unpaid') {
      throw new Error(`Expected due status 'unpaid', got ${week1Reverted.paymentStatus}`);
    }
  });

  // ====================================================================
  // 4. WHATSAPP & QUEUE TESTS
  // ====================================================================

  runTest('T4.1', 'whatsapp', 'Receipt message queued with accurate principal, penalty, and remaining balances', () => {
    const customer: Customer = {
      id: 'cust_wa_1',
      customerCode: 'CUST-WA1',
      fullName: 'K. Ramasamy',
      mobileNumber: '+919842100001',
      whatsappNumber: '+919842100001',
      address: 'Salem',
      city: 'Salem',
      status: 'active',
      whatsappConsent: true,
      whatsappConsentTimestamp: '2026-10-01',
      whatsappConsentSource: 'form',
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    };

    const loan: Loan = {
      id: 'loan_wa_1',
      loanCode: 'LN-WA-001',
      customerId: customer.id,
      customerName: customer.fullName,
      originalPrincipalPaise: rupeesToPaise(10000),
      upfrontDeductionPaise: rupeesToPaise(1500),
      netDisbursedPaise: rupeesToPaise(8500),
      interestRatePercent: 0,
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      dueDayOfWeek: 0,
      penaltyCheckDayOfWeek: 2,
      penaltyAmountPaise: rupeesToPaise(150),
      startDate: '2026-10-01',
      status: 'active',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const dues = generateSchedule({
      loanId: loan.id,
      customerId: customer.id,
      startDate: '2026-10-01',
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      scheduledPrincipalTotalPaise: rupeesToPaise(10000),
    });

    const result = postPayment({
      paymentCode: 'PMT-WA-001',
      loan,
      customer,
      allDuesForLoan: dues,
      allPenaltiesForLoan: [],
      paymentDate: '2026-10-04T12:00:00Z',
      amountReceivedPaise: rupeesToPaise(1000),
      allocatedToPrincipalPaise: rupeesToPaise(1000),
      allocatedToPenaltyPaise: 0,
      paymentMethod: 'cash',
      recordedBy: 'Admin',
    });

    if (!result.queuedReceiptMessage) {
      throw new Error('Expected queuedReceiptMessage to be generated');
    }
    if (!result.queuedReceiptMessage.renderedText.includes('₹1,000')) {
      throw new Error('Receipt text missing amount received');
    }
    if (!result.queuedReceiptMessage.renderedText.includes('₹9,000')) {
      throw new Error('Receipt text missing remaining principal balance');
    }
  });

  runTest('T4.2', 'whatsapp', 'Missing customer WhatsApp consent strictly suppresses message queuing', () => {
    const customerNoConsent: Customer = {
      id: 'cust_wa_2',
      customerCode: 'CUST-WA2',
      fullName: 'No Consent Customer',
      mobileNumber: '+919842100002',
      whatsappNumber: '+919842100002',
      address: 'Salem',
      city: 'Salem',
      status: 'active',
      whatsappConsent: false, // Explicitly opted out
      whatsappConsentTimestamp: '2026-10-01',
      whatsappConsentSource: 'form',
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    };

    const loan: Loan = {
      id: 'loan_wa_2',
      loanCode: 'LN-WA-002',
      customerId: customerNoConsent.id,
      customerName: customerNoConsent.fullName,
      originalPrincipalPaise: rupeesToPaise(10000),
      upfrontDeductionPaise: rupeesToPaise(1500),
      netDisbursedPaise: rupeesToPaise(8500),
      interestRatePercent: 0,
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      dueDayOfWeek: 0,
      penaltyCheckDayOfWeek: 2,
      penaltyAmountPaise: rupeesToPaise(150),
      startDate: '2026-10-01',
      status: 'active',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const dues = generateSchedule({
      loanId: loan.id,
      customerId: customerNoConsent.id,
      startDate: '2026-10-01',
      loanDurationWeeks: 10,
      weeklyPrincipalPaise: rupeesToPaise(1000),
      scheduledPrincipalTotalPaise: rupeesToPaise(10000),
    });

    const result = postPayment({
      paymentCode: 'PMT-WA-002',
      loan,
      customer: customerNoConsent,
      allDuesForLoan: dues,
      allPenaltiesForLoan: [],
      paymentDate: '2026-10-04T12:00:00Z',
      amountReceivedPaise: rupeesToPaise(1000),
      allocatedToPrincipalPaise: rupeesToPaise(1000),
      allocatedToPenaltyPaise: 0,
      paymentMethod: 'cash',
      recordedBy: 'Admin',
    });

    if (result.queuedReceiptMessage !== undefined) {
      throw new Error('Queued message was created despite customer having whatsappConsent: false!');
    }
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
    executedAt: new Date().toISOString(),
  };
}
