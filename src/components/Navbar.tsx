/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SupportedLanguage, BusinessSettings } from '../lib/types';
import { translations } from '../lib/i18n';
import {
  Shield,
  Languages,
  PlusCircle,
  Clock,
  Menu,
  Sparkles,
  Wind,
  Moon,
  Sun,
  Flame,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { SmokeDensity, AppThemeMode } from './DarkSmokeBackground';

interface NavbarProps {
  settings: BusinessSettings;
  lang: SupportedLanguage;
  setLang: (lang: SupportedLanguage) => void;
  activeView: string;
  setActiveView: (view: string) => void;
  onOpenRecordPayment: () => void;
  onOpenCreateLoan: () => void;
  toggleMobileMenu: () => void;
  themeMode: AppThemeMode;
  setThemeMode: (val: AppThemeMode) => void;
  smokeDensity: SmokeDensity;
  setSmokeDensity: (val: SmokeDensity) => void;
  runningBordersEnabled: boolean;
  setRunningBordersEnabled: (val: boolean) => void;
  onOpenResetData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  lang,
  setLang,
  activeView,
  setActiveView,
  onOpenRecordPayment,
  toggleMobileMenu,
  themeMode,
  setThemeMode,
  smokeDensity,
  setSmokeDensity,
  runningBordersEnabled,
  setRunningBordersEnabled,
  onOpenResetData,
}) => {
  const t = translations[lang];

  // Current IST time formatting
  const [istTime, setIstTime] = React.useState('');

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setIstTime(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const businessDisplayName = lang === 'ta'
    ? (settings.businessNameTa || settings.businessName)
    : settings.businessName;

  const initials = settings.businessName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('') || 'SM';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="flex items-center justify-between gap-4 md:gap-8 px-4 md:px-8 py-3.5 max-w-7xl mx-auto">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            aria-label="Toggle navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveView('dashboard')}
            className="flex items-center gap-2.5 text-left focus:outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs font-mono">
              {initials}
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap block leading-tight">
                {businessDisplayName}
              </span>
              <span className="text-[11px] text-slate-500 whitespace-nowrap hidden sm:block">
                {lang === 'ta' ? 'வாராந்திர கடன் மேலாண்மை' : 'Weekly Loan Management · India'}
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: Navigation Links (Clean, unboxed, hover underline) */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-slate-600">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'dashboard' ? 'text-emerald-700 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            {t.nav.dashboard}
          </button>
          <button
            onClick={() => setActiveView('customers')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'customers' ? 'text-emerald-700 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            {t.nav.customers}
          </button>
          <button
            onClick={() => setActiveView('loans')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'loans' ? 'text-emerald-700 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            {t.nav.loans}
          </button>
          <button
            onClick={() => setActiveView('overdue')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'overdue' ? 'text-red-700 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            {t.nav.overdue}
          </button>
          <button
            onClick={() => setActiveView('reports')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'reports' ? 'text-emerald-700 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            {t.nav.reports}
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action + Utility controls */}
        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
          {/* Timezone & Clock (Asia/Kolkata) */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-mono tabular-nums bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>IST {istTime}</span>
          </div>

          {/* Bilingual Language Switcher */}
          <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            <button
              onClick={() => setLang('en')}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                lang === 'en'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('ta')}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                lang === 'ta'
                  ? 'bg-white text-emerald-800 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              தமிழ்
            </button>
          </div>

          {/* Theme Selector: Light, Dark Smoke, Neon Cyber */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700/60 p-0.5 bg-slate-50 dark:bg-slate-800/80">
            {/* Light */}
            <button
              onClick={() => setThemeMode('light')}
              title={lang === 'ta' ? 'வெளிச்சத் தோற்றம் (Light Theme)' : 'Classic Light Theme'}
              className={`p-1.5 sm:px-2 sm:py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                themeMode === 'light'
                  ? 'bg-white text-amber-600 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px] font-mono">Light</span>
            </button>

            {/* Dark Smoke */}
            <button
              onClick={() => setThemeMode('dark')}
              title={lang === 'ta' ? 'டார்க் ஸ்மோக் அனிமேஷன் (Dark Smoke Mode)' : 'Dark Smoke Atmosphere'}
              className={`p-1.5 sm:px-2 sm:py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                themeMode === 'dark'
                  ? 'bg-slate-900 text-emerald-400 shadow-xs font-semibold border border-emerald-500/30'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline text-[11px] font-mono">Smoke</span>
            </button>

            {/* Neon Cyber */}
            <button
              onClick={() => setThemeMode('neon')}
              title={lang === 'ta' ? 'நியோன் சைபர்பங்க் தோற்றம் (Neon Theme)' : 'High-Voltage Neon Theme'}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                themeMode === 'neon'
                  ? 'bg-slate-950 text-cyan-400 shadow-xs ring-1 ring-cyan-400 font-bold border border-cyan-400/50'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">Neon</span>
            </button>
          </div>

          {/* Running Border Glow Toggle */}
          <button
            onClick={() => setRunningBordersEnabled(!runningBordersEnabled)}
            title={
              lang === 'ta'
                ? runningBordersEnabled
                  ? 'ஒளிரும் பார்டர் அனிமேஷன் இயக்கத்தில் உள்ளது (நிறுத்த கிளிக் செய்யவும்)'
                  : 'ஒளிரும் பார்டர் அனிமேஷனை இயக்க கிளிக் செய்யவும்'
                : runningBordersEnabled
                ? 'Glow Running Border Animation is ACTIVE (Click to disable)'
                : 'Enable Running Glow Border Animation'
            }
            className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              runningBordersEnabled
                ? 'border-cyan-400/60 bg-cyan-950/40 text-cyan-300 shadow-xs shadow-cyan-500/20 animate-neon-running-glow'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${runningBordersEnabled ? 'text-cyan-400 animate-spin-slow' : 'text-slate-400'}`} />
            <span className="font-mono text-[11px]">
              {runningBordersEnabled ? (lang === 'ta' ? 'பார்டர் க்ளோ' : 'Glow On') : (lang === 'ta' ? 'க்ளோ ஆஃப்' : 'Glow Off')}
            </span>
          </button>

          {/* Reset All Data Button */}
          <button
            onClick={onOpenResetData}
            title={
              lang === 'ta'
                ? 'அனைத்து தரவுகளையும் மீட்டமைக்க (Reset All Data)'
                : 'Reset All System Data (Restore Demo or Blank Slate)'
            }
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-300/60 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 text-xs font-semibold transition-all shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            <span className="hidden sm:inline font-mono text-[11px]">
              {lang === 'ta' ? 'மீட்டமைக்க' : 'Reset Data'}
            </span>
          </button>

          {/* Primary Action CTA with running border support */}
          <div className={runningBordersEnabled ? 'relative p-[1px] rounded-lg overflow-hidden' : ''}>
            {runningBordersEnabled && (
              <div className="absolute inset-[-100%] pointer-events-none animate-border-beam-spin duration-3000 bg-[conic-gradient(from_0deg,transparent_0_60%,#00f0ff_80%,#10b981_95%,transparent_100%)]" />
            )}
            <button
              onClick={onOpenRecordPayment}
              className="relative z-10 flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 rounded-lg transition-colors shadow-xs whitespace-nowrap shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t.nav.recordPayment}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
