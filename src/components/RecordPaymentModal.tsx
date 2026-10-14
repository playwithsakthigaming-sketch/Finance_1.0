/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Loan,
  Customer,
  WeeklyDue,
  PenaltyLedgerEntry,
  PaymentMethod,
  formatINR,
  rupeesToPaise,
  paiseToRupees,
  SupportedLanguage,
  Receipt,
} from '../lib/types';
import { translations } from '../lib/i18n';
import { postPayment } from '../lib/financialEngine';
import { StorageService } from '../lib/storage';
import { X, Check, AlertCircle, ArrowRight, IndianRupee } from 'lucide-react';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: SupportedLanguage;
  onPaymentSuccess: (receipt: Receipt) => void;
  initialLoanId?: string;
  initialDueId?: string;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  lang,
  onPaymentSuccess,
  initialLoanId,
  initialDueId,
}) => {
  const t = translations[lang];
  const storage = StorageService.getInstance();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dues, setDues] = useState<WeeklyDue[]>([]);
  const [penalties, setPenalties] = useState<PenaltyLedgerEntry[]>([]);

  const [selectedLoanId, setSelectedLoanId] = useState<string>(initialLoanId || '');
  const [selectedDueId, setSelectedDueId] = useState<string>(initialDueId || '');

  const [amountRupees, setAmountRupees] = useState<number>(1000);
  const [principalAllocRupees, setPrincipalAllocRupees] = useState<number>(1000);
  const [penaltyAllocRupees, setPenaltyAllocRupees] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const allLoans = storage.getLoans().filter(l => l.status === 'active');
      const allCustomers = storage.getCustomers();
      const allDues = storage.getWeeklyDues();
      const allPenalties = storage.getPenalties();

      setLoans(allLoans);
      setCustomers(allCustomers);
      setDues(allDues);
      setPenalties(allPenalties);

      const targetLoanId = initialLoanId || (allLoans.length > 0 ? allLoans[0].id : '');
      setSelectedLoanId(targetLoanId);

      // Find first unpaid or overdue due for this loan
      const loanDues = allDues.filter(d => d.loanId === targetLoanId);
      const firstUnpaid = loanDues.find(d => d.paymentStatus !== 'paid');
      const targetDue = initialDueId || (firstUnpaid ? firstUnpaid.id : '');
      setSelectedDueId(targetDue);

      // Check penalty for this due
      const duePenalty = allPenalties.find(p => p.weeklyDueId === targetDue && p.status === 'assessed');
      const penaltyAmount = duePenalty ? paiseToRupees(duePenalty.amountPaise - duePenalty.paidPaise) : 0;

      const remainingPrincipal = firstUnpaid ? paiseToRupees(firstUnpaid.scheduledPrincipalPaise - firstUnpaid.paidPrincipalPaise) : 1000;
      setAmountRupees(remainingPrincipal);
      setPrincipalAllocRupees(remainingPrincipal);
      setPenaltyAllocRupees(0);
      setError(null);
    }
  }, [isOpen, initialLoanId, initialDueId]);

  if (!isOpen) return null;

  const currentLoan = loans.find(l => l.id === selectedLoanId);
  const currentCustomer = currentLoan ? customers.find(c => c.id === currentLoan.customerId) : null;
  const loanDues = dues.filter(d => d.loanId === selectedLoanId).sort((a, b) => a.weekNumber - b.weekNumber);
  const currentDue = loanDues.find(d => d.id === selectedDueId);
  const currentPenalty = penalties.find(p => p.weeklyDueId === selectedDueId && (p.status === 'assessed' || p.status === 'partially_paid'));

  const handleLoanChange = (loanId: string) => {
    setSelectedLoanId(loanId);
    const loanDuesList = dues.filter(d => d.loanId === loanId);
    const firstUnpaid = loanDuesList.find(d => d.paymentStatus !== 'paid');
    if (firstUnpaid) {
      setSelectedDueId(firstUnpaid.id);
      const rem = paiseToRupees(firstUnpaid.scheduledPrincipalPaise - firstUnpaid.paidPrincipalPaise);
      setAmountRupees(rem);
      setPrincipalAllocRupees(rem);
      setPenaltyAllocRupees(0);
    }
  };

  const handleDueChange = (dueId: string) => {
    setSelectedDueId(dueId);
    const targetDue = loanDues.find(d => d.id === dueId);
    if (targetDue) {
      const rem = paiseToRupees(targetDue.scheduledPrincipalPaise - targetDue.paidPrincipalPaise);
      setAmountRupees(rem);
      setPrincipalAllocRupees(rem);
      setPenaltyAllocRupees(0);
    }
  };

  const handleQuickPreset = (type: 'full_principal' | 'full_with_penalty' | 'partial_500') => {
    if (!currentDue) return;
    const remPrincipal = paiseToRupees(currentDue.scheduledPrincipalPaise - currentDue.paidPrincipalPaise);
    const penDue = currentPenalty ? paiseToRupees(currentPenalty.amountPaise - currentPenalty.paidPaise - currentPenalty.waivedPaise) : 0;

    if (type === 'full_principal') {
      setAmountRupees(remPrincipal);
      setPrincipalAllocRupees(remPrincipal);
      setPenaltyAllocRupees(0);
    } else if (type === 'full_with_penalty') {
      const total = remPrincipal + penDue;
      setAmountRupees(total);
      setPrincipalAllocRupees(remPrincipal);
      setPenaltyAllocRupees(penDue);
    } else if (type === 'partial_500') {
      const partial = Math.min(500, remPrincipal);
      setAmountRupees(partial);
      setPrincipalAllocRupees(partial);
      setPenaltyAllocRupees(0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentLoan || !currentCustomer) {
      setError('Please select an active loan and customer');
      return;
    }

    if (amountRupees <= 0) {
      setError('Payment amount must be greater than zero');
      return;
    }

    if (Math.abs(principalAllocRupees + penaltyAllocRupees - amountRupees) > 0.01) {
      setError('The sum of Principal Allocation and Penalty Allocation must exactly equal Amount Received');
      return;
    }

    try {
      const amountPaise = rupeesToPaise(amountRupees);
      const principalPaise = rupeesToPaise(principalAllocRupees);
      const penaltyPaise = rupeesToPaise(penaltyAllocRupees);

      const allLoanDues = storage.getWeeklyDues().filter(d => d.loanId === currentLoan.id);
      const allLoanPenalties = storage.getPenalties().filter(p => p.loanId === currentLoan.id);

      const paymentCode = `PMT-${Date.now().toString().slice(-6)}`;
      const result = postPayment({
        paymentCode,
        idempotencyKey: `idemp_${paymentCode}_${Date.now()}`,
        loan: currentLoan,
        customer: currentCustomer,
        allDuesForLoan: allLoanDues,
        allPenaltiesForLoan: allLoanPenalties,
        targetDueId: selectedDueId || undefined,
        paymentDate: new Date().toISOString(),
        amountReceivedPaise: amountPaise,
        allocatedToPrincipalPaise: principalPaise,
        allocatedToPenaltyPaise: penaltyPaise,
        paymentMethod,
        transactionReference: transactionReference || undefined,
        notes: notes || undefined,
        recordedBy: 'Admin (Cashier)',
      });

      // Update storage
      const existingPayments = storage.getPayments();
      storage.savePayments([result.payment, ...existingPayments]);

      // Update dues in storage
      const allDues = storage.getWeeklyDues();
      const updatedDuesList = allDues.map(d => {
        const matching = result.updatedDues.find(u => u.id === d.id);
        return matching || d;
      });
      storage.saveWeeklyDues(updatedDuesList);

      // Update penalties in storage
      const allPenalties = storage.getPenalties();
      const updatedPenaltiesList = allPenalties.map(p => {
        const matching = result.updatedPenalties.find(u => u.id === p.id);
        return matching || p;
      });
      storage.savePenalties(updatedPenaltiesList);

      // Save receipt
      const existingReceipts = storage.getReceipts();
      storage.saveReceipts([result.receipt, ...existingReceipts]);

      // Queue Outbox message if any
      if (result.queuedReceiptMessage) {
        const existingOutbox = storage.getOutbox();
        storage.saveOutbox([result.queuedReceiptMessage, ...existingOutbox]);
      }

      // Log audit
      storage.logAudit(
        'PAYMENT_RECORDED',
        'payment',
        result.payment.paymentCode,
        `Recorded ${formatINR(result.payment.amountReceivedPaise)} for ${currentCustomer.fullName} (${currentLoan.loanCode}). Principal: ${formatINR(result.payment.allocatedToPrincipalPaise)}, Penalty: ${formatINR(result.payment.allocatedToPenaltyPaise)}`
      );

      // Trigger callback with receipt
      onPaymentSuccess(result.receipt);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="font-semibold text-slate-900 text-base">{t.payment.recordPaymentTitle}</h3>
            <p className="text-xs text-slate-500">
              {lang === 'ta'
                ? 'அசல் மற்றும் அபராத வரவுகளை துல்லியமாக பதிவு செய்க'
                : 'Exact paise ledger allocation with automatic reminder suppression'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Loan Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              {lang === 'ta' ? 'கடன் மற்றும் வாடிக்கையாளர்' : 'Select Active Loan & Customer'}
            </label>
            <select
              value={selectedLoanId}
              onChange={e => handleLoanChange(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-emerald-600"
            >
              {loans.map(loan => (
                <option key={loan.id} value={loan.id}>
                  {loan.loanCode} — {loan.customerName} ({formatINR(loan.originalPrincipalPaise)})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Target Weekly Due Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              {lang === 'ta' ? 'செலுத்தப்படும் தவணை வாரம்' : 'Target Weekly Due'}
            </label>
            <select
              value={selectedDueId}
              onChange={e => handleDueChange(e.target.value)}
              className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-emerald-600"
            >
              {loanDues.map(d => {
                const isPaid = d.paymentStatus === 'paid';
                const pen = penalties.find(p => p.weeklyDueId === d.id && p.status === 'assessed');
                return (
                  <option key={d.id} value={d.id}>
                    Week {d.weekNumber} · {d.dueDate} · Due: {formatINR(d.scheduledPrincipalPaise - d.paidPrincipalPaise)}
                    {pen ? ` (+₹150 Penalty)` : ''}
                    {isPaid ? ' [FULLY PAID]' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* 3. Due Context Summary Card */}
          {currentDue && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>{lang === 'ta' ? 'அசல் நிலுவை:' : 'Remaining Principal Due:'}</span>
                <span className="font-mono font-semibold text-slate-800">
                  {formatINR(currentDue.scheduledPrincipalPaise - currentDue.paidPrincipalPaise)}
                </span>
              </div>
              {currentPenalty && (
                <div className="flex justify-between text-amber-700">
                  <span>{lang === 'ta' ? 'விதிக்கப்பட்ட அபராதம்:' : 'Late Penalty Assessed:'}</span>
                  <span className="font-mono font-semibold">
                    {formatINR(currentPenalty.amountPaise - currentPenalty.paidPaise - currentPenalty.waivedPaise)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 4. Quick Amount Presets */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium">{lang === 'ta' ? 'விரைவுத் தேர்வு:' : 'Quick Presets:'}</span>
            <button
              type="button"
              onClick={() => handleQuickPreset('full_principal')}
              className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium"
            >
              ₹1,000 (Principal)
            </button>
            {currentPenalty && (
              <button
                type="button"
                onClick={() => handleQuickPreset('full_with_penalty')}
                className="text-xs px-2.5 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-medium"
              >
                ₹1,150 (With Penalty)
              </button>
            )}
            <button
              type="button"
              onClick={() => handleQuickPreset('partial_500')}
              className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium"
            >
              ₹500 (Partial)
            </button>
          </div>

          {/* 5. Amount Received & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">{t.payment.amountReceived}</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amountRupees || ''}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    setAmountRupees(val);
                    // Default allocation: to principal first
                    setPrincipalAllocRupees(val);
                    setPenaltyAllocRupees(0);
                  }}
                  className="w-full text-xs font-mono font-semibold pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-emerald-600"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">{t.payment.paymentMethod}</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-emerald-600"
              >
                <option value="cash">Cash (ரொக்கம்)</option>
                <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                <option value="bank_transfer">Bank Transfer (IMPS / NEFT)</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* 6. Allocation Inputs (Principal vs Penalty) */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
            <div className="text-xs font-semibold text-slate-700">
              {lang === 'ta' ? 'வரவு ஒதுக்கீடு (Allocation Breakdown)' : 'Ledger Allocation Policy'}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">{t.payment.allocatePrincipal}</label>
                <input
                  type="number"
                  min="0"
                  value={principalAllocRupees || ''}
                  onChange={e => setPrincipalAllocRupees(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs font-mono p-2 border border-slate-300 rounded-md bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">{t.payment.allocatePenalty}</label>
                <input
                  type="number"
                  min="0"
                  value={penaltyAllocRupees || ''}
                  onChange={e => setPenaltyAllocRupees(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs font-mono p-2 border border-slate-300 rounded-md bg-white"
                />
              </div>
            </div>

            {/* Check validation math */}
            <div className="flex justify-between text-[11px] pt-1 border-t border-slate-200">
              <span className="text-slate-500">Total Allocated:</span>
              <span
                className={`font-mono font-semibold ${
                  Math.abs(principalAllocRupees + penaltyAllocRupees - amountRupees) < 0.01
                    ? 'text-emerald-700'
                    : 'text-red-600'
                }`}
              >
                ₹{principalAllocRupees + penaltyAllocRupees} / ₹{amountRupees}
              </span>
            </div>
          </div>

          {/* 7. Reference & Notes */}
          <div className="space-y-3">
            {paymentMethod !== 'cash' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">{t.payment.reference}</label>
                <input
                  type="text"
                  placeholder="e.g. UPI/20261014/481920"
                  value={transactionReference}
                  onChange={e => setTransactionReference(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-emerald-600 font-mono"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">{t.common.notes}</label>
              <input
                type="text"
                placeholder="Optional internal remarks"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-emerald-600"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
            >
              {lang === 'ta' ? 'வரவு வைத்து ரசீது உருவாக்கு' : 'Post Payment & Generate Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
