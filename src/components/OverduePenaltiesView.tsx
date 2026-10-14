/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  WeeklyDue,
  PenaltyLedgerEntry,
  Loan,
  Customer,
  formatINR,
  SupportedLanguage,
} from '../lib/types';
import { translations } from '../lib/i18n';
import { evaluateTuesdayPenalties, formatDateISO } from '../lib/financialEngine';
import { StorageService } from '../lib/storage';
import {
  AlertTriangle,
  Play,
  CheckCircle,
  FileText,
  X,
  ShieldAlert,
  ArrowRight,
  UserCheck,
} from 'lucide-react';

interface OverduePenaltiesViewProps {
  dues: WeeklyDue[];
  penalties: PenaltyLedgerEntry[];
  loans: Loan[];
  customers: Customer[];
  lang: SupportedLanguage;
  onRefresh: () => void;
  onOpenRecordPayment: (loanId: string, dueId?: string) => void;
}

export const OverduePenaltiesView: React.FC<OverduePenaltiesViewProps> = ({
  dues,
  penalties,
  loans,
  customers,
  lang,
  onRefresh,
  onOpenRecordPayment,
}) => {
  const t = translations[lang];
  const storage = StorageService.getInstance();

  const [activeTab, setActiveTab] = useState<'overdue_dues' | 'penalty_ledger'>('overdue_dues');
  const [evalDate, setEvalDate] = useState<string>(formatDateISO(new Date()));
  const [evaluationFeedback, setEvaluationFeedback] = useState<string | null>(null);

  // Waiver Modal State
  const [waiverPenalty, setWaiverPenalty] = useState<PenaltyLedgerEntry | null>(null);
  const [waiverReason, setWaiverReason] = useState<string>('');
  const [waiverAdmin, setWaiverAdmin] = useState<string>('Super Admin');
  const [waiverError, setWaiverError] = useState<string | null>(null);

  const customerMap = new Map(customers.map(c => [c.id, c]));
  const loanMap = new Map(loans.map(l => [l.id, l]));

  // Overdue dues on Tuesday
  const overdueDues = dues.filter(d => d.isOverdue && d.paymentStatus !== 'paid');

  const handleRunEvaluation = () => {
    setEvaluationFeedback(null);
    const activeLoans = storage.getLoans().filter(l => l.status === 'active');
    const allCustomers = storage.getCustomers();
    const allDues = storage.getWeeklyDues();
    const allPenalties = storage.getPenalties();

    const result = evaluateTuesdayPenalties({
      dues: allDues,
      loans: activeLoans,
      customers: allCustomers,
      existingPenalties: allPenalties,
      currentDateStr: evalDate,
    });

    if (result.assessedCount > 0) {
      // Merge updated dues
      const updatedDuesList = allDues.map(d => {
        const found = result.updatedDues.find(u => u.id === d.id);
        return found || d;
      });
      storage.saveWeeklyDues(updatedDuesList);

      // Append new penalties
      storage.savePenalties([...result.newPenaltyEntries, ...allPenalties]);

      // Append queued alerts
      if (result.queuedAlerts.length > 0) {
        const currentOutbox = storage.getOutbox();
        storage.saveOutbox([...result.queuedAlerts, ...currentOutbox]);
      }

      storage.logAudit(
        'TUESDAY_PENALTY_RUN',
        'penalty',
        'tuesday_eval',
        `Assessed ${result.assessedCount} new penalties (${formatINR(result.assessedPaise)}) and queued ${result.queuedAlerts.length} WhatsApp overdue alerts for date ${evalDate}`
      );

      setEvaluationFeedback(
        lang === 'ta'
          ? `வெற்றிகரமாக ${result.assessedCount} புதிய அபராதங்கள் (${formatINR(result.assessedPaise)}) விதிக்கப்பட்டன மற்றும் வாட்ஸ்அப் எச்சரிக்கைகள் வரிசைப்படுத்தப்பட்டன.`
          : `Successfully assessed ${result.assessedCount} new penalties (${formatINR(result.assessedPaise)}) and queued ${result.queuedAlerts.length} WhatsApp overdue alerts.`
      );
    } else {
      setEvaluationFeedback(
        lang === 'ta'
          ? 'புதிய அபராதங்கள் எதுவும் விதிக்கப்படவில்லை (அனைத்து தவணைகளும் செலுத்தப்பட்டுவிட்டன அல்லது ஏற்கனவே அபராதம் கணக்கிடப்பட்டுவிட்டது).'
          : 'Zero new penalties assessed. All due records are either paid or already possess a single penalty assessment.'
      );
    }

    onRefresh();
  };

  const handleConfirmWaiver = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiverPenalty) return;

    if (!waiverReason.trim() || waiverReason.length < 5) {
      setWaiverError('A documented explanation of at least 5 characters is mandatory for waiving penalties.');
      return;
    }

    const allPenalties = storage.getPenalties();
    const now = new Date().toISOString();

    const updatedPenaltiesList = allPenalties.map(p => {
      if (p.id === waiverPenalty.id) {
        return {
          ...p,
          status: 'waived' as const,
          waivedPaise: p.amountPaise - p.paidPaise,
          waivedBy: waiverAdmin,
          waiverReason: waiverReason.trim(),
        };
      }
      return p;
    });

    storage.savePenalties(updatedPenaltiesList);

    // Update corresponding weekly due
    const allDues = storage.getWeeklyDues();
    const updatedDuesList = allDues.map(d => {
      if (d.id === waiverPenalty.weeklyDueId) {
        return {
          ...d,
          penaltyWaivedPaise: waiverPenalty.amountPaise - waiverPenalty.paidPaise,
          updatedAt: now,
        };
      }
      return d;
    });
    storage.saveWeeklyDues(updatedDuesList);

    storage.logAudit(
      'PENALTY_WAIVED',
      'penalty',
      waiverPenalty.id,
      `Waived penalty ${formatINR(waiverPenalty.amountPaise)} for ${waiverPenalty.customerName} by ${waiverAdmin}. Reason: ${waiverReason}`
    );

    setWaiverPenalty(null);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Tuesday Evaluation Trigger */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span>Tuesday Overdue & Penalty Engine (செவ்வாய் பாக்கி மதிப்பீடு)</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {lang === 'ta' ? 'செவ்வாய் பாக்கி & அபராத மேலாண்மை' : 'Tuesday Overdue Evaluation & Penalty Ledger'}
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            {lang === 'ta'
              ? 'ஞாயிறு தவணை செலுத்தாதவர்களுக்கு செவ்வாய் அன்று ஒரு முறை மட்டுமே ₹150 அபராதம் விதிக்கப்படும். அசல் மற்றும் அபராதம் தனித்தனியாக கணக்கிடப்படும்.'
              : 'Sunday unpaid dues are evaluated on Tuesday. If unpaid, exactly ₹150 is assessed ONCE per due. Never compounded into interest.'}
          </p>
        </div>

        {/* Evaluation Trigger Control */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>Date:</span>
            <input
              type="date"
              value={evalDate}
              onChange={e => setEvalDate(e.target.value)}
              className="text-xs border border-slate-300 rounded p-1 bg-white font-mono"
            />
          </div>
          <button
            onClick={handleRunEvaluation}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{lang === 'ta' ? 'செவ்வாய் விதியை இயக்கு' : 'Evaluate Tuesday Overdue'}</span>
          </button>
        </div>
      </div>

      {evaluationFeedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{evaluationFeedback}</span>
          </div>
          <button
            onClick={() => setEvaluationFeedback(null)}
            className="text-xs font-semibold underline text-emerald-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs: Overdue Dues vs Historical Penalty Ledger */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('overdue_dues')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'overdue_dues'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          {lang === 'ta' ? 'செவ்வாய் பாக்கி தவணைகள்' : 'Tuesday Overdue Dues'} ({overdueDues.length})
        </button>
        <button
          onClick={() => setActiveTab('penalty_ledger')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'penalty_ledger'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          {lang === 'ta' ? 'அபராதக் கணக்கு ஏடு' : 'Penalty Ledger & Waivers'} ({penalties.length})
        </button>
      </div>

      {/* TAB 1: OVERDUE DUES */}
      {activeTab === 'overdue_dues' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Loan ID</th>
                  <th className="py-3 px-4">Week & Due Date</th>
                  <th className="py-3 px-4 text-right">Remaining Principal</th>
                  <th className="py-3 px-4 text-right">Assessed Penalty</th>
                  <th className="py-3 px-4 text-right">Total Outstanding</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overdueDues.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                      {lang === 'ta' ? 'செவ்வாய் பாக்கிகள் ஏதுமில்லை' : 'No overdue Tuesday dues currently.'}
                    </td>
                  </tr>
                ) : (
                  overdueDues.map(due => {
                    const customer = customerMap.get(due.customerId);
                    const loan = loanMap.get(due.loanId);
                    const remPrincipal = due.scheduledPrincipalPaise - due.paidPrincipalPaise;
                    const totalDue = remPrincipal + due.penaltyAssessedPaise;

                    return (
                      <tr key={due.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">
                            {customer ? customer.fullName : 'Customer'}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {customer ? customer.mobileNumber : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                          {loan ? loan.loanCode : ''}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900">Week {due.weekNumber}</span>
                          <span className="text-[11px] text-slate-500 block font-mono">{due.dueDate}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                          {formatINR(remPrincipal)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-amber-700">
                          {formatINR(due.penaltyAssessedPaise)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-950 text-sm">
                          {formatINR(totalDue)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onOpenRecordPayment(due.loanId, due.id)}
                            className="px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
                          >
                            Collect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PENALTY LEDGER & WAIVER WORKFLOW */}
      {activeTab === 'penalty_ledger' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Assessment Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Week & Reason</th>
                  <th className="py-3 px-4 text-right">Penalty Amount</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {penalties.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      No penalties in ledger yet.
                    </td>
                  </tr>
                ) : (
                  penalties.map(pen => {
                    const isWaived = pen.status === 'waived';
                    const isPaid = pen.status === 'paid';

                    return (
                      <tr key={pen.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {pen.assessmentDate}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {pen.customerName}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>Week {pen.weekNumber}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                            {pen.assessmentReason}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-amber-700">
                          {formatINR(pen.amountPaise)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                          {formatINR(pen.paidPaise)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`text-[11px] font-semibold uppercase ${
                              isWaived
                                ? 'text-slate-400'
                                : isPaid
                                ? 'text-emerald-700'
                                : 'text-amber-800'
                            }`}
                          >
                            {pen.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!isWaived && !isPaid && (
                            <button
                              onClick={() => {
                                setWaiverPenalty(pen);
                                setWaiverReason('');
                                setWaiverError(null);
                              }}
                              className="text-xs font-semibold text-slate-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                            >
                              Waive Penalty
                            </button>
                          )}
                          {isWaived && (
                            <span className="text-[11px] text-slate-400 italic">
                              Waived by {pen.waivedBy}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WAIVER MODAL */}
      {waiverPenalty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-amber-50">
              <div className="flex items-center gap-2 text-amber-900 font-semibold">
                <ShieldAlert className="w-5 h-5 text-amber-700" />
                <span>Admin Penalty Waiver Form</span>
              </div>
              <button
                onClick={() => setWaiverPenalty(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmWaiver} className="p-6 space-y-4 text-xs">
              {waiverError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-800">
                  {waiverError}
                </div>
              )}

              <p className="text-slate-600">
                You are about to waive the late penalty of <strong>{formatINR(waiverPenalty.amountPaise)}</strong> for {waiverPenalty.customerName} (Week {waiverPenalty.weekNumber}).
              </p>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Documented Waiver Reason *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Verified family medical emergency / Customer paid Monday evening but receipt posted Wednesday"
                  value={waiverReason}
                  onChange={e => setWaiverReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-amber-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Authorizing Admin *</label>
                <input
                  type="text"
                  required
                  value={waiverAdmin}
                  onChange={e => setWaiverAdmin(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWaiverPenalty(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold"
                >
                  Confirm Waiver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
