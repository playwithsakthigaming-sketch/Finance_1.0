/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  DashboardMetrics,
  WeeklyDue,
  formatINR,
  SupportedLanguage,
  Loan,
  Customer,
  BusinessSettings,
} from '../lib/types';
import { translations } from '../lib/i18n';
import {
  Users,
  CreditCard,
  AlertTriangle,
  Send,
  Calendar,
  ArrowUpRight,
  TrendingUp,
  CheckCircle2,
  Clock,
  Sparkles,
  DollarSign,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { RunningBorderCard } from './RunningBorderCard';

interface DashboardViewProps {
  metrics: DashboardMetrics;
  dues: WeeklyDue[];
  loans: Loan[];
  customers: Customer[];
  settings?: BusinessSettings;
  lang: SupportedLanguage;
  onOpenRecordPayment: () => void;
  onOpenCreateLoan: () => void;
  onNavigate: (view: string) => void;
  onRunTuesdayCheck: () => void;
  onProcessQueue: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  dues,
  loans,
  customers,
  settings,
  lang,
  onOpenRecordPayment,
  onOpenCreateLoan,
  onNavigate,
  onRunTuesdayCheck,
  onProcessQueue,
}) => {
  const t = translations[lang];

  // Overdue dues on Tuesday
  const overdueDues = dues.filter(d => d.isOverdue && d.paymentStatus !== 'paid');

  // Next upcoming Sunday dues
  const upcomingSundayDues = dues
    .filter(d => d.paymentStatus !== 'paid')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  const customerMap = new Map(customers.map(c => [c.id, c]));
  const loanMap = new Map(loans.map(l => [l.id, l]));

  const isRunningBorder = typeof window !== 'undefined' ? localStorage.getItem('app_running_borders') !== 'false' : true;

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome Strip with Running Border Effect */}
      <RunningBorderCard enabled={isRunningBorder} glowColor="multi">
        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>{lang === 'ta' ? 'சேலம் கிளை' : 'Salem Main Office'}</span>
              <span aria-hidden="true">·</span>
              <span>{lang === 'ta' ? 'வாராந்திர சுழற்சி' : '10-Week Loan Engine'}</span>
              <span aria-hidden="true">·</span>
              <span>Asia/Kolkata</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <span>{lang === 'ta' ? 'வணக்கம், நிதி மேலாளர்' : 'Microfinance Operations Console'}</span>
              {isRunningBorder && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/30">
                  <Zap className="w-3 h-3 text-cyan-400 animate-pulse" />
                  NEON
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              {lang === 'ta'
                ? 'அசல், முன்பிடித்தம், ஞாயிறு தவணைகள், செவ்வாய் அபராதம் மற்றும் வாட்ஸ்அப் ரசீதுகள்.'
                : 'Managing ₹10,000 weekly microloans, separate ledger accounting, Tuesday ₹150 penalty evaluation, and Meta Cloud API.'}
            </p>
          </div>

          {/* Quick Operations Strip */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenRecordPayment}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
            >
              {t.nav.recordPayment}
            </button>
            <button
              onClick={onOpenCreateLoan}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              {t.loan.createLoan}
            </button>
            <button
              onClick={onRunTuesdayCheck}
              className="px-3.5 py-2 text-xs font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
            >
              {lang === 'ta' ? 'செவ்வாய் பாக்கி மதிப்பீடு' : 'Run Tuesday Penalty Check'}
            </button>
          </div>
        </div>
      </RunningBorderCard>

      {/* KPI METRIC CARDS GRID (Clean, single elevation, tabular nums) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Principal Issued & Disbursed */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
          <span className="text-xs font-medium text-slate-500 block truncate">
            {t.metrics.originalPrincipal}
          </span>
          <div className="text-xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
            {formatINR(metrics.originalPrincipalIssuedPaise)}
          </div>
          <div className="text-[11px] text-slate-500 pt-1 flex justify-between">
            <span>{t.metrics.netDisbursed}:</span>
            <span className="font-mono font-medium text-slate-700">
              {formatINR(metrics.netDisbursedPaise)}
            </span>
          </div>
        </div>

        {/* Metric 2: Principal Collected vs Outstanding */}
        <RunningBorderCard enabled={isRunningBorder} glowColor="cyan" className="rounded-xl">
          <div className="p-4 space-y-1">
            <span className="text-xs font-medium text-slate-500 block truncate">
              {t.metrics.principalCollected}
            </span>
            <div className="text-xl font-bold font-mono tracking-tight text-emerald-700 dark:text-cyan-400 tabular-nums">
              {formatINR(metrics.principalCollectedPaise)}
            </div>
            <div className="text-[11px] text-slate-500 pt-1 flex justify-between">
              <span>{t.metrics.principalOutstanding}:</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                {formatINR(metrics.principalOutstandingPaise)}
              </span>
            </div>
          </div>
        </RunningBorderCard>

        {/* Metric 3: Penalties Assessed & Collected */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
          <span className="text-xs font-medium text-slate-500 block truncate">
            {t.metrics.penaltiesAssessed}
          </span>
          <div className="text-xl font-bold font-mono tracking-tight text-amber-700 tabular-nums">
            {formatINR(metrics.penaltiesAssessedPaise)}
          </div>
          <div className="text-[11px] text-slate-500 pt-1 flex justify-between">
            <span>{t.metrics.penaltiesOutstanding}:</span>
            <span className="font-mono font-medium text-amber-800">
              {formatINR(metrics.penaltiesOutstandingPaise)}
            </span>
          </div>
        </div>

        {/* Metric 4: Active Portfolio Count */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
          <span className="text-xs font-medium text-slate-500 block truncate">
            {lang === 'ta' ? 'செயலில் உள்ள கடன்கள்' : 'Active Borrowers & Loans'}
          </span>
          <div className="text-xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
            {metrics.activeLoansCount} <span className="text-xs font-normal text-slate-500">Loans</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 flex justify-between">
            <span>{metrics.activeCustomersCount} Customers</span>
            <span className="text-slate-400">·</span>
            <span>{metrics.completedLoansCount} Completed</span>
          </div>
        </div>
      </div>

      {/* TWO COLUMN WORKSPACE: Tuesday Overdue List + Upcoming Sunday Dues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Tuesday Overdue & Penalty Tracker */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {t.nav.overdue} ({overdueDues.length})
              </h2>
            </div>
            <button
              onClick={() => onNavigate('overdue')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>{t.common.viewDetails}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-5 flex-1">
            {overdueDues.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p>{lang === 'ta' ? 'தற்போது செவ்வாய் பாக்கிகள் ஏதுமில்லை' : 'No overdue Tuesday dues currently.'}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {overdueDues.map(due => {
                  const customer = customerMap.get(due.customerId);
                  const loan = loanMap.get(due.loanId);
                  const remPrincipal = due.scheduledPrincipalPaise - due.paidPrincipalPaise;

                  return (
                    <div key={due.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {customer ? customer.fullName : 'Customer'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {loan ? loan.loanCode : ''} · Week {due.weekNumber} · Due {due.dueDate}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-semibold text-slate-900 tabular-nums">
                          {formatINR(remPrincipal)}
                        </div>
                        <div className="text-[11px] text-amber-700 font-mono">
                          +{formatINR(due.penaltyAssessedPaise)} Penalty
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-3 bg-amber-50/50 border-t border-amber-100/60 text-[11px] text-amber-900 flex items-center justify-between">
            <span>
              {lang === 'ta'
                ? 'செவ்வாய் அன்று ஒரு முறை மட்டுமே ₹150 அபராதம் விதிக்கப்படும்'
                : '₹150 penalty assessed once per eligible weekly due on Tuesday.'}
            </span>
            <button
              onClick={onRunTuesdayCheck}
              className="font-semibold underline hover:text-amber-950"
            >
              {lang === 'ta' ? 'மறுமதிப்பீடு' : 'Evaluate Now'}
            </button>
          </div>
        </div>

        {/* Column 2: Upcoming Sunday Dues & WhatsApp Reminder Engine */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {lang === 'ta' ? 'வரவிருக்கும் ஞாயிறு தவணைகள்' : 'Upcoming Sunday Dues'}
              </h2>
            </div>
            <button
              onClick={() => onNavigate('loans')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>{t.common.viewDetails}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-5 flex-1">
            {upcomingSundayDues.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p>{lang === 'ta' ? 'அனைத்து தவணைகளும் வசூலிக்கப்பட்டுவிட்டன' : 'All scheduled dues are fully settled.'}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcomingSundayDues.map(due => {
                  const customer = customerMap.get(due.customerId);
                  const loan = loanMap.get(due.loanId);
                  const rem = due.scheduledPrincipalPaise - due.paidPrincipalPaise;

                  return (
                    <div key={due.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {customer ? customer.fullName : 'Customer'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {loan ? loan.loanCode : ''} · Week {due.weekNumber} · Sunday {due.dueDate}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-semibold text-slate-900 tabular-nums">
                          {formatINR(rem)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {due.paymentStatus === 'partially_paid' ? (
                            <span className="text-amber-600 font-medium">{t.common.partiallyPaid}</span>
                          ) : (
                            <span>{t.common.unpaid}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {metrics.whatsappQueuedCount} {lang === 'ta' ? 'வாட்ஸ்அப் வரிசையில் உள்ளது' : 'messages in WhatsApp outbox queue'}
              </span>
            </div>
            <button
              onClick={onProcessQueue}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              {lang === 'ta' ? 'செய்திகளை அனுப்புக' : 'Process Queue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
