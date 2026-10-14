/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SupportedLanguage } from '../lib/types';
import { StorageService } from '../lib/storage';
import {
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Database,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';

interface ResetDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: SupportedLanguage;
  onResetComplete: () => void;
}

export const ResetDataModal: React.FC<ResetDataModalProps> = ({
  isOpen,
  onClose,
  lang,
  onResetComplete,
}) => {
  const [resetMode, setResetMode] = useState<'demo' | 'blank'>('demo');
  const [keepSettings, setKeepSettings] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const storage = StorageService.getInstance();
  const currentCustomersCount = storage.getCustomers().length;
  const currentLoansCount = storage.getLoans().length;
  const currentPaymentsCount = storage.getPayments().length;

  const handleExecuteReset = async () => {
    setIsProcessing(true);
    await new Promise((r) => setTimeout(r, 600)); // Smooth tactile feel

    try {
      if (resetMode === 'demo') {
        storage.resetToFactory();
      } else {
        storage.clearAllData(keepSettings);
      }
      setIsSuccess(true);
      setTimeout(() => {
        setIsProcessing(false);
        setIsSuccess(false);
        setConfirmText('');
        onResetComplete();
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to reset data:', err);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-page-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glowing running accent bar on top */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 animate-pulse" />

        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-200 dark:border-red-900/50 shadow-xs">
              <RotateCcw className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {lang === 'ta' ? 'அனைத்து தரவுகளையும் மீட்டமைக்க' : 'Reset All System Data'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'ta'
                  ? 'கடன், வாடிக்கையாளர்கள் மற்றும் பரிவர்த்தனைகளை மீட்டமைத்தல்'
                  : 'Restore factory sample scenario or wipe clean to a blank slate'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Current State Info */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              {lang === 'ta' ? 'தற்போதைய சேமிப்பு நிலை:' : 'Current Database Records:'}
            </span>
            <div className="flex items-center gap-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
              <span>{currentCustomersCount} {lang === 'ta' ? 'வாடிக்கையாளர்' : 'Customers'}</span>
              <span>•</span>
              <span>{currentLoansCount} {lang === 'ta' ? 'கடன்' : 'Loans'}</span>
              <span>•</span>
              <span>{currentPaymentsCount} {lang === 'ta' ? 'ரசீதுகள்' : 'Payments'}</span>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              {lang === 'ta' ? 'மீட்டமைக்கும் வகையைத் தேர்ந்தெடுக்கவும்:' : 'Choose Reset Type:'}
            </label>

            {/* Option 1: Demo Sample */}
            <div
              onClick={() => setResetMode('demo')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                resetMode === 'demo'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs ring-1 ring-emerald-500'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="resetMode"
                  checked={resetMode === 'demo'}
                  onChange={() => setResetMode('demo')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white">
                      {lang === 'ta'
                        ? '1. மாதிரி தரவுகளுடன் மீட்டமைக்க (Recommended Demo)'
                        : '1. Reset to Standard ₹10,000 Demo Data'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                      Standard
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {lang === 'ta'
                      ? 'ஸ்ரீ முருகன் பைனான்ஸ் மாதிரி வாடிக்கையாளர் (ராமசாமி), ₹10,000 கடன், 1-3 வார கட்டணங்கள், செவ்வாய்க்கிழமை அபராதம் மற்றும் வாட்ஸ்அப் ரசீதுகளுடன் மீண்டும் நிரப்பப்படும்.'
                      : 'Restores the realistic Salem Finance test scenario with K. Ramasamy, ₹10,000 loan, 1-3 week payments, overdue Tuesday penalty, and receipts.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Option 2: Blank Slate */}
            <div
              onClick={() => setResetMode('blank')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                resetMode === 'blank'
                  ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 shadow-xs ring-1 ring-red-500'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="resetMode"
                  checked={resetMode === 'blank'}
                  onChange={() => setResetMode('blank')}
                  className="mt-1 text-red-600 focus:ring-red-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white">
                      {lang === 'ta'
                        ? '2. முழு தரவையும் அழிக்க - வெற்று நிலை (Clean Blank Slate)'
                        : '2. Wipe All Data to Blank Slate (Fresh Start)'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
                      Empty
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {lang === 'ta'
                      ? 'அனைத்து வாடிக்கையாளர்கள், கடன்கள், தவணைகள் மற்றும் கட்டணப் பதிவுகள் முற்றிலும் அழிக்கப்பட்டு 0 ஆக மாறும். உங்கள் சொந்த நிதி நிறுவனத்திற்கான புதிய தரவை உள்ளிட தயார் செய்யும்.'
                      : 'Erases all customers, loans, dues, and receipts to 0 records. Perfect for entering your actual business data from scratch.'}
                  </p>

                  {resetMode === 'blank' && (
                    <label className="flex items-center gap-2 mt-2 pt-2 border-t border-red-200 dark:border-red-900/40 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={keepSettings}
                        onChange={(e) => setKeepSettings(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-[11px] text-slate-700 dark:text-slate-300">
                        {lang === 'ta'
                          ? 'நிறுவன பெயர் மற்றும் வாட்ஸ்அப் டோக்கன் அமைப்புகளை மட்டும் தக்கவைக்கவும்'
                          : 'Preserve Business Name & WhatsApp API Token Settings'}
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Safety Notice */}
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              {lang === 'ta'
                ? 'கவனம்: இந்த செயல்பாடு பிரவுசரின் உள்ளூர் சேமிப்பகத்தில் உள்ள பழைய பதிவுகளை மாற்றி அமைக்கும். இந்த மாற்றத்தை திரும்பப் பெற முடியாது.'
                : 'Note: This operation modifies browser local storage immediately. Running this action cannot be undone.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
          >
            {lang === 'ta' ? 'ரத்து செய்க' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleExecuteReset}
            disabled={isProcessing}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition-all ${
              resetMode === 'blank'
                ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
            } ${isProcessing ? 'opacity-80 cursor-wait' : ''}`}
          >
            {isProcessing ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>{lang === 'ta' ? 'மீட்டமைக்கப்படுகிறது...' : 'Resetting Database...'}</span>
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>{lang === 'ta' ? 'வெற்றிகரமாக மீட்டமைக்கப்பட்டது!' : 'Reset Successful!'}</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>
                  {resetMode === 'blank'
                    ? lang === 'ta'
                      ? 'முழு தரவையும் அழிக்க உறுதிசெய்'
                      : 'Confirm Wipe All Data'
                    : lang === 'ta'
                    ? 'மாதிரி தரவுகளுடன் மீட்டமைக்க'
                    : 'Confirm Reset to Demo Defaults'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
