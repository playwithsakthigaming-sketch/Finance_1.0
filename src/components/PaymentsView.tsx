/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Payment,
  Receipt,
  WeeklyDue,
  PenaltyLedgerEntry,
  formatINR,
  SupportedLanguage,
} from '../lib/types';
import { translations } from '../lib/i18n';
import { reversePayment } from '../lib/financialEngine';
import { StorageService } from '../lib/storage';
import {
  Search,
  Filter,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Share2,
} from 'lucide-react';

interface PaymentsViewProps {
  payments: Payment[];
  receipts: Receipt[];
  dues: WeeklyDue[];
  penalties: PenaltyLedgerEntry[];
  lang: SupportedLanguage;
  onRefresh: () => void;
  onViewReceipt: (receipt: Receipt) => void;
  onOpenRecordPayment: () => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  payments,
  receipts,
  dues,
  penalties,
  lang,
  onRefresh,
  onViewReceipt,
  onOpenRecordPayment,
}) => {
  const t = translations[lang];
  const storage = StorageService.getInstance();

  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Reversal Modal State
  const [reversalPayment, setReversalPayment] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');
  const [reversalActor, setReversalActor] = useState<string>('Super Admin');
  const [reversalError, setReversalError] = useState<string | null>(null);

  const filteredPayments = payments.filter(p => {
    const matchesSearch =
      p.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.paymentCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.transactionReference && p.transactionReference.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesMethod = methodFilter === 'all' || p.paymentMethod === methodFilter;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesMethod && matchesStatus;
  });

  const handleOpenReversal = (payment: Payment) => {
    setReversalPayment(payment);
    setReversalReason('');
    setReversalError(null);
  };

  const handleConfirmReversal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalPayment) return;

    if (!reversalReason.trim() || reversalReason.length < 5) {
      setReversalError('A documented reason of at least 5 characters is mandatory for reversals.');
      return;
    }

    try {
      const allDues = storage.getWeeklyDues();
      const allPenalties = storage.getPenalties();

      const result = reversePayment({
        payment: reversalPayment,
        dues: allDues,
        penalties: allPenalties,
        reversalReason: reversalReason.trim(),
        reversedBy: reversalActor.trim() || 'Admin',
      });

      // Update storage
      const currentPayments = storage.getPayments();
      const updatedPaymentsList = currentPayments.map(p =>
        p.id === result.updatedPayment.id ? result.updatedPayment : p
      );
      storage.savePayments(updatedPaymentsList);
      storage.saveWeeklyDues(result.updatedDues);
      storage.savePenalties(result.updatedPenalties);

      storage.logAudit(
        'PAYMENT_REVERSED',
        'payment',
        reversalPayment.paymentCode,
        `Payment ${reversalPayment.paymentCode} of ${formatINR(reversalPayment.amountReceivedPaise)} reversed by ${reversalActor}. Reason: ${reversalReason}`
      );

      setReversalPayment(null);
      onRefresh();
    } catch (err: any) {
      setReversalError(err.message || 'Failed to reverse payment');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search Strip */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">{t.nav.payments}</h2>
          <p className="text-xs text-slate-500">
            {lang === 'ta'
              ? 'வரவு வைக்கப்பட்ட கட்டண வரலாறு, ரசீதுகள் மற்றும் திரும்பப் பெறும் கணக்கு'
              : 'Authoritative transaction ledger with itemized allocations and audited reversals'}
          </p>
        </div>

        <button
          onClick={onOpenRecordPayment}
          className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
        >
          {t.nav.recordPayment}
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={lang === 'ta' ? 'ரசீது எண், வாடிக்கையாளர் அல்லது குறிப்பு...' : 'Search receipt code, customer, or UTR...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-emerald-600"
          />
        </div>

        <select
          value={methodFilter}
          onChange={e => setMethodFilter(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-700"
        >
          <option value="all">All Methods (அனைத்து முறை)</option>
          <option value="cash">Cash (ரொக்கம்)</option>
          <option value="upi">UPI</option>
          <option value="bank_transfer">Bank Transfer</option>
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-700"
        >
          <option value="all">All Statuses</option>
          <option value="posted">Posted</option>
          <option value="reversed">Reversed</option>
        </select>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Receipt / Code</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Method & Ref</th>
                <th className="py-3 px-4 text-right">Principal</th>
                <th className="py-3 px-4 text-right">Penalty</th>
                <th className="py-3 px-4 text-right">Total Received</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    {t.common.noData}
                  </td>
                </tr>
              ) : (
                filteredPayments.map(payment => {
                  const matchingReceipt = receipts.find(r => r.paymentId === payment.id);
                  const isReversed = payment.status === 'reversed';

                  return (
                    <tr
                      key={payment.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isReversed ? 'bg-red-50/20 text-slate-400 line-through' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {payment.paymentCode}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {new Date(payment.paymentDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{payment.customerName}</div>
                        {payment.weekNumber && (
                          <div className="text-[11px] text-slate-500">Week {payment.weekNumber}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="uppercase text-slate-700 font-medium">
                          {payment.paymentMethod}
                        </span>
                        {payment.transactionReference && (
                          <span className="font-mono text-slate-500 block text-[11px] truncate max-w-[120px]">
                            {payment.transactionReference}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                        {formatINR(payment.allocatedToPrincipalPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700">
                        {payment.allocatedToPenaltyPaise > 0
                          ? formatINR(payment.allocatedToPenaltyPaise)
                          : '₹0'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-emerald-800 text-sm">
                        {formatINR(payment.amountReceivedPaise)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isReversed ? (
                          <span className="text-[11px] font-semibold text-red-700">Reversed</span>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-700">Posted</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {matchingReceipt && (
                            <>
                              <button
                                onClick={() => onViewReceipt(matchingReceipt)}
                                className="p-1 rounded text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                                title={lang === 'ta' ? 'வாட்ஸ்அப் ரசீது அனுப்பவும்' : 'Send WhatsApp Receipt'}
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => onViewReceipt(matchingReceipt)}
                                className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                title="Print / View Receipt"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {!isReversed && (
                            <button
                              onClick={() => handleOpenReversal(payment)}
                              className="p-1 rounded text-slate-400 hover:text-red-700 hover:bg-red-50"
                              title="Reverse Payment"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REVERSAL CONFIRMATION DIALOG */}
      {reversalPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-red-50">
              <div className="flex items-center gap-2 text-red-800 font-semibold">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span>{t.payment.reversalNotice}</span>
              </div>
              <button
                onClick={() => setReversalPayment(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReversal} className="p-6 space-y-4 text-xs">
              {reversalError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-800">
                  {reversalError}
                </div>
              )}

              <p className="text-slate-600">
                You are about to reverse payment <strong className="font-mono">{reversalPayment.paymentCode}</strong> ({formatINR(reversalPayment.amountReceivedPaise)}) for {reversalPayment.customerName}.
              </p>
              <p className="text-slate-500">
                This will automatically recalculate the due balance, restore principal remaining, and log this event in the immutable audit trail.
              </p>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">{t.payment.reversalReason} *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Cash counted incorrectly by cashier / duplicate manual entry"
                  value={reversalReason}
                  onChange={e => setReversalReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-red-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Authorizing Admin *</label>
                <input
                  type="text"
                  required
                  value={reversalActor}
                  onChange={e => setReversalActor(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReversalPayment(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
                >
                  {t.payment.reversePayment}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
