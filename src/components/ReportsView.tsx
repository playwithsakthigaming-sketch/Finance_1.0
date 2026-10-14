/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Payment,
  Loan,
  Customer,
  WeeklyDue,
  PenaltyLedgerEntry,
  Receipt,
  formatINR,
  SupportedLanguage,
} from '../lib/types';
import { translations } from '../lib/i18n';
import {
  Download,
  Printer,
  Calendar,
  Filter,
  BarChart,
  FileSpreadsheet,
  CheckCircle,
  TrendingUp,
  AlertTriangle,
  Clock,
  DollarSign,
  ArrowUpRight,
  Coins,
  FileText,
  AlertCircle,
  Percent,
} from 'lucide-react';
import { RunningBorderCard } from './RunningBorderCard';

interface ReportsViewProps {
  payments: Payment[];
  loans: Loan[];
  customers: Customer[];
  dues: WeeklyDue[];
  penalties: PenaltyLedgerEntry[];
  receipts: Receipt[];
  lang: SupportedLanguage;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  payments,
  loans,
  customers,
  dues,
  penalties,
  receipts,
  lang,
}) => {
  const t = translations[lang];

  // Default to current month (YYYY-MM)
  const currentMonthISO = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthISO);
  const [reportType, setReportType] = useState<
    'current_month_summary' | 'collection_register' | 'principal_outstanding' | 'penalty_report'
  >('current_month_summary');

  const isCurrentMonth = selectedMonth === currentMonthISO;

  // Format month label (e.g., October 2026 or அக்டோபர் 2026)
  const monthDisplayLabel = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const date = new Date(year, month, 1);
    
    if (lang === 'ta') {
      const tamilMonths = [
        'ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்',
        'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'
      ];
      return `${tamilMonths[month]} ${year}`;
    }
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [selectedMonth, lang]);

  // ====================================================================
  // CURRENT MONTH COMPUTATIONS:
  // 1. Total Loans Disbursed
  // 2. Interest Collected
  // 3. Pending Dues
  // ====================================================================

  // Loans Disbursed in the selected month
  const loansInMonth = useMemo(() => {
    return loans.filter(l => {
      const matchStart = l.startDate && l.startDate.startsWith(selectedMonth);
      const matchCreated = l.createdAt && l.createdAt.startsWith(selectedMonth);
      return matchStart || matchCreated;
    });
  }, [loans, selectedMonth]);

  const monthLoansDisbursedNetPaise = useMemo(() => {
    return loansInMonth.reduce((sum, l) => sum + (l.netDisbursedPaise || (l.originalPrincipalPaise - l.upfrontDeductionPaise)), 0);
  }, [loansInMonth]);

  const monthLoansOriginalPrincipalPaise = useMemo(() => {
    return loansInMonth.reduce((sum, l) => sum + l.originalPrincipalPaise, 0);
  }, [loansInMonth]);

  const monthLoansCount = loansInMonth.length;

  // Interest Collected in the selected month:
  // - Upfront interest/deductions deducted at disbursement on new loans
  // - Penalties / late fees collected via payments posted this month
  const monthUpfrontInterestPaise = useMemo(() => {
    return loansInMonth.reduce((sum, l) => sum + l.upfrontDeductionPaise, 0);
  }, [loansInMonth]);

  const paymentsInMonth = useMemo(() => {
    return payments.filter(p => p.status === 'posted' && p.paymentDate && p.paymentDate.startsWith(selectedMonth));
  }, [payments, selectedMonth]);

  const monthPenaltiesCollectedPaise = useMemo(() => {
    return paymentsInMonth.reduce((sum, p) => sum + p.allocatedToPenaltyPaise, 0);
  }, [paymentsInMonth]);

  const monthPrincipalCollectedPaise = useMemo(() => {
    return paymentsInMonth.reduce((sum, p) => sum + p.allocatedToPrincipalPaise, 0);
  }, [paymentsInMonth]);

  const monthTotalCashReceivedPaise = useMemo(() => {
    return paymentsInMonth.reduce((sum, p) => sum + p.amountReceivedPaise, 0);
  }, [paymentsInMonth]);

  const monthTotalInterestCollectedPaise = monthUpfrontInterestPaise + monthPenaltiesCollectedPaise;

  // Pending Dues for the selected month:
  // Weekly dues scheduled with dueDate in this month
  const duesInMonth = useMemo(() => {
    return dues.filter(d => d.dueDate && d.dueDate.startsWith(selectedMonth));
  }, [dues, selectedMonth]);

  const monthScheduledPrincipalPaise = useMemo(() => {
    return duesInMonth.reduce((sum, d) => sum + d.scheduledPrincipalPaise, 0);
  }, [duesInMonth]);

  const monthPaidPrincipalPaise = useMemo(() => {
    return duesInMonth.reduce((sum, d) => sum + d.paidPrincipalPaise, 0);
  }, [duesInMonth]);

  const monthPendingPrincipalDuesPaise = useMemo(() => {
    return duesInMonth.reduce((sum, d) => sum + Math.max(0, d.remainingPrincipalPaise), 0);
  }, [duesInMonth]);

  const monthPendingPenaltyDuesPaise = useMemo(() => {
    return duesInMonth.reduce((sum, d) => {
      const netPenalty = Math.max(0, d.penaltyAssessedPaise - d.penaltyPaidPaise - d.penaltyWaivedPaise);
      return sum + netPenalty;
    }, 0);
  }, [duesInMonth]);

  const monthTotalPendingDuesPaise = monthPendingPrincipalDuesPaise + monthPendingPenaltyDuesPaise;

  const monthPendingDuesCount = duesInMonth.filter(d => d.paymentStatus !== 'paid').length;
  const monthPaidDuesCount = duesInMonth.filter(d => d.paymentStatus === 'paid').length;
  const monthOverdueDuesCount = duesInMonth.filter(d => d.isOverdue && d.paymentStatus !== 'paid').length;

  const monthCollectionRatePercent = monthScheduledPrincipalPaise > 0
    ? Math.min(100, Math.round((monthPaidPrincipalPaise / monthScheduledPrincipalPaise) * 100))
    : 0;

  // Running borders check
  const isRunningBorder = typeof window !== 'undefined'
    ? localStorage.getItem('app_running_borders') !== 'false'
    : true;

  // Customer map for lookups
  const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
  const loanMap = useMemo(() => new Map(loans.map(l => [l.id, l])), [loans]);

  // CSV Export utility
  const exportToCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    if (reportType === 'current_month_summary') {
      const headers = [
        'Due Code',
        'Customer Name',
        'Mobile',
        'Week No',
        'Due Date',
        'Scheduled Principal (INR)',
        'Paid Principal (INR)',
        'Pending Principal (INR)',
        'Penalty Assessed (INR)',
        'Status',
        'Is Overdue'
      ];
      const rows = duesInMonth.map(d => {
        const cust = customerMap.get(d.customerId);
        return [
          d.dueCode,
          cust ? cust.fullName : 'Customer',
          cust ? cust.mobileNumber : '',
          d.weekNumber,
          d.dueDate,
          (d.scheduledPrincipalPaise / 100).toFixed(2),
          (d.paidPrincipalPaise / 100).toFixed(2),
          (d.remainingPrincipalPaise / 100).toFixed(2),
          (d.penaltyAssessedPaise / 100).toFixed(2),
          d.paymentStatus.toUpperCase(),
          d.isOverdue ? 'YES' : 'NO'
        ];
      });
      exportToCSV(`Monthly_Dues_Report_${selectedMonth}`, headers, rows);
    } else if (reportType === 'collection_register') {
      const headers = ['Receipt No', 'Date', 'Customer', 'Method', 'Principal (INR)', 'Penalty (INR)', 'Total (INR)', 'Status'];
      const rows = payments.map(p => [
        p.paymentCode,
        p.paymentDate.split('T')[0],
        p.customerName,
        p.paymentMethod.toUpperCase(),
        (p.allocatedToPrincipalPaise / 100).toFixed(2),
        (p.allocatedToPenaltyPaise / 100).toFixed(2),
        (p.amountReceivedPaise / 100).toFixed(2),
        p.status,
      ]);
      exportToCSV(`Collection_Register_${new Date().toISOString().split('T')[0]}`, headers, rows);
    } else if (reportType === 'principal_outstanding') {
      const headers = ['Loan Code', 'Customer', 'Start Date', 'Original Principal', 'Collected', 'Remaining Principal'];
      const rows = loans.map(l => {
        const lDues = dues.filter(d => d.loanId === l.id);
        const collected = lDues.reduce((sum, d) => sum + d.paidPrincipalPaise, 0);
        const rem = l.originalPrincipalPaise - collected;
        return [
          l.loanCode,
          l.customerName,
          l.startDate,
          (l.originalPrincipalPaise / 100).toFixed(2),
          (collected / 100).toFixed(2),
          (rem / 100).toFixed(2),
        ];
      });
      exportToCSV(`Principal_Outstanding_${new Date().toISOString().split('T')[0]}`, headers, rows);
    } else if (reportType === 'penalty_report') {
      const headers = ['Date', 'Customer', 'Week', 'Penalty Assessed', 'Paid', 'Waived', 'Status'];
      const rows = penalties.map(pen => [
        pen.assessmentDate,
        pen.customerName,
        pen.weekNumber,
        (pen.amountPaise / 100).toFixed(2),
        (pen.paidPaise / 100).toFixed(2),
        (pen.waivedPaise / 100).toFixed(2),
        pen.status,
      ]);
      exportToCSV(`Penalty_Register_${new Date().toISOString().split('T')[0]}`, headers, rows);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Lifetime Aggregations
  let totalPrincipalCollected = 0;
  let totalPenaltyCollected = 0;
  let totalCashReceived = 0;

  payments.filter(p => p.status === 'posted').forEach(p => {
    totalPrincipalCollected += p.allocatedToPrincipalPaise;
    totalPenaltyCollected += p.allocatedToPenaltyPaise;
    totalCashReceived += p.amountReceivedPaise;
  });

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {lang === 'ta' ? 'அதிகாரப்பூர்வ நிதி அறிக்கைகள்' : 'Financial Reports & Reconciliation'}
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            {lang === 'ta'
              ? 'வசூல் பதிவேடு, அசல் நிலுவை அறிக்கை, அபராதப் பதிவேடு மற்றும் முறை வாரியான பிரிவுகள்'
              : 'Exportable double-entry registers, principal aging, Tuesday penalty assessments, and ledger balances.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shadow-xs"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>{t.common.exportCsv}</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>{t.common.print}</span>
          </button>
        </div>
      </div>

      {/* NEW: Current Month Financial Performance Summary Section */}
      <RunningBorderCard enabled={isRunningBorder} glowColor="multi">
        <div className="p-6 bg-white rounded-2xl border border-slate-200">
          {/* Header of Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500">
                  <Calendar className="w-4 h-4" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-600">
                  {lang === 'ta' ? 'நடப்பு மாத அறிக்கை' : 'Monthly Financial Executive Summary'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isCurrentMonth
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                }`}>
                  {isCurrentMonth
                    ? (lang === 'ta' ? 'நடப்பு மாதம்' : 'Current Month')
                    : (lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட மாதம்' : 'Filtered Month')}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                {monthDisplayLabel}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {lang === 'ta'
                  ? 'தேர்ந்தெடுக்கப்பட்ட மாதத்திற்கான மொத்த கடன்கள், வசூலிக்கப்பட்ட வட்டி மற்றும் நிலுவைத் தவணைகள்.'
                  : 'Key performance indicators for loans disbursed, upfront & fee interest realized, and collection dues.'}
              </p>
            </div>

            {/* Month Selector Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-xs text-slate-500 font-medium hidden sm:inline">
                {lang === 'ta' ? 'மாதம் தேர்வு:' : 'Select Month:'}
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => e.target.value && setSelectedMonth(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 shadow-xs"
              />
              {!isCurrentMonth && (
                <button
                  onClick={() => setSelectedMonth(currentMonthISO)}
                  className="px-2.5 py-1.5 text-xs font-medium text-cyan-600 hover:text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-lg transition-colors border border-cyan-200"
                  title="Reset to current month"
                >
                  {lang === 'ta' ? 'இன்றைய மாதம்' : 'Current Month'}
                </button>
              )}
            </div>
          </div>

          {/* 3 Primary Requested Summary KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            {/* 1. Total Loans Disbursed */}
            <div className="p-4 rounded-xl border border-cyan-500/20 bg-linear-to-br from-cyan-50/50 via-white to-slate-50/50 shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {lang === 'ta' ? 'வழங்கப்பட்ட கடன்கள்' : 'Total Loans Disbursed'}
                </span>
                <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600">
                  <Coins className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black font-mono tracking-tight text-cyan-900 tabular-nums">
                {formatINR(monthLoansDisbursedNetPaise)}
              </div>
              <div className="text-[11px] text-slate-500 mt-2 space-y-0.5 border-t border-slate-100 pt-2">
                <div className="flex justify-between">
                  <span>{lang === 'ta' ? 'அசல் தொகை:' : 'Gross Principal:'}</span>
                  <span className="font-semibold text-slate-700">{formatINR(monthLoansOriginalPrincipalPaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{lang === 'ta' ? 'வழங்கப்பட்ட கணக்குகள்:' : 'Loans Disbursed:'}</span>
                  <span className="font-semibold text-cyan-700">{monthLoansCount} {lang === 'ta' ? 'கடன்கள்' : 'loans'}</span>
                </div>
              </div>
            </div>

            {/* 2. Interest Collected */}
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-linear-to-br from-emerald-50/50 via-white to-slate-50/50 shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {lang === 'ta' ? 'வசூலான வட்டி & கட்டணம்' : 'Interest Collected'}
                </span>
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black font-mono tracking-tight text-emerald-900 tabular-nums">
                {formatINR(monthTotalInterestCollectedPaise)}
              </div>
              <div className="text-[11px] text-slate-500 mt-2 space-y-0.5 border-t border-slate-100 pt-2">
                <div className="flex justify-between">
                  <span>{lang === 'ta' ? 'முன்பிடித்த வட்டி:' : 'Upfront Deductions:'}</span>
                  <span className="font-semibold text-emerald-700">{formatINR(monthUpfrontInterestPaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{lang === 'ta' ? 'தாமத அபராத வட்டி:' : 'Late Fees / Penalties:'}</span>
                  <span className="font-semibold text-amber-700">{formatINR(monthPenaltiesCollectedPaise)}</span>
                </div>
              </div>
            </div>

            {/* 3. Pending Dues */}
            <div className="p-4 rounded-xl border border-amber-500/20 bg-linear-to-br from-amber-50/50 via-white to-slate-50/50 shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {lang === 'ta' ? 'மாத நிலுவைத் தவணைகள்' : 'Pending Dues for Month'}
                </span>
                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black font-mono tracking-tight text-amber-900 tabular-nums">
                {formatINR(monthTotalPendingDuesPaise)}
              </div>
              <div className="text-[11px] text-slate-500 mt-2 space-y-0.5 border-t border-slate-100 pt-2">
                <div className="flex justify-between">
                  <span>{lang === 'ta' ? 'நிலுவை அசல்:' : 'Remaining Principal:'}</span>
                  <span className="font-semibold text-slate-700">{formatINR(monthPendingPrincipalDuesPaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{lang === 'ta' ? 'நிலுவை கணக்குகள்:' : 'Pending / Overdue:'}</span>
                  <span className="font-semibold text-amber-700">
                    {monthPendingDuesCount} {lang === 'ta' ? 'தவணைகள்' : 'dues'} {monthOverdueDuesCount > 0 ? `(${monthOverdueDuesCount} overdue)` : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Collection Progress Bar & Operating Cash Flow Strip */}
          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700">
                  {lang === 'ta' ? 'தவணை வசூல் அடைவு வீதம்:' : 'Monthly Due Realization Rate:'}
                </span>
                <span className="font-mono font-bold text-emerald-700">
                  {monthCollectionRatePercent}% ({formatINR(monthPaidPrincipalPaise)} / {formatINR(monthScheduledPrincipalPaise)})
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-linear-to-r from-emerald-500 to-cyan-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${monthCollectionRatePercent}%` }}
                />
              </div>
            </div>

            {/* Cash Flow Summary */}
            <div className="flex items-center justify-between md:justify-end gap-6 text-xs">
              <div>
                <span className="text-slate-500 block">{lang === 'ta' ? 'மாத பண வரவு' : 'Cash Collected'}</span>
                <span className="font-mono font-bold text-emerald-800">{formatINR(monthTotalCashReceivedPaise)}</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-500 block">{lang === 'ta' ? 'மாத கடன் பட்டுவாடா' : 'Cash Disbursed'}</span>
                <span className="font-mono font-bold text-cyan-800">{formatINR(monthLoansDisbursedNetPaise)}</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-500 block">{lang === 'ta' ? 'செலுத்தப்பட்ட தவணைகள்' : 'Paid Dues'}</span>
                <span className="font-mono font-bold text-slate-800">{monthPaidDuesCount} / {duesInMonth.length}</span>
              </div>
            </div>
          </div>
        </div>
      </RunningBorderCard>

      {/* Lifetime Summary KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block">Total Cash Posted (Lifetime)</span>
          <span className="text-xl font-bold font-mono text-emerald-800 tabular-nums">
            {formatINR(totalCashReceived)}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">Across all active receipts</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block">Principal Credited (Lifetime)</span>
          <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
            {formatINR(totalPrincipalCollected)}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">Directly offsets loan principal</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block">Penalties Collected (Lifetime)</span>
          <span className="text-xl font-bold font-mono text-amber-700 tabular-nums">
            {formatINR(totalPenaltyCollected)}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">Separate penalty ledger credit</span>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setReportType('current_month_summary')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            reportType === 'current_month_summary'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
          <span>{lang === 'ta' ? 'நடப்பு மாத விரிவான அறிக்கை' : 'Current Month Dues & Disbursement Register'}</span>
        </button>
        <button
          onClick={() => setReportType('collection_register')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            reportType === 'collection_register'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Daily / Weekly Collection Register
        </button>
        <button
          onClick={() => setReportType('principal_outstanding')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            reportType === 'principal_outstanding'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Principal Outstanding Schedule
        </button>
        <button
          onClick={() => setReportType('penalty_report')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            reportType === 'penalty_report'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Penalty Assessment & Waiver Register
        </button>
      </div>

      {/* REPORT CONTENT TABLES */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {reportType === 'collection_register' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Receipt No</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Customer Name</th>
                  <th className="py-2.5 px-4">Payment Method</th>
                  <th className="py-2.5 px-4 text-right">Principal (₹)</th>
                  <th className="py-2.5 px-4 text-right">Penalty (₹)</th>
                  <th className="py-2.5 px-4 text-right">Total Received (₹)</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{p.paymentCode}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{p.paymentDate.split('T')[0]}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{p.customerName}</td>
                    <td className="py-2.5 px-4 uppercase text-slate-700">{p.paymentMethod}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatINR(p.allocatedToPrincipalPaise)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700">
                      {formatINR(p.allocatedToPenaltyPaise)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums text-emerald-800">
                      {formatINR(p.amountReceivedPaise)}
                    </td>
                    <td className="py-2.5 px-4 text-center uppercase font-semibold text-[10px] text-emerald-700">
                      {p.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'principal_outstanding' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Loan ID</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Start Date</th>
                  <th className="py-2.5 px-4 text-right">Original Principal</th>
                  <th className="py-2.5 px-4 text-right">Upfront Deduction</th>
                  <th className="py-2.5 px-4 text-right">Principal Collected</th>
                  <th className="py-2.5 px-4 text-right">Principal Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loans.map(loan => {
                  const loanDuesList = dues.filter(d => d.loanId === loan.id);
                  const collected = loanDuesList.reduce((sum, d) => sum + d.paidPrincipalPaise, 0);
                  const outstanding = Math.max(0, loan.originalPrincipalPaise - collected);

                  return (
                    <tr key={loan.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{loan.loanCode}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{loan.customerName}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{loan.startDate}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                        {formatINR(loan.originalPrincipalPaise)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                        {formatINR(loan.upfrontDeductionPaise)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700">
                        {formatINR(collected)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums text-slate-950">
                        {formatINR(outstanding)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'penalty_report' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Assessment Date</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Reason</th>
                  <th className="py-2.5 px-4 text-right">Penalty Assessed</th>
                  <th className="py-2.5 px-4 text-right">Paid</th>
                  <th className="py-2.5 px-4 text-right">Waived</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {penalties.map(pen => (
                  <tr key={pen.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono text-slate-600">{pen.assessmentDate}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{pen.customerName}</td>
                    <td className="py-2.5 px-4 text-slate-600">{pen.assessmentReason}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700">
                      {formatINR(pen.amountPaise)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatINR(pen.paidPaise)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-400">
                      {formatINR(pen.waivedPaise)}
                    </td>
                    <td className="py-2.5 px-4 text-center uppercase font-semibold text-[10px] text-slate-700">
                      {pen.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
