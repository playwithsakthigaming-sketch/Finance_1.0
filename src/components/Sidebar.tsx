/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SupportedLanguage, BusinessSettings } from '../lib/types';
import { translations } from '../lib/i18n';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  PlusCircle,
  History,
  AlertTriangle,
  ReceiptText,
  Send,
  BarChart3,
  CalendarClock,
  FlaskConical,
  Settings,
  X,
} from 'lucide-react';

interface SidebarProps {
  settings: BusinessSettings;
  lang: SupportedLanguage;
  activeView: string;
  setActiveView: (view: string) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  overdueCount: number;
  outboxQueuedCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  settings,
  lang,
  activeView,
  setActiveView,
  mobileMenuOpen,
  setMobileMenuOpen,
  overdueCount,
  outboxQueuedCount,
}) => {
  const t = translations[lang];

  const navItems = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'customers', label: t.nav.customers, icon: Users },
    { id: 'loans', label: t.nav.loans, icon: CreditCard },
    { id: 'payments', label: t.nav.payments, icon: History },
    {
      id: 'overdue',
      label: t.nav.overdue,
      icon: AlertTriangle,
      badge: overdueCount > 0 ? String(overdueCount) : undefined,
      badgeColor: 'bg-red-100 text-red-700',
    },
    { id: 'penalties', label: t.nav.penalties, icon: ReceiptText },
    {
      id: 'whatsapp',
      label: t.nav.whatsapp,
      icon: Send,
      badge: outboxQueuedCount > 0 ? String(outboxQueuedCount) : undefined,
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    { id: 'reports', label: t.nav.reports, icon: BarChart3 },
    { id: 'scheduler', label: t.nav.scheduler, icon: CalendarClock },
    { id: 'test-suite', label: t.nav.testSuite, icon: FlaskConical },
    { id: 'settings', label: t.nav.settings, icon: Settings },
  ];

  const handleSelect = (id: string) => {
    setActiveView(id);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 md:top-[61px] left-0 z-40 h-full md:h-[calc(100vh-61px)] w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 space-y-6 overflow-y-auto">
          {/* Mobile Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 md:hidden">
            <span className="font-bold text-sm text-slate-800">
              {lang === 'ta' ? 'மெனு வழிசெலுத்தல்' : 'Navigation Menu'}
            </span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded text-slate-500 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-semibold ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="text-[11px] text-slate-500 space-y-0.5">
            <div className="font-semibold text-slate-800 truncate">
              {lang === 'ta' ? (settings.businessNameTa || settings.businessName) : settings.businessName}
            </div>
            <div className="truncate text-slate-500 text-[11px]">{settings.businessAddress}</div>
            <div className="text-[10px] text-slate-400 font-mono">Asia/Kolkata · INR Ledger</div>
          </div>
        </div>
      </aside>
    </>
  );
};
