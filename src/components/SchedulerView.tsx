/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SupportedLanguage } from '../lib/types';
import { translations } from '../lib/i18n';
import { StorageService } from '../lib/storage';
import { evaluateTuesdayPenalties, formatDateISO } from '../lib/financialEngine';
import { buildSundayReminderText } from '../lib/whatsappService';
import {
  CalendarClock,
  Play,
  CheckCircle,
  Clock,
  AlertTriangle,
  RotateCw,
  Terminal,
} from 'lucide-react';

interface SchedulerViewProps {
  lang: SupportedLanguage;
  onRefresh: () => void;
}

export const SchedulerView: React.FC<SchedulerViewProps> = ({ lang, onRefresh }) => {
  const t = translations[lang];
  const storage = StorageService.getInstance();
  const settings = storage.getSettings();

  const [jobLogs, setJobLogs] = useState<
    Array<{ id: string; name: string; timestamp: string; status: 'success' | 'warning' | 'error'; message: string }>
  >([
    {
      id: 'log_01',
      name: 'Sunday Due Reminders Job',
      timestamp: '2026-10-11 09:00:00 IST',
      status: 'success',
      message: 'Scanned 10 active dues; queued reminders for unpaid customers with WhatsApp consent.',
    },
    {
      id: 'log_02',
      name: 'Tuesday Overdue Evaluation Rule',
      timestamp: '2026-10-13 10:00:00 IST',
      status: 'success',
      message: 'Evaluated Sunday unpaid dues. Assessed ₹150 penalty once for Week 4 due.',
    },
    {
      id: 'log_03',
      name: 'WhatsApp Queue Worker',
      timestamp: '2026-10-14 02:00:00 IST',
      status: 'success',
      message: 'Processed queued outbox entries with exponential backoff.',
    },
  ]);

  const [runningJob, setRunningJob] = useState<string | null>(null);

  // Trigger Sunday Reminders Job
  const triggerSundayReminders = () => {
    setRunningJob('sunday');
    const allDues = storage.getWeeklyDues();
    const allLoans = storage.getLoans();
    const allCustomers = storage.getCustomers();
    const outbox = storage.getOutbox();
    const now = new Date();
    const nowISO = now.toISOString();

    const customerMap = new Map(allCustomers.map(c => [c.id, c]));
    const loanMap = new Map(allLoans.map(l => [l.id, l]));

    let queuedCount = 0;
    const newMessages = [];

    // Find unpaid dues due on or before upcoming Sunday
    for (const due of allDues) {
      if (due.paymentStatus !== 'paid' && !due.remindersSuppressed) {
        const customer = customerMap.get(due.customerId);
        const loan = loanMap.get(due.loanId);

        if (customer && customer.whatsappConsent && loan && loan.status === 'active') {
          // Check if already queued for this week
          const existing = outbox.find(
            m => m.idempotencyKey === `sun_reminder_${due.id}` || (m.weeklyDueId === due.id && m.messageType === 'sunday_due_reminder')
          );

          if (!existing) {
            const dueAmount = due.scheduledPrincipalPaise - due.paidPrincipalPaise;
            const text = buildSundayReminderText({
              customerName: customer.fullName,
              businessName: settings.businessName,
              businessNameTa: settings.businessNameTa,
              loanCode: loan.loanCode,
              weekNumber: due.weekNumber,
              dueDate: due.dueDate,
              dueAmountPaise: dueAmount,
              outstandingPaise: loan.originalPrincipalPaise, // or loan balance
              lang,
            });

            newMessages.push({
              id: `msg_sun_${due.id}_${Date.now()}`,
              idempotencyKey: `sun_reminder_${due.id}`,
              customerId: customer.id,
              customerName: customer.fullName,
              recipientPhone: customer.whatsappNumber,
              loanId: loan.id,
              weeklyDueId: due.id,
              messageType: 'sunday_due_reminder' as const,
              language: lang,
              templateName: 'sunday_due_reminder_v1',
              renderedText: text,
              status: 'queued' as const,
              attemptCount: 0,
              maxAttempts: 3,
              scheduledFor: nowISO,
              createdAt: nowISO,
              updatedAt: nowISO,
            });
            queuedCount++;
          }
        }
      }
    }

    if (newMessages.length > 0) {
      storage.saveOutbox([...newMessages, ...outbox]);
    }

    const logEntry = {
      id: `log_${Date.now()}`,
      name: 'Sunday Due Reminders Job',
      timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST',
      status: 'success' as const,
      message: `Checked active loans. Queued ${queuedCount} Sunday reminders (suppressed all fully paid weeks).`,
    };

    setJobLogs([logEntry, ...jobLogs]);
    setRunningJob(null);
    onRefresh();
  };

  // Trigger Tuesday Overdue & Penalty Assessment Job
  const triggerTuesdayEvaluation = () => {
    setRunningJob('tuesday');
    const allDues = storage.getWeeklyDues();
    const activeLoans = storage.getLoans().filter(l => l.status === 'active');
    const allCustomers = storage.getCustomers();
    const allPenalties = storage.getPenalties();

    const todayStr = formatDateISO(new Date());

    const result = evaluateTuesdayPenalties({
      dues: allDues,
      loans: activeLoans,
      customers: allCustomers,
      existingPenalties: allPenalties,
      currentDateStr: todayStr,
    });

    if (result.assessedCount > 0) {
      const updatedDuesList = allDues.map(d => result.updatedDues.find(u => u.id === d.id) || d);
      storage.saveWeeklyDues(updatedDuesList);
      storage.savePenalties([...result.newPenaltyEntries, ...allPenalties]);
      if (result.queuedAlerts.length > 0) {
        const currentOutbox = storage.getOutbox();
        storage.saveOutbox([...result.queuedAlerts, ...currentOutbox]);
      }
    }

    const logEntry = {
      id: `log_${Date.now()}`,
      name: 'Tuesday Overdue Evaluation Rule',
      timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST',
      status: 'success' as const,
      message: `Assessed ${result.assessedCount} new penalties (₹${(result.assessedPaise / 100).toLocaleString('en-IN')}) and queued ${result.queuedAlerts.length} overdue alerts.`,
    };

    setJobLogs([logEntry, ...jobLogs]);
    setRunningJob(null);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 mb-1">
          <CalendarClock className="w-4 h-4" />
          <span>Asia/Kolkata Business Timezone Scheduler</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          {lang === 'ta' ? 'தானியங்கி வேலைகள் & அட்டவணை இயக்கி' : 'Automated Cron Jobs & Task Scheduler'}
        </h2>
        <p className="text-xs text-slate-600 mt-1 max-w-2xl">
          {lang === 'ta'
            ? 'ஞாயிறு காலை 9:00 மணி நினைவூட்டல், செவ்வாய் காலை 10:00 மணி பாக்கி மதிப்பீடு மற்றும் வாட்ஸ்அப் வரிசை இயக்கி.'
            : 'Scheduled background jobs executing at configured IST hours with idempotency guards and automatic reminder suppression.'}
        </p>
      </div>

      {/* Cron Jobs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Job 1: Sunday Due Reminder */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between space-y-4 shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">
                {t.cron.sundayJob}
              </span>
              <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                Every Sunday · 09:00 IST
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Iterates over all active loans. If Sunday repayment principal remains unpaid and customer has WhatsApp consent, dispatches due reminder. Suppressed if weekly due is already fully paid.
            </p>
          </div>

          <button
            onClick={triggerSundayReminders}
            disabled={runningJob === 'sunday'}
            className="flex items-center justify-center gap-2 py-2 px-4 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${runningJob === 'sunday' ? 'animate-spin' : ''}`} />
            <span>{runningJob === 'sunday' ? 'Executing Job...' : t.cron.simulateJob}</span>
          </button>
        </div>

        {/* Job 2: Tuesday Overdue & Penalty Check */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between space-y-4 shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">
                {t.cron.tuesdayJob}
              </span>
              <span className="text-[11px] font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                Every Tuesday · 10:00 IST
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Evaluates missed Sunday dues. If unpaid and no penalty was previously assessed for that due, assesses single ₹150 penalty and queues overdue WhatsApp alert.
            </p>
          </div>

          <button
            onClick={triggerTuesdayEvaluation}
            disabled={runningJob === 'tuesday'}
            className="flex items-center justify-center gap-2 py-2 px-4 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${runningJob === 'tuesday' ? 'animate-spin' : ''}`} />
            <span>{runningJob === 'tuesday' ? 'Executing Job...' : t.cron.simulateJob}</span>
          </button>
        </div>
      </div>

      {/* Execution Logs Terminal */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Terminal className="w-4 h-4 text-slate-500" />
            <span>Scheduler Execution Audit Trail</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">Asia/Kolkata</span>
        </div>

        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {jobLogs.map(log => (
            <div key={log.id} className="p-4 text-xs flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="font-semibold text-slate-900 flex items-center gap-2">
                  <span>{log.name}</span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold uppercase">
                    {log.status}
                  </span>
                </div>
                <p className="text-slate-600">{log.message}</p>
              </div>

              <div className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                {log.timestamp}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
