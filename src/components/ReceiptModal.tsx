import React, { useRef, useState } from 'react';
import { Receipt, formatINR, SupportedLanguage, BusinessSettings } from '../lib/types';
import { translations } from '../lib/i18n';
import {
  Printer,
  Share2,
  X,
  Check,
  Building2,
  User,
  Calendar,
  CreditCard,
  ShieldCheck,
  Smartphone,
  ExternalLink,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { buildReceiptWhatsAppText, buildDirectWhatsAppUrl } from '../lib/whatsappService';

interface ReceiptModalProps {
  receipt: Receipt | null;
  settings?: BusinessSettings;
  onClose: () => void;
  lang: SupportedLanguage;
  onSendWhatsApp?: (receipt: Receipt) => Promise<{ success: boolean; simulated?: boolean; messageId?: string; error?: string; diagnostics?: any } | void> | void;
  isSendingWhatsApp?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  receipt,
  settings,
  onClose,
  lang,
  onSendWhatsApp,
  isSendingWhatsApp = false,
}) => {
  const t = translations[lang];
  const printRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<{
    type: 'success' | 'warning' | 'error' | null;
    message: string;
    advice?: string;
  }>({ type: null, message: '' });
  const [isCallingApi, setIsCallingApi] = useState(false);

  if (!receipt) return null;

  const bName = settings
    ? (lang === 'ta' ? (settings.businessNameTa || settings.businessName) : settings.businessName)
    : (lang === 'ta' ? 'ஸ்ரீ முருகன் பைனான்ஸ்' : 'SRI MURUGAN FINANCE');

  const bAddress = settings?.businessAddress || '45 Bazaar Street, Salem, Tamil Nadu - 636001';
  const bPhone = settings?.businessPhone || '+91 98400 12345';

  const receiptWhatsAppMessage = buildReceiptWhatsAppText({
    receiptNumber: receipt.receiptNumber,
    customerName: receipt.customerName,
    customerMobile: receipt.customerMobile,
    loanCode: receipt.loanCode,
    amountPaidPaise: receipt.amountPaidPaise,
    principalAllocationPaise: receipt.principalAllocationPaise,
    penaltyAllocationPaise: receipt.penaltyAllocationPaise,
    principalBalanceRemainingPaise: receipt.principalBalanceRemainingPaise,
    penaltyBalanceRemainingPaise: receipt.penaltyBalanceRemainingPaise,
    totalBalanceRemainingPaise: receipt.totalBalanceRemainingPaise,
    paymentMethod: receipt.paymentMethod,
    transactionReference: receipt.transactionReference,
    issuedDate: receipt.issuedDate,
    businessName: bName,
    businessAddress: bAddress,
    businessPhone: bPhone,
    lang,
  });

  const directWhatsAppUrl = buildDirectWhatsAppUrl(receipt.customerMobile, receiptWhatsAppMessage);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(receiptWhatsAppMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendViaCloudApi = async () => {
    setCloudStatus({ type: null, message: '' });
    setIsCallingApi(true);

    try {
      const activeSettings = settings || (window as any)._appSettings || {};
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone: receipt.customerMobile,
          text: receiptWhatsAppMessage,
          messageType: 'payment_receipt',
          accessToken: activeSettings.whatsappAccessToken,
          phoneNumberId: activeSettings.whatsappPhoneNumberId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.simulated) {
          setCloudStatus({
            type: 'warning',
            message: lang === 'ta'
              ? 'மாதிரி முறை (Simulation): மெட்டா ஏபிஐ டோக்கன் இணைக்கப்படவில்லை. வாடிக்கையாளரின் வாட்ஸ்அப்பிற்கு உண்மையான செய்தி சென்றடைய "வாட்ஸ்அப்பில் திறக்க" பட்டனைப் பயன்படுத்தவும்.'
              : 'Simulation Mode: No live Meta token connected. Click "Open in WhatsApp" to deliver to the customer instantly.',
          });
        } else {
          setCloudStatus({
            type: 'success',
            message: lang === 'ta'
              ? `வாட்ஸ்அப் ரசீது வெற்றிகரமாக அனுப்பப்பட்டது! (மெட்டா செய்தி எண்: ${data.whatsappMessageId})`
              : `Receipt sent via Meta Cloud API! (ID: ${data.whatsappMessageId})`,
          });
        }
      } else {
        const diag = data.diagnostics;
        setCloudStatus({
          type: 'error',
          message: diag
            ? (lang === 'ta' ? diag.userMessageTa : diag.userMessage)
            : (data.error || 'Meta API delivery failed'),
          advice: diag
            ? (lang === 'ta' ? diag.adviceTa : diag.advice)
            : (lang === 'ta' ? 'வாடிக்கையாளரின் வாட்ஸ்அப்பில் நேரடியாக அனுப்ப கீழே உள்ள பட்டனை அழுத்தவும்.' : 'Use Direct WhatsApp button below to send immediately.'),
        });
      }
    } catch (err: any) {
      setCloudStatus({
        type: 'error',
        message: err.message || 'Network error connecting to WhatsApp API',
        advice: lang === 'ta' ? 'வாட்ஸ்அப் வழியாக நேரடியாக அனுப்பலாம்.' : 'You can send directly via WhatsApp.',
      });
    } finally {
      setIsCallingApi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 no-print">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-slate-900">{t.receipt.receiptTitle}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Body */}
        <div ref={printRef} className="p-6 overflow-y-auto space-y-6 print:p-8 print:m-0">
          {/* Header & Logo */}
          <div className="text-center border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
              {bName}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              {bAddress} · Ph: {bPhone}
            </p>
            <p className="text-xs font-semibold text-emerald-700 mt-1">
              {lang === 'ta' ? 'வாராந்திர கடன் அதிகாரப்பூர்வ வரவு ரசீது' : 'OFFICIAL WEEKLY REPAYMENT RECEIPT'}
            </p>
          </div>

          {/* Receipt Meta Strip */}
          <div className="flex justify-between items-center text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
            <div>
              <span className="text-slate-500 block">{t.receipt.receiptNumber}</span>
              <span className="font-mono font-semibold text-slate-800">{receipt.receiptNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">{t.receipt.paymentDate}</span>
              <span className="font-medium text-slate-800">
                {new Date(receipt.issuedDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Customer & Loan Info */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block">{t.customer.fullName}</span>
              <span className="font-semibold text-slate-900 text-sm">{receipt.customerName}</span>
              <span className="text-slate-500 block font-mono mt-0.5">{receipt.customerMobile}</span>
            </div>
            <div>
              <span className="text-slate-500 block">{t.loan.loanCode}</span>
              <span className="font-mono font-semibold text-slate-900 text-sm">{receipt.loanCode}</span>
              <span className="text-slate-500 block uppercase mt-0.5">
                {receipt.paymentMethod} {receipt.transactionReference ? `· ${receipt.transactionReference}` : ''}
              </span>
            </div>
          </div>

          {/* Payment Breakdown Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 flex justify-between">
              <span>{lang === 'ta' ? 'விவரம் (Description)' : 'Particulars'}</span>
              <span>{lang === 'ta' ? 'தொகை (Amount)' : 'Credited Amount'}</span>
            </div>
            <div className="divide-y divide-slate-100 text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-700">{t.receipt.principalCredited}</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatINR(receipt.principalAllocationPaise)}
                </span>
              </div>
              {receipt.penaltyAllocationPaise > 0 && (
                <div className="flex justify-between px-4 py-2.5 bg-amber-50/40">
                  <span className="text-slate-700">{t.receipt.penaltyCredited}</span>
                  <span className="font-mono font-semibold text-amber-700 tabular-nums">
                    {formatINR(receipt.penaltyAllocationPaise)}
                  </span>
                </div>
              )}
              <div className="flex justify-between px-4 py-3 bg-emerald-50 text-emerald-950 font-bold">
                <span>{t.receipt.totalReceived}</span>
                <span className="font-mono tabular-nums text-base">
                  {formatINR(receipt.amountPaidPaise)}
                </span>
              </div>
            </div>
          </div>

          {/* Ledger Outstanding Summary (Authoritative Database State) */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs space-y-2">
            <div className="font-semibold text-slate-700 border-b border-slate-200 pb-1">
              {lang === 'ta' ? 'கணக்கு இருப்பு விவரம் (Updated Ledger Balance)' : 'Authoritative Outstanding Balances'}
            </div>
            <div className="flex justify-between text-slate-600">
              <span>{t.receipt.principalRemaining}</span>
              <span className="font-mono font-semibold text-slate-800 tabular-nums">
                {formatINR(receipt.principalBalanceRemainingPaise)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>{t.receipt.penaltyRemaining}</span>
              <span className="font-mono font-semibold text-amber-700 tabular-nums">
                {formatINR(receipt.penaltyBalanceRemainingPaise)}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-slate-900">
              <span>{t.receipt.balanceRemaining}</span>
              <span className="font-mono text-sm text-slate-950 tabular-nums">
                {formatINR(receipt.totalBalanceRemainingPaise)}
              </span>
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
            <div>
              <div className="border-b border-dashed border-slate-300 w-32 mb-1" />
              <span>{lang === 'ta' ? 'வாடிக்கையாளர் கையப்பம்' : 'Customer Signature'}</span>
            </div>
            <div className="text-right">
              <div className="border-b border-dashed border-slate-300 w-32 mb-1" />
              <span>{lang === 'ta' ? 'அங்கீகரிக்கப்பட்ட கையொப்பம்' : 'Authorized Signatory'}</span>
            </div>
          </div>
        </div>

        {/* WhatsApp Delivery Status Banner (Inside Modal) */}
        {cloudStatus.type && (
          <div
            className={`px-6 py-3 border-t text-xs ${
              cloudStatus.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : cloudStatus.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-start gap-2">
              {cloudStatus.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <p className="font-medium">{cloudStatus.message}</p>
                {cloudStatus.advice && (
                  <p className="text-[11px] opacity-90">{cloudStatus.advice}</p>
                )}
                {cloudStatus.type !== 'success' && (
                  <div className="pt-1">
                    <a
                      href={directWhatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md text-[11px] transition-colors shadow-xs"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>
                        {lang === 'ta'
                          ? 'வாடிக்கையாளர் வாட்ஸ்அப்பில் நேரடியாக திறக்க (Click to Chat)'
                          : 'Open in WhatsApp Directly (Guaranteed Delivery)'}
                      </span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons (Hidden on Print) */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2.5 no-print">
          <button
            type="button"
            onClick={handleCopyText}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <CreditCard className="w-4 h-4" />}
            {copied ? (lang === 'ta' ? 'நகலெடுக்கப்பட்டது' : 'Copied') : (lang === 'ta' ? 'உரை நகல்' : 'Copy Text')}
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {/* Direct WhatsApp (100% Reliable Delivery without Meta sandbox restrictions) */}
            <a
              href={directWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              title={lang === 'ta' ? 'வாடிக்கையாளரின் வாட்ஸ்அப் நேரடியாகத் திறந்து செய்தி அனுப்பவும்' : 'Direct delivery via WhatsApp Web / App'}
            >
              <Smartphone className="w-4 h-4" />
              <span>
                {lang === 'ta' ? 'வாட்ஸ்அப்பில் பகிர (Direct)' : 'Send to WhatsApp'}
              </span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>

            {/* Cloud API Automation Button */}
            <button
              type="button"
              onClick={handleSendViaCloudApi}
              disabled={isCallingApi || isSendingWhatsApp}
              className="px-3 py-2 text-xs font-medium text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title={lang === 'ta' ? 'மெட்டா கிளவுட் ஏபிஐ மூலம் தானாக அனுப்பவும்' : 'Send via Meta WhatsApp Cloud API'}
            >
              <Share2 className="w-3.5 h-3.5" />
              {isCallingApi || isSendingWhatsApp
                ? (lang === 'ta' ? 'அனுப்பப்படுகிறது...' : 'Sending...')
                : (lang === 'ta' ? 'கிளவுட் ஏபிஐ (Meta API)' : 'Cloud API')}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              {t.common.print}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

