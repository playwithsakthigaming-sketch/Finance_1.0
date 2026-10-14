/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  SupportedLanguage,
  BusinessSettings,
  Customer,
  Loan,
  WeeklyDue,
  Payment,
  PenaltyLedgerEntry,
  Receipt,
  OutboxMessage,
  DashboardMetrics,
} from './lib/types';
import { StorageService } from './lib/storage';
import { evaluateTuesdayPenalties, formatDateISO } from './lib/financialEngine';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { CustomersView } from './components/CustomersView';
import { LoansView } from './components/LoansView';
import { PaymentsView } from './components/PaymentsView';
import { OverduePenaltiesView } from './components/OverduePenaltiesView';
import { WhatsAppQueueView } from './components/WhatsAppQueueView';
import { ReportsView } from './components/ReportsView';
import { SchedulerView } from './components/SchedulerView';
import { TestSuiteView } from './components/TestSuiteView';
import { SettingsView } from './components/SettingsView';
import { RecordPaymentModal } from './components/RecordPaymentModal';
import { ReceiptModal } from './components/ReceiptModal';
import { DarkSmokeBackground, SmokeDensity, AppThemeMode } from './components/DarkSmokeBackground';
import { ResetDataModal } from './components/ResetDataModal';

export default function App() {
  const storage = StorageService.getInstance();

  const [lang, setLang] = useState<SupportedLanguage>('en');
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Theme Mode: 'light' | 'dark' | 'neon' (Defaults to 'neon' as requested!)
  const [themeMode, setThemeMode] = useState<AppThemeMode>(() => {
    const saved = localStorage.getItem('app_theme_mode') as AppThemeMode;
    if (saved && ['light', 'dark', 'neon'].includes(saved)) return saved;
    const oldDm = localStorage.getItem('app_dark_mode');
    if (oldDm === 'false') return 'light';
    return 'neon';
  });

  // Running Glow Border Animation State
  const [runningBordersEnabled, setRunningBordersEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('app_running_borders');
    return saved !== null ? saved === 'true' : true;
  });

  const [smokeDensity, setSmokeDensity] = useState<SmokeDensity>(() => {
    return (localStorage.getItem('app_smoke_density') as SmokeDensity) || 'medium';
  });

  const [isResetDataModalOpen, setIsResetDataModalOpen] = useState(false);

  const isDarkMode = themeMode !== 'light';

  useEffect(() => {
    localStorage.setItem('app_theme_mode', themeMode);
    localStorage.setItem('app_dark_mode', String(themeMode !== 'light'));
    const root = document.documentElement;
    if (themeMode === 'light') {
      root.classList.remove('dark');
      root.classList.remove('neon-theme');
    } else if (themeMode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('neon-theme');
    } else if (themeMode === 'neon') {
      root.classList.add('dark');
      root.classList.add('neon-theme');
    }
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem('app_running_borders', String(runningBordersEnabled));
  }, [runningBordersEnabled]);

  useEffect(() => {
    localStorage.setItem('app_smoke_density', smokeDensity);
  }, [smokeDensity]);

  useEffect(() => {
    const handleStorageChange = () => {
      const tm = localStorage.getItem('app_theme_mode') as AppThemeMode;
      if (tm && ['light', 'dark', 'neon'].includes(tm)) setThemeMode(tm);
      const rb = localStorage.getItem('app_running_borders');
      if (rb !== null) setRunningBordersEnabled(rb === 'true');
      const sd = localStorage.getItem('app_smoke_density') as SmokeDensity;
      if (sd) setSmokeDensity(sd);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Core Data States
  const [settings, setSettings] = useState<BusinessSettings>(storage.getSettings());
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [dues, setDues] = useState<WeeklyDue[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [penalties, setPenalties] = useState<PenaltyLedgerEntry[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [outbox, setOutbox] = useState<OutboxMessage[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  // Modals
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [recordPaymentLoanId, setRecordPaymentLoanId] = useState<string | undefined>(undefined);
  const [recordPaymentDueId, setRecordPaymentDueId] = useState<string | undefined>(undefined);

  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isCreateLoanOpenInitially, setIsCreateLoanOpenInitially] = useState(false);

  const refreshData = (updatedSettings?: BusinessSettings) => {
    if (updatedSettings) {
      setSettings(updatedSettings);
    } else {
      setSettings(storage.getSettings());
    }
    setCustomers(storage.getCustomers());
    setLoans(storage.getLoans());
    setDues(storage.getWeeklyDues());
    setPayments(storage.getPayments());
    setPenalties(storage.getPenalties());
    setReceipts(storage.getReceipts());
    setOutbox(storage.getOutbox());
    setMetrics(storage.getDashboardMetrics());
  };

  useEffect(() => {
    refreshData();
    // Two-way robust settings sync:
    // Safely merge server disk settings and client localStorage settings
    // NEVER allow empty server strings to overwrite filled client credentials
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        const local = storage.getSettings();
        if (data?.settings) {
          const merged: BusinessSettings = {
            ...data.settings,
            ...local,
            // Preserve tokens from whichever side has non-empty values
            whatsappAccessToken: data.settings.whatsappAccessToken || local.whatsappAccessToken || '',
            whatsappPhoneNumberId: data.settings.whatsappPhoneNumberId || local.whatsappPhoneNumberId || '',
            whatsappBusinessAccountId: data.settings.whatsappBusinessAccountId || local.whatsappBusinessAccountId || '',
          };

          storage.saveSettings(merged);
          setSettings(merged);

          // If local had tokens or business settings that disk was missing, sync up to server
          if (
            (local.whatsappAccessToken && !data.settings.whatsappAccessToken) ||
            (local.whatsappPhoneNumberId && !data.settings.whatsappPhoneNumberId)
          ) {
            fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(merged),
            }).catch(() => {});
          }
        }
      })
      .catch(err => console.warn('Could not sync initial settings from server:', err));
  }, []);

  const handleOpenRecordPayment = (loanId?: string, dueId?: string) => {
    setRecordPaymentLoanId(loanId);
    setRecordPaymentDueId(dueId);
    setIsRecordPaymentOpen(true);
  };

  const handlePaymentSuccess = (receipt: Receipt) => {
    refreshData();
    setActiveReceipt(receipt);
  };

  const handleSendWhatsAppReceipt = async (receipt: Receipt) => {
    setIsSendingWhatsApp(true);
    try {
      const customer = customers.find(c => c.id === receipt.customerId);
      const recipientPhone = customer ? customer.whatsappNumber : receipt.customerMobile;

      const businessHeader = lang === 'ta'
        ? `${settings.businessNameTa || settings.businessName} (${settings.businessName})`
        : settings.businessName;

      const renderedText = `கட்டண ரசீது / PAYMENT RECEIPT
${businessHeader}
----------------------------------------
ரசீது எண் (Receipt No): ${receipt.receiptNumber}
வாடிக்கையாளர்: ${receipt.customerName}
கடன் எண்: ${receipt.loanCode}
செலுத்திய தொகை: ₹${(receipt.amountPaidPaise / 100).toLocaleString('en-IN')}
செலுத்திய முறை: ${receipt.paymentMethod.toUpperCase()}
மீதமுள்ள நிலுவைத் தொகை: ₹${(receipt.totalBalanceRemainingPaise / 100).toLocaleString('en-IN')}

தங்கள் பணம் வெற்றிகரமாக வரவு வைக்கப்பட்டது. நன்றி!`;

      const activeSettings = storage.getSettings();
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone,
          text: renderedText,
          messageType: 'payment_receipt',
          accessToken: activeSettings.whatsappAccessToken,
          phoneNumberId: activeSettings.whatsappPhoneNumberId,
        }),
      });

      const data = await response.json();
      const now = new Date().toISOString();
      const outboxMsg: OutboxMessage = {
        id: `msg_rcpt_${receipt.receiptNumber}_${Date.now()}`,
        idempotencyKey: `rcpt_${receipt.receiptNumber}`,
        customerId: receipt.customerId,
        customerName: receipt.customerName,
        recipientPhone,
        messageType: 'payment_receipt',
        language: lang,
        templateName: 'payment_receipt_v1',
        renderedText,
        status: data.success ? 'delivered' : 'failed',
        attemptCount: 1,
        maxAttempts: 3,
        whatsappMessageId: data.whatsappMessageId,
        lastError: data.diagnostics ? `${data.diagnostics.userMessage} - ${data.diagnostics.advice}` : data.error,
        scheduledFor: now,
        sentAt: data.success ? now : undefined,
        deliveredAt: data.success ? now : undefined,
        createdAt: now,
        updatedAt: now,
      };
      storage.saveOutbox([outboxMsg, ...storage.getOutbox()]);

      return data;
    } catch (err: any) {
      console.error('Error sending WhatsApp receipt:', err);
      return { success: false, error: err.message };
    } finally {
      setIsSendingWhatsApp(false);
      refreshData();
    }
  };

  const handleRunTuesdayCheck = () => {
    const todayStr = formatDateISO(new Date());
    const activeLoans = storage.getLoans().filter(l => l.status === 'active');
    const allCustomers = storage.getCustomers();
    const allDues = storage.getWeeklyDues();
    const allPenalties = storage.getPenalties();

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
      alert(
        lang === 'ta'
          ? `செவ்வாய் பாக்கி மதிப்பீடு: ${result.assessedCount} புதிய ₹150 அபராதங்கள் விதிக்கப்பட்டு வாட்ஸ்அப் எச்சரிக்கைகள் வரிசைப்படுத்தப்பட்டன.`
          : `Tuesday Evaluation: Assessed ${result.assessedCount} new ₹150 penalties and queued overdue WhatsApp alerts.`
      );
    } else {
      alert(
        lang === 'ta'
          ? 'புதிய அபராதங்கள் எதுவும் இல்லை (அனைத்து தவணைகளும் செலுத்தப்பட்டுவிட்டன அல்லது ஏற்கனவே அபராதம் விதிக்கப்பட்டுவிட்டது).'
          : 'Zero new penalties assessed. All due records are either fully paid or already assessed.'
      );
    }
    refreshData();
  };

  const handleProcessQueue = async () => {
    setActiveView('whatsapp');
  };

  const overdueCount = dues.filter(d => d.isOverdue && d.paymentStatus !== 'paid').length;
  const outboxQueuedCount = outbox.filter(m => m.status === 'queued' || m.status === 'processing').length;

  return (
    <div
      className={`min-h-screen relative flex flex-col font-sans transition-colors duration-500 ${
        themeMode === 'neon'
          ? 'neon-theme dark bg-[#020409] text-slate-100'
          : themeMode === 'dark'
          ? 'dark bg-[#060911] text-slate-100'
          : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Dynamic Animated Dark Smoke / Neon Canvas Background */}
      <DarkSmokeBackground
        isDarkMode={isDarkMode}
        themeMode={themeMode}
        density={smokeDensity}
        interactive={true}
      />

      {/* Top Navbar Contract */}
      <Navbar
        settings={settings}
        lang={lang}
        setLang={setLang}
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenRecordPayment={() => handleOpenRecordPayment()}
        onOpenCreateLoan={() => {
          setIsCreateLoanOpenInitially(true);
          setActiveView('loans');
        }}
        toggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        smokeDensity={smokeDensity}
        setSmokeDensity={setSmokeDensity}
        runningBordersEnabled={runningBordersEnabled}
        setRunningBordersEnabled={setRunningBordersEnabled}
        onOpenResetData={() => setIsResetDataModalOpen(true)}
      />

      {/* Main Content Workspace Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto relative z-10">
        {/* Sidebar Navigation */}
        <Sidebar
          settings={settings}
          lang={lang}
          activeView={activeView}
          setActiveView={setActiveView}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          overdueCount={overdueCount}
          outboxQueuedCount={outboxQueuedCount}
        />

        {/* Viewport Content Area with Page Transition Animation */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-5xl">
          <div key={activeView} className="animate-page-enter w-full">
          {activeView === 'dashboard' && metrics && (
            <DashboardView
              metrics={metrics}
              dues={dues}
              loans={loans}
              customers={customers}
              settings={settings}
              lang={lang}
              onOpenRecordPayment={() => handleOpenRecordPayment()}
              onOpenCreateLoan={() => {
                setIsCreateLoanOpenInitially(true);
                setActiveView('loans');
              }}
              onNavigate={setActiveView}
              onRunTuesdayCheck={handleRunTuesdayCheck}
              onProcessQueue={handleProcessQueue}
            />
          )}

          {activeView === 'customers' && (
            <CustomersView
              customers={customers}
              loans={loans}
              dues={dues}
              payments={payments}
              penalties={penalties}
              receipts={receipts}
              lang={lang}
              onRefresh={refreshData}
              onSelectCustomerLoan={loanId => {
                setActiveView('loans');
              }}
              onOpenRecordPaymentWithCustomer={loanId => handleOpenRecordPayment(loanId)}
            />
          )}

          {activeView === 'loans' && (
            <LoansView
              loans={loans}
              customers={customers}
              dues={dues}
              penalties={penalties}
              settings={settings}
              lang={lang}
              onRefresh={refreshData}
              onOpenRecordPayment={(loanId, dueId) => handleOpenRecordPayment(loanId, dueId)}
              isCreateOpenInitially={isCreateLoanOpenInitially}
            />
          )}

          {activeView === 'payments' && (
            <PaymentsView
              payments={payments}
              receipts={receipts}
              dues={dues}
              penalties={penalties}
              lang={lang}
              onRefresh={refreshData}
              onViewReceipt={receipt => setActiveReceipt(receipt)}
              onOpenRecordPayment={() => handleOpenRecordPayment()}
            />
          )}

          {(activeView === 'overdue' || activeView === 'penalties') && (
            <OverduePenaltiesView
              dues={dues}
              penalties={penalties}
              loans={loans}
              customers={customers}
              lang={lang}
              onRefresh={refreshData}
              onOpenRecordPayment={(loanId, dueId) => handleOpenRecordPayment(loanId, dueId)}
            />
          )}

          {activeView === 'whatsapp' && (
            <WhatsAppQueueView
              outbox={outbox}
              lang={lang}
              onRefresh={refreshData}
            />
          )}

          {activeView === 'reports' && (
            <ReportsView
              payments={payments}
              loans={loans}
              customers={customers}
              dues={dues}
              penalties={penalties}
              receipts={receipts}
              lang={lang}
            />
          )}

          {activeView === 'scheduler' && (
            <SchedulerView
              lang={lang}
              onRefresh={refreshData}
            />
          )}

          {activeView === 'test-suite' && (
            <TestSuiteView lang={lang} />
          )}

          {activeView === 'settings' && (
            <SettingsView
              settings={settings}
              lang={lang}
              onRefresh={refreshData}
              themeMode={themeMode}
              setThemeMode={setThemeMode}
              runningBordersEnabled={runningBordersEnabled}
              setRunningBordersEnabled={setRunningBordersEnabled}
              onOpenResetData={() => setIsResetDataModalOpen(true)}
            />
          )}
          </div>
        </main>
      </div>

      {/* Global Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        lang={lang}
        onPaymentSuccess={handlePaymentSuccess}
        initialLoanId={recordPaymentLoanId}
        initialDueId={recordPaymentDueId}
      />

      {/* Global Printable / Shareable Receipt Modal */}
      <ReceiptModal
        receipt={activeReceipt}
        settings={settings}
        onClose={() => setActiveReceipt(null)}
        lang={lang}
        onSendWhatsApp={handleSendWhatsAppReceipt}
        isSendingWhatsApp={isSendingWhatsApp}
      />

      {/* Global Reset All Data Confirmation Modal */}
      <ResetDataModal
        isOpen={isResetDataModalOpen}
        onClose={() => setIsResetDataModalOpen(false)}
        lang={lang}
        onResetComplete={() => refreshData()}
      />
    </div>
  );
}
