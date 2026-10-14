/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Loan,
  Customer,
  WeeklyDue,
  PenaltyLedgerEntry,
  BusinessSettings,
  formatINR,
  rupeesToPaise,
  paiseToRupees,
  SupportedLanguage,
} from '../lib/types';
import { translations } from '../lib/i18n';
import { generateSchedule, formatDateISO } from '../lib/financialEngine';
import { StorageService } from '../lib/storage';
import {
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle,
  FileCheck,
  X,
  CreditCard,
  Eye,
  Info,
  ChevronRight,
} from 'lucide-react';

interface LoansViewProps {
  loans: Loan[];
  customers: Customer[];
  dues: WeeklyDue[];
  penalties: PenaltyLedgerEntry[];
  settings?: BusinessSettings;
  lang: SupportedLanguage;
  onRefresh: () => void;
  onOpenRecordPayment: (loanId: string, dueId?: string) => void;
  isCreateOpenInitially?: boolean;
}

export const LoansView: React.FC<LoansViewProps> = ({
  loans,
  customers,
  dues,
  penalties,
  settings,
  lang,
  onRefresh,
  onOpenRecordPayment,
  isCreateOpenInitially = false,
}) => {
  const t = translations[lang];
  const storage = StorageService.getInstance();

  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(loans.length > 0 ? loans[0].id : null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(isCreateOpenInitially);
  const [loanStatusFilter, setLoanStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Close Loan Modal state
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');
  const [settleRemainingDues, setSettleRemainingDues] = useState(true);
  const [closeToast, setCloseToast] = useState<string | null>(null);

  // Create Loan Form State - initialized from settings if available
  const [formCustomerId, setFormCustomerId] = useState<string>(customers.length > 0 ? customers[0].id : '');
  const [formPrincipalRupees, setFormPrincipalRupees] = useState<number>(
    settings ? paiseToRupees(settings.defaultPrincipalPaise) : 10000
  );
  const [formDeductionRupees, setFormDeductionRupees] = useState<number>(
    settings ? paiseToRupees(settings.defaultDeductionPaise) : 1500
  );
  const [formDurationWeeks, setFormDurationWeeks] = useState<number>(
    settings?.defaultDurationWeeks || 10
  );
  const [formWeeklyPrincipalRupees, setFormWeeklyPrincipalRupees] = useState<number>(
    settings ? paiseToRupees(settings.defaultWeeklyPrincipalPaise) : 1000
  );
  const [formPenaltyRupees, setFormPenaltyRupees] = useState<number>(
    settings ? paiseToRupees(settings.defaultPenaltyPaise) : 100
  );
  const [formStartDate, setFormStartDate] = useState<string>(formatDateISO(new Date()));
  const [formNotes, setFormNotes] = useState<string>('Standard 10-week microfinance loan. Upfront deduction recorded separately.');

  // Sync loan defaults whenever settings prop is updated from Settings view
  React.useEffect(() => {
    if (settings) {
      const p = paiseToRupees(settings.defaultPrincipalPaise || 1000000);
      setFormPrincipalRupees(p);
      setFormDeductionRupees(paiseToRupees(settings.defaultDeductionPaise || 150000));
      setFormDurationWeeks(settings.defaultDurationWeeks || 10);
      setFormWeeklyPrincipalRupees(paiseToRupees(settings.defaultWeeklyPrincipalPaise || 100000));
      // Auto penalty: 10k -> 100, 20k -> 200
      const penaltyVal = settings.defaultPenaltyPaise ? paiseToRupees(settings.defaultPenaltyPaise) : Math.max(50, Math.round(p / 100));
      setFormPenaltyRupees(penaltyVal);
    }
  }, [settings]);

  // Schedule review preview step
  const [previewSchedule, setPreviewSchedule] = useState<WeeklyDue[] | null>(null);
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedLoan = loans.find(l => l.id === selectedLoanId);
  const selectedLoanCustomer = selectedLoan ? customers.find(c => c.id === selectedLoan.customerId) : null;
  const selectedLoanDues = dues.filter(d => d.loanId === selectedLoanId).sort((a, b) => a.weekNumber - b.weekNumber);
  const selectedLoanPenalties = penalties.filter(p => p.loanId === selectedLoanId);

  // Financial calculations for selected loan
  const totalScheduledPaise = selectedLoanDues.reduce((sum, d) => sum + d.scheduledPrincipalPaise, 0);
  const totalPaidPrincipalPaise = selectedLoanDues.reduce((sum, d) => sum + d.paidPrincipalPaise, 0);
  const remainingPrincipalPaise = Math.max(0, totalScheduledPaise - totalPaidPrincipalPaise);

  const totalAssessedPenaltiesPaise = selectedLoanPenalties.reduce((sum, p) => sum + p.amountPaise, 0);
  const totalPaidPenaltiesPaise = selectedLoanPenalties.reduce((sum, p) => sum + p.paidPaise, 0);
  const remainingPenaltiesPaise = Math.max(0, totalAssessedPenaltiesPaise - totalPaidPenaltiesPaise);
  const totalRemainingDuePaise = remainingPrincipalPaise + remainingPenaltiesPaise;

  // Calculate Net Disbursement on the fly
  const calculatedNetDisbursement = Math.max(0, formPrincipalRupees - formDeductionRupees);

  const handlePrincipalChangeInForm = (p: number) => {
    setFormPrincipalRupees(p);
    if (formDurationWeeks > 0) {
      setFormWeeklyPrincipalRupees(Math.round(p / formDurationWeeks));
    }
    // Proportional upfront deduction (15%)
    setFormDeductionRupees(Math.round(p * 0.15));
    // Auto update penalty: ₹10,000 -> ₹100, ₹20,000 -> ₹200 (1%)
    const autoPenalty = Math.max(50, Math.round(p / 100));
    setFormPenaltyRupees(autoPenalty);
  };

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
    setPreviewSchedule(null);
    setScheduleConfirmed(false);
    setFormError(null);
  };

  const handleOpenCloseModal = () => {
    setCloseNotes(
      lang === 'ta'
        ? 'வாடிக்கையாளர் முழுமையாக செலுத்தியதால் கடன் கணக்கு முடிக்கப்பட்டது.'
        : 'Customer settled the balance; loan account closed by admin.'
    );
    setSettleRemainingDues(true);
    setIsCloseModalOpen(true);
  };

  const handleConfirmCloseLoan = () => {
    if (!selectedLoan) return;
    storage.closeLoan(selectedLoan.id, closeNotes, settleRemainingDues);
    setIsCloseModalOpen(false);
    setCloseToast(
      lang === 'ta'
        ? `கடன் ${selectedLoan.loanCode} வெற்றிகரமாக முடிக்கப்பட்டது!`
        : `Loan ${selectedLoan.loanCode} closed successfully!`
    );
    onRefresh();
    setTimeout(() => setCloseToast(null), 5000);
  };

  const handleReopenLoan = (loanId: string) => {
    storage.reopenLoan(loanId);
    setCloseToast(
      lang === 'ta'
        ? 'கடன் மீண்டும் செயலில் வைக்கப்பட்டது.'
        : 'Loan reopened back to active status.'
    );
    onRefresh();
    setTimeout(() => setCloseToast(null), 5000);
  };

  const handleGeneratePreview = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formCustomerId) {
      setFormError('Please select a customer');
      return;
    }

    if (formPrincipalRupees <= 0) {
      setFormError('Original principal must be positive');
      return;
    }

    if (formDeductionRupees < 0 || formDeductionRupees >= formPrincipalRupees) {
      setFormError('Upfront deduction cannot be negative and must be less than principal');
      return;
    }

    if (formWeeklyPrincipalRupees * formDurationWeeks !== formPrincipalRupees) {
      setFormError(`Weekly principal (₹${formWeeklyPrincipalRupees}) × duration (${formDurationWeeks} wks) = ₹${formWeeklyPrincipalRupees * formDurationWeeks}, which does not match Principal ₹${formPrincipalRupees}`);
      return;
    }

    // Generate schedule
    const mockLoanId = `temp_ln_${Date.now()}`;
    const generated = generateSchedule({
      loanId: mockLoanId,
      customerId: formCustomerId,
      startDate: formStartDate,
      loanDurationWeeks: formDurationWeeks,
      weeklyPrincipalPaise: rupeesToPaise(formWeeklyPrincipalRupees),
      scheduledPrincipalTotalPaise: rupeesToPaise(formPrincipalRupees),
    });

    setPreviewSchedule(generated);
  };

  const handleConfirmAndActivate = () => {
    if (!previewSchedule || !scheduleConfirmed) {
      setFormError('Please review and confirm the 10-week schedule before activation');
      return;
    }

    const customer = customers.find(c => c.id === formCustomerId);
    if (!customer) return;

    const nextLoanIndex = loans.length + 1;
    const loanCode = `LN-2026-${String(nextLoanIndex).padStart(4, '0')}`;
    const loanId = `loan_${Date.now()}`;
    const now = new Date().toISOString();

    const newLoan: Loan = {
      id: loanId,
      loanCode,
      customerId: customer.id,
      customerName: customer.fullName,
      originalPrincipalPaise: rupeesToPaise(formPrincipalRupees),
      upfrontDeductionPaise: rupeesToPaise(formDeductionRupees),
      netDisbursedPaise: rupeesToPaise(calculatedNetDisbursement),
      interestRatePercent: 0,
      loanDurationWeeks: formDurationWeeks,
      weeklyPrincipalPaise: rupeesToPaise(formWeeklyPrincipalRupees),
      dueDayOfWeek: 0,
      penaltyCheckDayOfWeek: 2,
      penaltyAmountPaise: rupeesToPaise(formPenaltyRupees),
      startDate: formStartDate,
      status: 'active',
      notes: formNotes,
      createdAt: now,
      updatedAt: now,
      activatedAt: now,
    };

    // Re-generate schedule with real loan ID
    const actualSchedule = generateSchedule({
      loanId,
      customerId: customer.id,
      startDate: formStartDate,
      loanDurationWeeks: formDurationWeeks,
      weeklyPrincipalPaise: rupeesToPaise(formWeeklyPrincipalRupees),
      scheduledPrincipalTotalPaise: rupeesToPaise(formPrincipalRupees),
    });

    // Save to storage
    storage.saveLoans([newLoan, ...loans]);
    storage.saveWeeklyDues([...actualSchedule, ...dues]);
    storage.logAudit(
      'LOAN_ACTIVATED',
      'loan',
      newLoan.loanCode,
      `Activated loan ${newLoan.loanCode} for ${customer.fullName}. Principal: ${formatINR(newLoan.originalPrincipalPaise)}, Disbursed: ${formatINR(newLoan.netDisbursedPaise)}, Deduction: ${formatINR(newLoan.upfrontDeductionPaise)}`
    );

    setIsCreateModalOpen(false);
    setSelectedLoanId(loanId);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">{t.nav.loans}</h2>
          <p className="text-xs text-slate-500">
            {lang === 'ta'
              ? 'வாராந்திர 10 தவணை அட்டவணை, ஞாயிறு தவணை மற்றும் செவ்வாய் அபராத விதி'
              : 'Weekly 10-installment schedules with Sunday dues and Tuesday penalty evaluation'}
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>{t.loan.createLoan}</span>
        </button>
      </div>

      {closeToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{closeToast}</span>
          </div>
          <button onClick={() => setCloseToast(null)} className="text-emerald-700 underline text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Left Loan List, Right Schedule Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Loans List (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700">
              {lang === 'ta' ? 'கடன்கள் பட்டியல்' : 'All Loans'} ({loans.length})
            </span>

            {/* Filter Tabs */}
            <div className="flex bg-slate-200/70 p-0.5 rounded-lg text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setLoanStatusFilter('all')}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  loanStatusFilter === 'all' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600'
                }`}
              >
                {t.common.all}
              </button>
              <button
                type="button"
                onClick={() => setLoanStatusFilter('active')}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  loanStatusFilter === 'active' ? 'bg-white text-emerald-800 font-semibold shadow-xs' : 'text-slate-600'
                }`}
              >
                {t.common.active}
              </button>
              <button
                type="button"
                onClick={() => setLoanStatusFilter('completed')}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  loanStatusFilter === 'completed' ? 'bg-white text-slate-800 font-semibold shadow-xs' : 'text-slate-600'
                }`}
              >
                {lang === 'ta' ? 'முடிந்தது' : 'Closed'}
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
            {loans
              .filter(l => {
                if (loanStatusFilter === 'active') return l.status === 'active';
                if (loanStatusFilter === 'completed') return l.status === 'completed' || (l.status as any) === 'closed';
                return true;
              })
              .map(loan => {
                const isSelected = selectedLoanId === loan.id;
                const customer = customers.find(c => c.id === loan.customerId);
                const loanDuesList = dues.filter(d => d.loanId === loan.id);
                const paidCount = loanDuesList.filter(d => d.paymentStatus === 'paid').length;
                const totalWeeks = loan.loanDurationWeeks;
                const isClosed = loan.status === 'completed' || (loan.status as any) === 'closed';

                return (
                  <div
                    key={loan.id}
                    onClick={() => setSelectedLoanId(loan.id)}
                    className={`p-4 cursor-pointer transition-colors text-xs ${
                      isSelected ? 'bg-emerald-50/70 border-l-4 border-l-emerald-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{loan.loanCode}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                          isClosed
                            ? 'bg-slate-100 text-slate-700 border-slate-300'
                            : loan.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {isClosed ? (lang === 'ta' ? 'முடிந்தது' : 'CLOSED') : loan.status}
                      </span>
                    </div>

                    <div className="font-semibold text-slate-800 mt-1">
                      {customer ? customer.fullName : loan.customerName}
                    </div>

                    <div className="mt-2 flex justify-between text-slate-600 font-mono text-[11px]">
                      <span>Principal: {formatINR(loan.originalPrincipalPaise)}</span>
                      <span className="text-emerald-700 font-medium">{paidCount}/{totalWeeks} Wks Paid</span>
                    </div>

                    {/* Micro Progress Bar */}
                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`${isClosed ? 'bg-slate-500' : 'bg-emerald-600'} h-1.5 rounded-full`}
                        style={{ width: `${(paidCount / totalWeeks) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Right: Detailed Repayment Schedule & Ledger Breakdown (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          {selectedLoan ? (
            <div>
              {/* Loan Overview Header */}
              <div className="p-5 border-b border-slate-200 bg-slate-50/70">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold font-mono text-slate-900">
                        {selectedLoan.loanCode}
                      </span>
                      <span className="text-xs text-slate-500">·</span>
                      <span className="text-xs font-semibold text-slate-700">
                        {selectedLoanCustomer ? selectedLoanCustomer.fullName : selectedLoan.customerName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ml-1 ${
                          selectedLoan.status === 'completed' || (selectedLoan.status as any) === 'closed'
                            ? 'bg-slate-200 text-slate-800 border-slate-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        {selectedLoan.status === 'completed' || (selectedLoan.status as any) === 'closed'
                          ? (lang === 'ta' ? 'முடிந்தது (CLOSED)' : 'CLOSED / COMPLETED')
                          : 'ACTIVE'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Started: {selectedLoan.startDate} · Sunday Dues · Tuesday Penalty: ₹{paiseToRupees(selectedLoan.penaltyAmountPaise)}
                      {selectedLoan.closedAt && (
                        <span className="text-slate-600 ml-1">
                          · Closed: {new Date(selectedLoan.closedAt).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedLoan.status === 'active' ? (
                      <>
                        <button
                          onClick={() => onOpenRecordPayment(selectedLoan.id)}
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t.nav.recordPayment}</span>
                        </button>

                        <button
                          onClick={handleOpenCloseModal}
                          className="px-3 py-1.5 text-xs font-semibold text-red-700 hover:text-red-800 bg-white hover:bg-red-50 border border-red-200 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                          title={lang === 'ta' ? 'கடனை முடிக்க' : 'Close Loan Account'}
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-red-600" />
                          <span>{t.loan.closeLoan}</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 text-xs font-bold text-slate-700 bg-slate-200/90 rounded-lg border border-slate-300 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{lang === 'ta' ? 'கடன் கணக்கு முடிவுற்றது' : 'Loan Settled & Closed'}</span>
                        </span>
                        <button
                          onClick={() => handleReopenLoan(selectedLoan.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
                        >
                          {t.loan.reopenLoan}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Micro Financial Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">{t.loan.originalPrincipal}</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {formatINR(selectedLoan.originalPrincipalPaise)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">{t.loan.upfrontDeduction}</span>
                    <span className="font-mono font-bold text-slate-700 tabular-nums">
                      {formatINR(selectedLoan.upfrontDeductionPaise)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">{t.loan.netDisbursement}</span>
                    <span className="font-mono font-bold text-emerald-800 tabular-nums">
                      {formatINR(selectedLoan.netDisbursedPaise)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">{t.loan.weeklyPrincipal}</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {formatINR(selectedLoan.weeklyPrincipalPaise)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 10-WEEK DUE SCHEDULE TABLE */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {lang === 'ta' ? '10 வார தவணை அட்டவணை' : '10-Week Repayment Schedule'}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    {lang === 'ta' ? 'ஞாயிறு தவணை நாள் · செவ்வாய் அபராதம்' : 'Sundays · 0% Interest · ₹150 Single Penalty'}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2.5 px-3">Week</th>
                        <th className="py-2.5 px-3">Due Date (Sun)</th>
                        <th className="py-2.5 px-3 text-right">Scheduled</th>
                        <th className="py-2.5 px-3 text-right">Paid</th>
                        <th className="py-2.5 px-3 text-right">Remaining</th>
                        <th className="py-2.5 px-3 text-right">Penalty</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedLoanDues.map(due => {
                        const isOverdue = due.isOverdue && due.paymentStatus !== 'paid';
                        const isPaid = due.paymentStatus === 'paid';
                        const isPartiallyPaid = due.paymentStatus === 'partially_paid';

                        return (
                          <tr
                            key={due.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isOverdue ? 'bg-amber-50/30' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 font-semibold text-slate-900 font-mono">
                              W{due.weekNumber}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">
                              {due.dueDate}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {formatINR(due.scheduledPrincipalPaise)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700">
                              {formatINR(due.paidPrincipalPaise)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                              {formatINR(due.scheduledPrincipalPaise - due.paidPrincipalPaise)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {due.penaltyAssessedPaise > 0 ? (
                                <span className="text-amber-800 font-semibold">
                                  +{formatINR(due.penaltyAssessedPaise)}
                                </span>
                              ) : (
                                <span className="text-slate-400">₹0</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isPaid && (
                                <span className="text-[11px] text-emerald-700 font-semibold">Paid</span>
                              )}
                              {isPartiallyPaid && (
                                <span className="text-[11px] text-amber-700 font-semibold">Partially Paid</span>
                              )}
                              {!isPaid && !isPartiallyPaid && (
                                <span className={`text-[11px] font-medium ${isOverdue ? 'text-red-700 font-semibold' : 'text-slate-500'}`}>
                                  {isOverdue ? 'Overdue (Tue)' : 'Scheduled'}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {!isPaid && (
                                <button
                                  onClick={() => onOpenRecordPayment(selectedLoan.id, due.id)}
                                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 px-2 py-0.5 rounded hover:bg-emerald-50"
                                >
                                  Pay
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              Select a loan to view its schedule.
            </div>
          )}
        </div>
      </div>

      {/* CREATE LOAN MODAL WITH COMPLETE SCHEDULE PREVIEW BEFORE ACTIVATION */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="font-semibold text-slate-900 text-base">{t.loan.createLoan}</h3>
                <p className="text-xs text-slate-500">
                  {lang === 'ta'
                    ? '10 வார கடன் விதிமுறைகள் & முன்பிடித்தம்'
                    : 'Configurable loan terms with default ₹10,000 / 10-week microloan rules'}
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Step 1: Loan Configuration Form */}
              {!previewSchedule ? (
                <form onSubmit={handleGeneratePreview} className="space-y-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">{lang === 'ta' ? 'வாடிக்கையாளர்' : 'Select Customer'} *</label>
                    <select
                      value={formCustomerId}
                      onChange={e => setFormCustomerId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600 bg-white"
                      required
                    >
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.fullName} ({c.customerCode} - {c.mobileNumber})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">{t.loan.originalPrincipal} (₹) *</label>
                      <input
                        type="number"
                        min="1000"
                        step="500"
                        value={formPrincipalRupees}
                        onChange={e => handlePrincipalChangeInForm(parseFloat(e.target.value) || 0)}
                        className="w-full font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
                        required
                      />
                      <span className="text-[11px] text-slate-400">
                        {lang === 'ta' ? 'அசலை மாற்றினால் அபராதம் தானாக கணக்கிடப்படும் (1%)' : 'Auto updates penalty proportionally (1%)'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">{t.loan.upfrontDeduction} (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={formDeductionRupees}
                        onChange={e => setFormDeductionRupees(parseFloat(e.target.value) || 0)}
                        className="w-full font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">{t.loan.netDisbursement} (₹)</label>
                      <input
                        type="text"
                        readOnly
                        value={`₹${calculatedNetDisbursement.toLocaleString('en-IN')}`}
                        className="w-full font-mono border border-slate-200 bg-slate-100 rounded-lg p-2.5 text-emerald-800 font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">{t.loan.duration} *</label>
                      <input
                        type="number"
                        min="1"
                        max="52"
                        value={formDurationWeeks}
                        onChange={e => {
                          const w = parseInt(e.target.value, 10) || 1;
                          setFormDurationWeeks(w);
                          setFormWeeklyPrincipalRupees(Math.round(formPrincipalRupees / w));
                        }}
                        className="w-full font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">{t.loan.weeklyPrincipal} (₹) *</label>
                      <input
                        type="number"
                        min="100"
                        value={formWeeklyPrincipalRupees}
                        onChange={e => setFormWeeklyPrincipalRupees(parseFloat(e.target.value) || 0)}
                        className="w-full font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-slate-700">{t.loan.penaltyAmount} (₹)</label>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                          10k→₹100 · 20k→₹200
                        </span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={formPenaltyRupees}
                        onChange={e => setFormPenaltyRupees(parseFloat(e.target.value) || 0)}
                        className="w-full font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
                        required
                      />
                      <p className="text-[11px] text-emerald-700 font-medium">
                        {lang === 'ta'
                          ? 'தானியங்கி: ₹10,000க்கு ₹100, ₹20,000க்கு ₹200 (1%)'
                          : 'Auto: ₹100 per ₹10,000 principal (1%)'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">{t.loan.startDate} *</label>
                      <input
                        type="date"
                        value={formStartDate}
                        onChange={e => setFormStartDate(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">{t.common.notes}</label>
                      <input
                        type="text"
                        value={formNotes}
                        onChange={e => setFormNotes(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Business Rules Summary Banner */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 space-y-1">
                    <div className="font-semibold text-slate-800">
                      {lang === 'ta' ? 'அங்கீகரிக்கப்பட்ட வணிக விதிகள்' : 'Standard Business Accounting Rules'}
                    </div>
                    <p>
                      • Upfront deduction (₹{formDeductionRupees}) is tracked separately and not counted as collected principal or interest.
                    </p>
                    <p>
                      • Weekly dues are due every Sunday. Tuesday overdue check evaluates missed dues and assesses single ₹150 penalty.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreateModalOpen(false)}
                      className="px-4 py-2 text-slate-600 hover:text-slate-900"
                    >
                      {t.common.cancel}
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-white bg-slate-900 hover:bg-slate-800 rounded-lg font-medium shadow-xs"
                    >
                      {lang === 'ta' ? 'அட்டவணை முன்னோட்டம் காண்க' : 'Review 10-Week Schedule'}
                    </button>
                  </div>
                </form>
              ) : (
                /* Step 2: Schedule Review & Confirmation Before Activation */
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-emerald-50/70 p-3 rounded-lg border border-emerald-200">
                    <div>
                      <span className="font-bold text-emerald-900 text-sm block">
                        {t.loan.schedulePreview}
                      </span>
                      <span className="text-[11px] text-emerald-700">
                        Total {previewSchedule.length} Sunday installments · ₹{formWeeklyPrincipalRupees}/week · Net Handover: ₹{calculatedNetDisbursement}
                      </span>
                    </div>
                    <button
                      onClick={() => setPreviewSchedule(null)}
                      className="text-xs text-slate-600 underline hover:text-slate-900"
                    >
                      Edit Terms
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-semibold text-slate-600">
                        <tr>
                          <th className="py-2 px-3">Week</th>
                          <th className="py-2 px-3">Due Date (Sunday)</th>
                          <th className="py-2 px-3 text-right">Scheduled Principal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewSchedule.map(d => (
                          <tr key={d.id}>
                            <td className="py-2 px-3 font-mono font-medium">Week {d.weekNumber}</td>
                            <td className="py-2 px-3 font-mono text-slate-700">{d.dueDate}</td>
                            <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                              {formatINR(d.scheduledPrincipalPaise)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mandatory Admin Confirmation Checkbox */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="confirmSchedule"
                      checked={scheduleConfirmed}
                      onChange={e => setScheduleConfirmed(e.target.checked)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="confirmSchedule" className="text-slate-800 cursor-pointer">
                      <span className="font-semibold block">{t.loan.scheduleConfirmed}</span>
                      <span className="text-[11px] text-slate-500">
                        I confirm that the customer has accepted the repayment dates, ₹{formDeductionRupees} upfront deduction, and Tuesday penalty rules.
                      </span>
                    </label>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewSchedule(null)}
                      className="px-4 py-2 text-slate-600 hover:text-slate-900"
                    >
                      {t.common.back}
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAndActivate}
                      disabled={!scheduleConfirmed}
                      className="px-5 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium shadow-xs disabled:opacity-50"
                    >
                      {t.loan.activateLoan}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CLOSE LOAN MODAL */}
      {isCloseModalOpen && selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-red-50/60">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 text-red-700 rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {t.loan.confirmCloseLoan}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedLoan.loanCode} · {selectedLoanCustomer ? selectedLoanCustomer.fullName : selectedLoan.customerName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCloseModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Ledger Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">Principal Status</span>
                  <div className="mt-1 font-mono text-slate-900">
                    <div>Paid: <span className="font-bold text-emerald-700">{formatINR(totalPaidPrincipalPaise)}</span></div>
                    <div>Remaining: <span className="font-bold text-slate-800">{formatINR(remainingPrincipalPaise)}</span></div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">Penalties Status</span>
                  <div className="mt-1 font-mono text-slate-900">
                    <div>Paid: <span className="font-bold text-emerald-700">{formatINR(totalPaidPenaltiesPaise)}</span></div>
                    <div>Remaining: <span className="font-bold text-amber-800">{formatINR(remainingPenaltiesPaise)}</span></div>
                  </div>
                </div>
              </div>

              {/* Total Outstanding Callout */}
              <div className={`p-3.5 rounded-lg border flex items-center justify-between font-mono ${
                totalRemainingDuePaise > 0
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div>
                  <span className="text-[11px] font-sans font-semibold uppercase tracking-wider block">
                    {lang === 'ta' ? 'மொத்த நிலுவைத் தொகை' : 'Total Outstanding Balance'}
                  </span>
                  <span className="text-lg font-bold">
                    {formatINR(totalRemainingDuePaise)}
                  </span>
                </div>
                <span className="text-[11px] font-sans text-right max-w-[200px]">
                  {totalRemainingDuePaise > 0
                    ? (lang === 'ta' ? 'மீதமுள்ள தவணைகள் தீர்க்கப்படும்' : 'Will be settled upon closure')
                    : (lang === 'ta' ? 'முழுமையாக செலுத்தப்பட்டது' : 'Fully Repaid')}
                </span>
              </div>

              {/* Settle checkbox */}
              {totalRemainingDuePaise > 0 && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="settleRemainingDues"
                    checked={settleRemainingDues}
                    onChange={e => setSettleRemainingDues(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="settleRemainingDues" className="text-slate-800 cursor-pointer">
                    <span className="font-semibold block">{t.loan.settleAllDuesCheckbox}</span>
                    <span className="text-[11px] text-slate-500">
                      {lang === 'ta'
                        ? 'மீதமுள்ள அனைத்து தவணைகளையும் கணக்கில் முடித்துவிட்டு, வாட்ஸ்அப் ஞாயிறு நினைவூட்டல் மற்றும் செவ்வாய் அபராத எச்சரிக்கைகளை உடனடியாக நிறுத்தும்.'
                        : 'Marks remaining weekly dues as settled and stops all automated Sunday reminders & Tuesday alerts.'}
                    </span>
                  </label>
                </div>
              )}

              {/* Closure notes */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">{t.loan.closureReason}</label>
                <textarea
                  rows={2}
                  value={closeNotes}
                  onChange={e => setCloseNotes(e.target.value)}
                  placeholder="e.g. Full amount settled in cash by customer / கடன் கணக்கு முடிக்கப்பட்டது"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmCloseLoan}
                className="px-5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{lang === 'ta' ? 'கடனை உறுதிசெய்து முடிக்க' : 'Confirm & Close Loan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
