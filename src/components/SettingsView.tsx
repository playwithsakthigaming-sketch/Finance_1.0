/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BusinessSettings, SupportedLanguage, paiseToRupees, rupeesToPaise } from '../lib/types';
import { translations } from '../lib/i18n';
import { StorageService } from '../lib/storage';
import {
  Settings,
  Database,
  Send,
  Shield,
  Key,
  RotateCcw,
  CheckCircle,
  Copy,
  ExternalLink,
  Save,
  Building2,
  Phone,
  MapPin,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  MessageSquare,
  Smartphone,
  HelpCircle,
  Flame,
  Sparkles,
  Wind,
  Palette,
  Zap,
  Sun,
} from 'lucide-react';
import { SmokeDensity, AppThemeMode } from './DarkSmokeBackground';

interface SettingsViewProps {
  settings: BusinessSettings;
  lang: SupportedLanguage;
  onRefresh: (updatedSettings?: BusinessSettings) => void;
  themeMode?: AppThemeMode;
  setThemeMode?: (val: AppThemeMode) => void;
  runningBordersEnabled?: boolean;
  setRunningBordersEnabled?: (val: boolean) => void;
  onOpenResetData?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings: initialSettings,
  lang,
  onRefresh,
  themeMode: propThemeMode,
  setThemeMode: propSetThemeMode,
  runningBordersEnabled: propRunningBordersEnabled,
  setRunningBordersEnabled: propSetRunningBordersEnabled,
  onOpenResetData,
}) => {
  const t = translations[lang];
  const storage = StorageService.getInstance();

  const [formState, setFormState] = useState<BusinessSettings>(initialSettings);
  const [showToken, setShowToken] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync all states when initialSettings changes from parent
  useEffect(() => {
    setFormState(initialSettings);
    setDefaultPrincipalRupees(paiseToRupees(initialSettings.defaultPrincipalPaise || 1000000));
    setDefaultDeductionRupees(paiseToRupees(initialSettings.defaultDeductionPaise || 150000));
    setDefaultWeeklyDueRupees(paiseToRupees(initialSettings.defaultWeeklyPrincipalPaise || 100000));
    setDefaultPenaltyRupees(paiseToRupees(initialSettings.defaultPenaltyPaise || 10000));
  }, [initialSettings]);

  // Temporary rupee input states for integer paise loan defaults
  const [defaultPrincipalRupees, setDefaultPrincipalRupees] = useState<number>(
    paiseToRupees(initialSettings.defaultPrincipalPaise || 1000000)
  );
  const [defaultDeductionRupees, setDefaultDeductionRupees] = useState<number>(
    paiseToRupees(initialSettings.defaultDeductionPaise || 150000)
  );
  const [defaultWeeklyDueRupees, setDefaultWeeklyDueRupees] = useState<number>(
    paiseToRupees(initialSettings.defaultWeeklyPrincipalPaise || 100000)
  );
  const [defaultPenaltyRupees, setDefaultPenaltyRupees] = useState<number>(
    paiseToRupees(initialSettings.defaultPenaltyPaise || 10000)
  );

  // Theme & Atmosphere Visual Preferences
  const [localThemeMode, setLocalThemeMode] = useState<AppThemeMode>(() => {
    return propThemeMode || (localStorage.getItem('app_theme_mode') as AppThemeMode) || 'neon';
  });
  const [localRunningBorders, setLocalRunningBorders] = useState<boolean>(() => {
    return propRunningBordersEnabled !== undefined
      ? propRunningBordersEnabled
      : localStorage.getItem('app_running_borders') !== 'false';
  });
  const [localSmokeDensity, setLocalSmokeDensity] = useState<SmokeDensity>(() => {
    return (localStorage.getItem('app_smoke_density') as SmokeDensity) || 'medium';
  });

  const handleSelectThemeMode = (val: AppThemeMode) => {
    setLocalThemeMode(val);
    if (propSetThemeMode) propSetThemeMode(val);
    localStorage.setItem('app_theme_mode', val);
    localStorage.setItem('app_dark_mode', String(val !== 'light'));
    const root = document.documentElement;
    if (val === 'light') {
      root.classList.remove('dark', 'neon-theme');
    } else if (val === 'dark') {
      root.classList.add('dark');
      root.classList.remove('neon-theme');
    } else if (val === 'neon') {
      root.classList.add('dark', 'neon-theme');
    }
    window.dispatchEvent(new Event('storage'));
  };

  const handleToggleRunningBorders = (val: boolean) => {
    setLocalRunningBorders(val);
    if (propSetRunningBordersEnabled) propSetRunningBordersEnabled(val);
    localStorage.setItem('app_running_borders', String(val));
    window.dispatchEvent(new Event('storage'));
  };

  const handleSetSmokeDensity = (val: SmokeDensity) => {
    setLocalSmokeDensity(val);
    localStorage.setItem('app_smoke_density', val);
    window.dispatchEvent(new Event('storage'));
  };

  const handlePrincipalChange = (p: number) => {
    setDefaultPrincipalRupees(p);
    if (formState.defaultDurationWeeks > 0) {
      setDefaultWeeklyDueRupees(Math.round(p / formState.defaultDurationWeeks));
    }
    // Auto update penalty: 10,000 -> 100, 20,000 -> 200 (1% of principal)
    const autoPenalty = Math.max(50, Math.round(p / 100));
    setDefaultPenaltyRupees(autoPenalty);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const updated: BusinessSettings = {
      ...formState,
      defaultPrincipalPaise: rupeesToPaise(defaultPrincipalRupees),
      defaultDeductionPaise: rupeesToPaise(defaultDeductionRupees),
      defaultWeeklyPrincipalPaise: rupeesToPaise(defaultWeeklyDueRupees),
      defaultPenaltyPaise: rupeesToPaise(defaultPenaltyRupees),
    };

    // 1. Save in client storage (localStorage)
    storage.saveSettings(updated);

    // 2. Sync with server-side backend API (persisted to disk)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        console.log('[SettingsView] Successfully synced settings to server API');
      }
    } catch (err) {
      console.warn('Could not sync settings to server API:', err);
    }

    setFormState(updated);
    setSaveSuccess(true);
    setIsSaving(false);

    // Notify parent App component immediately to refresh all views, header, and calculations
    onRefresh(updated);

    setTimeout(() => {
      setSaveSuccess(false);
    }, 4000);
  };

  const handleTestWhatsAppConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/whatsapp/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: formState.whatsappAccessToken,
          phoneNumberId: formState.whatsappPhoneNumberId,
        }),
      });
      const data = await res.json();
      setTestResult(data);

      // If connected, automatically save credentials into local storage and notify app
      if (data.connected && formState.whatsappAccessToken && formState.whatsappPhoneNumberId) {
        const verifiedSettings = {
          ...formState,
          defaultPrincipalPaise: rupeesToPaise(defaultPrincipalRupees),
          defaultDeductionPaise: rupeesToPaise(defaultDeductionRupees),
          defaultWeeklyPrincipalPaise: rupeesToPaise(defaultWeeklyDueRupees),
          defaultPenaltyPaise: rupeesToPaise(defaultPenaltyRupees),
          senderStatus: 'connected' as const,
        };
        storage.saveSettings(verifiedSettings);
        onRefresh(verifiedSettings);
      }
    } catch (err: any) {
      setTestResult({ connected: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  // Live WhatsApp Test Dispatch State
  const [liveTestPhone, setLiveTestPhone] = useState(formState.businessPhone || '+91 ');
  const [liveTestMode, setLiveTestMode] = useState<'template' | 'text'>('template');
  const [liveTestCustomText, setLiveTestCustomText] = useState(
    lang === 'ta'
      ? `வணக்கம்! ${formState.businessNameTa || formState.businessName} வாட்ஸ்அப் இணைப்பு வெற்றிகரமாக செயல்படுகிறது.`
      : `Hello! ${formState.businessName} WhatsApp Cloud API test message received successfully.`
  );
  const [isSendingLiveTest, setIsSendingLiveTest] = useState(false);
  const [liveTestResult, setLiveTestResult] = useState<any>(null);

  const handleSendLiveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingLiveTest(true);
    setLiveTestResult(null);

    try {
      const res = await fetch('/api/whatsapp/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone: liveTestPhone,
          mode: liveTestMode,
          customText: liveTestCustomText,
          accessToken: formState.whatsappAccessToken,
          phoneNumberId: formState.whatsappPhoneNumberId,
        }),
      });

      const data = await res.json();
      setLiveTestResult(data);
    } catch (err: any) {
      setLiveTestResult({
        success: false,
        error: err.message || 'Network exception while connecting to server',
      });
    } finally {
      setIsSendingLiveTest(false);
    }
  };

  const handleResetFactory = () => {
    const msg =
      lang === 'ta'
        ? 'அனைத்து தரவுகளையும் ஆரம்ப இயல்புநிலை (₹10,000 மாதிரி கடன்) அளவிற்கு மீட்டமைக்க விரும்புகிறீர்களா?'
        : 'Reset all data back to factory defaults (₹10,000 standard loan example)?';
    if (window.confirm(msg)) {
      storage.resetToFactory();
      const freshSettings = storage.getSettings();
      setFormState(freshSettings);
      setDefaultPrincipalRupees(paiseToRupees(freshSettings.defaultPrincipalPaise));
      setDefaultDeductionRupees(paiseToRupees(freshSettings.defaultDeductionPaise));
      setDefaultWeeklyDueRupees(paiseToRupees(freshSettings.defaultWeeklyPrincipalPaise));
      setDefaultPenaltyRupees(paiseToRupees(freshSettings.defaultPenaltyPaise));
      onRefresh(freshSettings);
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 mb-1">
            <Settings className="w-4 h-4" />
            <span>{lang === 'ta' ? 'அமைப்பு & உள்ளமைவு' : 'System Configuration & Business Profile'}</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {lang === 'ta' ? 'அமைப்புகள் & நிர்வாகக் கட்டுப்பாடு' : 'Settings & Business Configuration'}
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            {lang === 'ta'
              ? 'இங்கு மாற்றப்படும் வணிக பெயர், தொலைபேசி, முகவரி, கடன் விதிமுறைகள் மற்றும் வாட்ஸ்அப் சான்றுகள் முழு அமைப்பிலும் உடனடியாக புதுப்பிக்கப்படும்.'
              : 'Changes to business identity, phone, address, default loan values, and WhatsApp API keys take effect immediately across all receipts, messages, and schedules.'}
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? (lang === 'ta' ? 'சேமிக்கப்படுகிறது...' : 'Saving...') : (lang === 'ta' ? 'அமைப்புகளைச் சேமிக்க' : 'Save Changes')}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">
              {lang === 'ta'
                ? 'அமைப்புகள் வெற்றிகரமாக சேமிக்கப்பட்டன! புதிய வணிகப் பெயர் மற்றும் கடன் விதிமுறைகள் முழு அமைப்பிலும் புதுப்பிக்கப்பட்டன.'
                : 'Settings saved successfully! Business profile, loan defaults, and WhatsApp credentials are now active across the application.'}
            </span>
          </div>
          <button onClick={() => setSaveSuccess(false)} className="text-emerald-700 underline text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Section 1: Business Profile & Receipts Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Building2 className="w-4 h-4 text-emerald-700" />
            <h3 className="font-bold text-slate-900 text-sm">
              1. {lang === 'ta' ? 'வணிக சுயவிவரம் (ரசீது மற்றும் தலைப்பில் தோன்றும்)' : 'Business Profile & Official Identity'}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Business Name (English) *</label>
              <input
                type="text"
                required
                value={formState.businessName}
                onChange={e => setFormState({ ...formState, businessName: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 font-medium focus:outline-emerald-600"
              />
              <span className="text-[11px] text-slate-400">Displayed in top navigation bar and English receipts</span>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">வணிகப் பெயர் (Tamil) *</label>
              <input
                type="text"
                required
                value={formState.businessNameTa}
                onChange={e => setFormState({ ...formState, businessNameTa: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 font-medium focus:outline-emerald-600"
              />
              <span className="text-[11px] text-slate-400">Displayed when Tamil language toggle is active and in Tamil receipts</span>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Official Contact Phone Number *</label>
              <input
                type="text"
                required
                value={formState.businessPhone}
                onChange={e => setFormState({ ...formState, businessPhone: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 font-mono focus:outline-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Accounting Timezone</label>
              <input
                type="text"
                disabled
                value="Asia/Kolkata (IST · UTC+5:30)"
                className="w-full border border-slate-200 bg-slate-100 rounded-lg p-2.5 text-slate-600 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Official Office Address (English) *</label>
              <input
                type="text"
                required
                value={formState.businessAddress}
                onChange={e => setFormState({ ...formState, businessAddress: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
              />
              <span className="text-[11px] text-slate-400">Printed on customer loan receipts and statements</span>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">அலுவலக முகவரி (Tamil)</label>
              <input
                type="text"
                value={formState.businessAddressTa || ''}
                onChange={e => setFormState({ ...formState, businessAddressTa: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Configurable Default Loan Terms */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Database className="w-4 h-4 text-emerald-700" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                2. {lang === 'ta' ? 'இயல்புநிலை கடன் விதிமுறைகள்' : 'Default Loan Product Parameters'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {lang === 'ta'
                  ? 'புதிய கடன்களை உருவாக்கும் போது தானாக நிரப்பப்படும் விதிமுறைகள்'
                  : 'Pre-filled values for new loan creation (Default: ₹10,000 principal, ₹1,500 deduction, 10 weeks)'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Default Original Principal (₹) *</label>
              <input
                type="number"
                min="1000"
                step="500"
                required
                value={defaultPrincipalRupees}
                onChange={e => handlePrincipalChange(parseFloat(e.target.value) || 0)}
                className="w-full font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
              />
              <span className="text-[11px] text-slate-400">
                {lang === 'ta' ? 'அசலை மாற்றினால் அபராதம் தானாக கணக்கிடப்படும் (1%)' : 'Auto updates penalty proportionally (1%)'}
              </span>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Default Upfront Deduction (₹) *</label>
              <input
                type="number"
                min="0"
                step="100"
                required
                value={defaultDeductionRupees}
                onChange={e => setDefaultDeductionRupees(parseFloat(e.target.value) || 0)}
                className="w-full font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Default Net Cash Disbursed (₹)</label>
              <input
                type="text"
                readOnly
                value={`₹${Math.max(0, defaultPrincipalRupees - defaultDeductionRupees).toLocaleString('en-IN')}`}
                className="w-full font-mono border border-slate-200 bg-slate-100 rounded-lg p-2.5 text-emerald-800 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Default Duration (Weeks) *</label>
              <input
                type="number"
                min="1"
                max="52"
                required
                value={formState.defaultDurationWeeks}
                onChange={e => {
                  const w = parseInt(e.target.value, 10) || 1;
                  setFormState({ ...formState, defaultDurationWeeks: w });
                  setDefaultWeeklyDueRupees(Math.round(defaultPrincipalRupees / w));
                }}
                className="w-full font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Default Weekly Due (₹) *</label>
              <input
                type="number"
                min="100"
                required
                value={defaultWeeklyDueRupees}
                onChange={e => setDefaultWeeklyDueRupees(parseFloat(e.target.value) || 0)}
                className="w-full font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700">Default Penalty Per Due (₹) *</label>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                  10k→₹100 · 20k→₹200
                </span>
              </div>
              <input
                type="number"
                min="0"
                required
                value={defaultPenaltyRupees}
                onChange={e => setDefaultPenaltyRupees(parseFloat(e.target.value) || 0)}
                className="w-full font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
              />
              <p className="text-[11px] text-emerald-700 font-medium">
                {lang === 'ta'
                  ? 'தானியங்கி விதி: ₹10,000க்கு ₹100, ₹20,000க்கு ₹200 (1%)'
                  : 'Auto rule: ₹100 per ₹10,000 principal (1% of principal)'}
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: WhatsApp Cloud API Credentials */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-700" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  3. Meta WhatsApp Business Cloud API
                </h3>
                <p className="text-[11px] text-slate-500">
                  Configure Graph API credentials for automated Sunday due reminders & receipts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestWhatsAppConnection}
                disabled={isTesting}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span>{isTesting ? 'Testing Meta Connection...' : 'Test WhatsApp Connection'}</span>
              </button>
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg border text-xs font-mono ${
                testResult.connected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="font-bold">Status: {testResult.status}</div>
              <div className="text-[11px] mt-0.5">
                {testResult.message || testResult.error || JSON.stringify(testResult.details)}
              </div>
            </div>
          )}

          {/* WhatsApp Enabled Toggle */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-900 block">WhatsApp Automation Engine</span>
              <span className="text-[11px] text-slate-500">
                Enable or disable automated Sunday reminders and receipt dispatch
              </span>
            </div>
            <input
              type="checkbox"
              checked={formState.whatsappEnabled}
              onChange={e => setFormState({ ...formState, whatsappEnabled: e.target.checked })}
              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700">WhatsApp System User Access Token</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                placeholder="EAA..."
                value={formState.whatsappAccessToken || ''}
                onChange={e => setFormState({ ...formState, whatsappAccessToken: e.target.value })}
                className="w-full font-mono border border-slate-300 rounded-lg p-2.5 pr-10 text-slate-900 focus:outline-emerald-600"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <span className="text-[11px] text-slate-400">
              Permanent Token from Meta Business Manager &gt; System Users
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Phone Number ID</label>
              <input
                type="text"
                placeholder="e.g. 104928172819201"
                value={formState.whatsappPhoneNumberId || ''}
                onChange={e => setFormState({ ...formState, whatsappPhoneNumberId: e.target.value })}
                className="w-full font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">WhatsApp Business Account ID (WABA)</label>
              <input
                type="text"
                placeholder="e.g. 918273645019283"
                value={formState.whatsappBusinessAccountId || ''}
                onChange={e => setFormState({ ...formState, whatsappBusinessAccountId: e.target.value })}
                className="w-full font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700">Webhook Verification Token</label>
            <input
              type="text"
              value={formState.whatsappVerifyToken || ''}
              onChange={e => setFormState({ ...formState, whatsappVerifyToken: e.target.value })}
              className="w-full font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
            />
            <p className="text-[11px] text-slate-400">
              Webhook Callback URL: <code className="font-mono text-slate-700">https://your-domain.com/api/whatsapp/webhook</code>
            </p>
          </div>

          {/* Dedicated Live WhatsApp Test Console */}
          <div className="p-4 bg-slate-50 rounded-xl border border-emerald-200/80 space-y-3 mt-4">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs pb-1 border-b border-emerald-100">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>
                {lang === 'ta'
                  ? 'நேரடி வாட்ஸ்அப் சோதனை செய்தி அனுப்புதல் (Live WhatsApp Delivery Test)'
                  : 'Send Live Test WhatsApp Message to Your Phone'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              {lang === 'ta'
                ? 'உங்கள் மொபைல் எண்ணிற்கு நேரடியாக செய்தி அனுப்பி சரிபார்க்கவும். டெஸ்ட் ஏபிஐ இணைக்கப்பட்டிருந்தாலும் மெட்டா சாண்ட்பாக்ஸ் மற்றும் 24 மணி நேர விதிகளின்படி செய்தி அனுப்பப்படும்.'
                : 'Send an immediate test message directly to your WhatsApp number to verify real delivery on your physical device.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  {lang === 'ta' ? 'பெறுநரின் வாட்ஸ்அப் எண் (+91 உடன்)' : 'Recipient WhatsApp Phone (+91)'}
                </label>
                <input
                  type="text"
                  value={liveTestPhone}
                  onChange={e => setLiveTestPhone(e.target.value)}
                  placeholder="+91 98421 12345"
                  className="w-full font-mono border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-emerald-600 bg-white"
                />
                <span className="text-[10px] text-slate-500">
                  {lang === 'ta' ? 'இந்திய எண்களுக்கு தானாக +91 சேர்க்கப்படும்' : 'Country code 91 automatically formatted for India'}
                </span>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  {lang === 'ta' ? 'செய்தி முறை (Message Type)' : 'Delivery Mode'}
                </label>
                <select
                  value={liveTestMode}
                  onChange={e => setLiveTestMode(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-emerald-600 bg-white"
                >
                  <option value="template">
                    {lang === 'ta'
                      ? 'அங்கீகரிக்கப்பட்ட டெம்ப்ளேட் (hello_world) - [பரிந்துரைக்கப்பட்டது]'
                      : 'Pre-Approved Template (hello_world) - [Recommended]'}
                  </option>
                  <option value="text">
                    {lang === 'ta' ? 'தனிப்பயன் செய்தி (Custom Text Message)' : 'Custom Free-form Text'}
                  </option>
                </select>
                <span className="text-[10px] text-emerald-700 font-medium">
                  {liveTestMode === 'template'
                    ? (lang === 'ta' ? '24 மணி நேர கட்டுப்பாடு இன்றி உடனடியாக வந்து சேரும்' : 'Bypasses 24h window restriction, delivers instantly')
                    : (lang === 'ta' ? 'வாடிக்கையாளர் 24 மணி நேரத்திற்குள் செய்தி அனுப்பியிருக்க வேண்டும்' : 'Requires customer reply within last 24h')}
                </span>
              </div>
            </div>

            {liveTestMode === 'text' && (
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  {lang === 'ta' ? 'செய்தி உரை (Custom Message Text)' : 'Custom Text'}
                </label>
                <textarea
                  rows={2}
                  value={liveTestCustomText}
                  onChange={e => setLiveTestCustomText(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-900 bg-white"
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleSendLiveTest}
              disabled={isSendingLiveTest || !liveTestPhone.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isSendingLiveTest
                  ? (lang === 'ta' ? 'செய்தி அனுப்பப்படுகிறது...' : 'Sending Test Message to WhatsApp...')
                  : (lang === 'ta' ? 'என் வாட்ஸ்அப்பிற்கு சோதனை செய்தி அனுப்பு' : 'Send Test Message to my WhatsApp')}
              </span>
            </button>

            {/* Live Delivery Feedback Display */}
            {liveTestResult && (
              <div
                className={`p-3.5 rounded-lg border text-xs ${
                  liveTestResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {liveTestResult.success ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        {lang === 'ta'
                          ? `வாட்ஸ்அப் செய்தி வெற்றிகரமாக அனுப்பப்பட்டது! (${liveTestResult.simulated ? 'மாதிரி முறை' : 'நேரடி மெட்டா ஏபிஐ'})`
                          : `WhatsApp message dispatched! (${liveTestResult.simulated ? 'Simulation Sandbox' : 'Live Meta Cloud API'})`}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        {lang === 'ta' ? 'வாட்ஸ்அப் டெலிவரி பிழை (Delivery Error)' : 'WhatsApp Delivery Issue'}
                      </span>
                    </>
                  )}
                </div>

                {liveTestResult.success ? (
                  <div className="mt-1 space-y-1 text-[11px]">
                    <p className="font-mono">
                      Recipient: +{liveTestResult.recipientPhone} · ID: {liveTestResult.whatsappMessageId}
                    </p>
                    <p className="text-emerald-800 font-medium">
                      {lang === 'ta'
                        ? 'உங்கள் மொபைல் திரையில் வாட்ஸ்அப் அறிவிப்பு அல்லது செய்தியை சரிபார்க்கவும்!'
                        : 'Check your physical mobile phone now for the WhatsApp notification or chat.'}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2 text-[11px]">
                    {liveTestResult.diagnostics ? (
                      <>
                        <div className="font-semibold text-amber-900">
                          {lang === 'ta' ? liveTestResult.diagnostics.userMessageTa : liveTestResult.diagnostics.userMessage}
                        </div>
                        <div className="p-2.5 bg-white/80 rounded border border-amber-200 text-amber-950 font-medium">
                          <span className="block font-bold mb-0.5">
                            {lang === 'ta' ? 'தீர்வு (How to solve):' : 'Recommended Solution:'}
                          </span>
                          {lang === 'ta' ? liveTestResult.diagnostics.adviceTa : liveTestResult.diagnostics.advice}
                        </div>
                      </>
                    ) : (
                      <p className="font-mono text-red-700">{liveTestResult.error}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Troubleshooting Guide Box for Sandbox & Meta Rules */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {lang === 'ta'
                    ? 'டெஸ்ட் ஏபிஐ Connected-ல் இருந்தாலும் செய்தி வராததற்கான காரணங்கள்:'
                    : 'Why Test API is Connected but No WhatsApp Message Received:'}
                </span>
              </div>
              <ul className="space-y-1.5 list-disc list-inside text-slate-700">
                <li>
                  <strong className="text-slate-900">
                    {lang === 'ta' ? '1. மெட்டா சாண்ட்பாக்ஸ் அனுமதி (Allowed List):' : '1. Meta Sandbox Recipient List:'}
                  </strong>{' '}
                  {lang === 'ta'
                    ? 'மெட்டா டெவலப்பர் அக்கவுண்ட்டின் டெஸ்ட் எண்ணிலிருந்து செய்தி பெற, உங்கள் போன் நம்பரை Meta Developer Portal > WhatsApp > API Setup > Step 2: "Manage phone number list"-ல் சேர்த்து OTP சரிபார்க்க வேண்டும்.'
                    : 'In Meta test accounts, recipient numbers must be added under "Manage phone number list" in Meta Developer Portal and verified with OTP.'}
                </li>
                <li>
                  <strong className="text-slate-900">
                    {lang === 'ta' ? '2. 24 மணி நேர வாட்ஸ்அப் விதி (24-Hour Policy Window):' : '2. 24-Hour Customer Window:'}
                  </strong>{' '}
                  {lang === 'ta'
                    ? 'வாடிக்கையாளர் கடந்த 24 மணி நேரத்திற்குள் செய்தி அனுப்பவில்லை என்றால், மெட்டா வெறும் Text மெசேஜ்களை அனுமதிக்காது. எனவே மேலே உள்ள "hello_world" டெம்ப்ளேட்டைத் தேர்ந்தெடுக்கவும் அல்லது உங்கள் போனில் இருந்து பிசினஸ் வாட்ஸ்அப் எண்ணிற்கு "Hi" என்று அனுப்பவும்.'
                    : 'Meta rejects custom text if recipient hasn\'t messaged within 24 hours. Use the "hello_world" template or send "Hi" from your phone to the business number.'}
                </li>
                <li>
                  <strong className="text-slate-900">
                    {lang === 'ta' ? '3. அமைப்புகளைச் சேமிக்கவும் (Save Settings):' : '3. Save Settings:'}
                  </strong>{' '}
                  {lang === 'ta'
                    ? 'டோக்கன் உள்ளிட்ட பிறகு மேலே அல்லது கீழே உள்ள "Save Settings" பட்டனை அழுத்தினால் மட்டுமே அது கணினியில் நிரந்தரமாக சேமிக்கப்படும்.'
                    : 'Remember to click "Save Settings" so your token and phone ID are permanently saved on disk.'}
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Section 4: Visual Effects, Neon Theme & Running Glow Borders */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />
              <h3 className="font-bold text-slate-900 text-sm">
                4. {lang === 'ta' ? 'தோற்றம், நியோன் தீம் & ஒளிரும் பார்டர் அனிமேஷன்' : 'Appearance, Neon Theme & Running Glow Border Effects'}
              </h3>
            </div>
            <span className="text-[11px] font-mono text-cyan-400 font-semibold px-2 py-0.5 rounded bg-cyan-400/10 border border-cyan-400/25">
              60 FPS GPU Effects
            </span>
          </div>

          {/* 3 Theme Choice Cards */}
          <div>
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mb-2">
              {lang === 'ta' ? 'தீம் தேர்வு (Select Visual Atmosphere):' : 'Select Theme Atmosphere:'}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Light */}
              <div
                onClick={() => handleSelectThemeMode('light')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  localThemeMode === 'light'
                    ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs ring-1 ring-amber-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {lang === 'ta' ? 'வெளிச்சத் தோற்றம்' : 'Classic Light'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {lang === 'ta'
                    ? 'பகலில் தெளிவாக கணக்கு பார்க்க உதவும் இயல்பான வெள்ளை பின்னணி.'
                    : 'Clean daylight aesthetic with slate-50 canvas and high-contrast tables.'}
                </p>
              </div>

              {/* Dark Smoke */}
              <div
                onClick={() => handleSelectThemeMode('dark')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  localThemeMode === 'dark'
                    ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-xs ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Flame className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {lang === 'ta' ? 'டார்க் ஸ்மோக்' : 'Dark Smoke Atmosphere'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {lang === 'ta'
                    ? 'கரிய புகை அலைகள், ஒளிரும் எமரால்டு நிற துகள்கள் மற்றும் கண்ணாடி அட்டைகள்.'
                    : 'Charcoal volumetric mist, ambient emerald embers, and frosted glass.'}
                </p>
              </div>

              {/* Neon Cyber */}
              <div
                onClick={() => handleSelectThemeMode('neon')}
                className={`relative p-4 rounded-xl border cursor-pointer transition-all ${
                  localThemeMode === 'neon'
                    ? 'border-cyan-400 bg-cyan-950/30 shadow-md ring-2 ring-cyan-400/80 shadow-cyan-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-cyan-400/40 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Zap className="w-4 h-4 text-cyan-400 animate-bounce" />
                  <span className="text-xs font-bold text-cyan-400">
                    {lang === 'ta' ? 'நியோன் சைபர் (Neon Cyber)' : 'High-Voltage Neon Theme'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {lang === 'ta'
                    ? 'ஆழ்ந்த கரிய பின்னணி, ஒளிரும் சியான், லைம் மற்றும் வயலட் லேசர் பார்டர்கள்.'
                    : 'Deep obsidian backdrop with glowing cyan, electric lime, and running laser beams.'}
                </p>
              </div>
            </div>
          </div>

          {/* Running Border Glow Animation Toggle & Preview */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/40 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 dark:text-white block text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  {lang === 'ta' ? 'ஒளிரும் பார்டர் ஓட்ட அனிமேஷன் (Glow Effect Border Running Animation)' : 'Glow Effect Border Running Animation'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {lang === 'ta'
                    ? 'அட்டைகள் மற்றும் முக்கிய பட்டன்களைச் சுற்றி சுழலும் நியோன் லேசர் கதிர் ஓட்டம்'
                    : 'Continuous rotating neon laser beam running along borders of cards, modals, and CTAs'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleRunningBorders(!localRunningBorders)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  localRunningBorders ? 'bg-cyan-500 shadow-sm shadow-cyan-400/50' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    localRunningBorders ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Live Interactive Preview of Running Border */}
            {localRunningBorders && (
              <div className="relative p-[1.5px] rounded-xl overflow-hidden shadow-md">
                <div className="absolute inset-[-100%] pointer-events-none animate-border-beam-spin duration-3000 bg-[conic-gradient(from_0deg,transparent_0_55%,#00f0ff_75%,#10b981_90%,#d946ef_96%,transparent_100%)]" />
                <div className="relative z-10 p-3 rounded-[calc(0.75rem-1.5px)] bg-slate-900/95 flex items-center justify-between text-xs text-white">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span className="font-mono text-[11px] text-cyan-300 font-semibold">
                      {lang === 'ta' ? 'நேரலை மாதிரி: லேசர் பார்டர் சீராக சுழல்கிறது' : 'Live Preview: Running Glow Border Active'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    Smooth 360° Laser Loop
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Smoke Density Selector */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
            <div>
              <span className="font-semibold text-slate-800 dark:text-white block text-xs flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-emerald-400" />
                {lang === 'ta' ? 'புகை துகள்கள் அடர்த்தி (Smoke Density & Particles)' : 'Atmospheric Smoke Density'}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                {lang === 'ta'
                  ? 'துகள்களின் எண்ணிக்கையை உங்கள் விருப்பத்திற்கு ஏற்ப மாற்றலாம்'
                  : 'Adjust the volumetric smoke puff count and ambient vortex speed'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-1">
              {(['low', 'medium', 'high', 'off'] as SmokeDensity[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleSetSmokeDensity(d)}
                  className={`px-2 py-2 rounded-lg text-center font-mono text-xs uppercase font-medium transition-all ${
                    localSmokeDensity === d
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs shadow-cyan-400/40'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 5: Reset All Data & Factory Restore */}
        <div className="p-6 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-sm">
              <RotateCcw className="w-4 h-4 text-red-600" />
              <span>{lang === 'ta' ? '5. அனைத்து தரவுகளையும் மீட்டமைக்க (Reset All Data)' : '5. Reset All System Data (Wipe or Demo)'}</span>
            </div>
            <button
              type="button"
              onClick={onOpenResetData ? onOpenResetData : handleResetFactory}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-sm shadow-red-500/20"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === 'ta' ? 'தரவை மீட்டமைக்க' : 'Open Reset Dialog'}</span>
            </button>
          </div>
          <p className="text-[11px] text-red-600/90 dark:text-red-300 leading-relaxed">
            {lang === 'ta'
              ? 'மாதிரி கடன் தரவுகளை (₹10,000 Salem Finance மாதிரி) மீட்டமைக்கலாம் அல்லது உங்கள் உண்மையான வணிகத் தரவை உள்ளிட அனைத்து பதிவுகளையும் முற்றிலும் அழித்து 0 ஆக்கலாம்.'
              : 'Choose between restoring the default ₹10,000 demo loan scenario or completely erasing all records to a clean 0-record slate for your live finance business.'}
          </p>
        </div>

        {/* Save and Reset Bar */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onOpenResetData ? onOpenResetData : handleResetFactory}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-400 hover:text-red-900 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{lang === 'ta' ? 'அனைத்து தரவுகளையும் மீட்டமைக்க' : 'Reset All Data'}</span>
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-1.5 px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? (lang === 'ta' ? 'சேமிக்கப்படுகிறது...' : 'Saving...') : (lang === 'ta' ? 'அமைப்புகளைச் சேமிக்க' : 'Save Settings')}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
