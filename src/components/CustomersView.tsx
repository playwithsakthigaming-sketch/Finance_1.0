/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Customer,
  Loan,
  Payment,
  WeeklyDue,
  PenaltyLedgerEntry,
  Receipt,
  formatINR,
  SupportedLanguage,
} from '../lib/types';
import { translations } from '../lib/i18n';
import { StorageService } from '../lib/storage';
import {
  Search,
  Plus,
  User,
  Phone,
  MapPin,
  Check,
  X,
  CreditCard,
  FileText,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

interface CustomersViewProps {
  customers: Customer[];
  loans: Loan[];
  dues: WeeklyDue[];
  payments: Payment[];
  penalties: PenaltyLedgerEntry[];
  receipts: Receipt[];
  lang: SupportedLanguage;
  onRefresh: () => void;
  onSelectCustomerLoan?: (loanId: string) => void;
  onOpenRecordPaymentWithCustomer?: (loanId: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  loans,
  dues,
  payments,
  penalties,
  receipts,
  lang,
  onRefresh,
  onSelectCustomerLoan,
  onOpenRecordPaymentWithCustomer,
}) => {
  const t = translations[lang];
  const storage = StorageService.getInstance();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    fullName: '',
    mobileNumber: '+91 ',
    whatsappNumber: '+91 ',
    address: '',
    city: 'Salem',
    idProofType: 'Aadhaar',
    idProofNumber: '',
    whatsappConsent: true,
    whatsappConsentSource: 'Office Loan Application Signature',
    internalNotes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Filter customers
  const filteredCustomers = customers.filter(c => {
    const matchesSearch =
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.mobileNumber.includes(searchQuery) ||
      c.customerCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const customerLoans = selectedCustomer ? loans.filter(l => l.customerId === selectedCustomer.id) : [];
  const customerPayments = selectedCustomer ? payments.filter(p => p.customerId === selectedCustomer.id) : [];
  const customerPenalties = selectedCustomer ? penalties.filter(p => p.customerId === selectedCustomer.id) : [];
  const customerReceipts = selectedCustomer ? receipts.filter(r => r.customerId === selectedCustomer.id) : [];

  // Calculate customer total outstanding
  const getCustomerOutstanding = (custId: string) => {
    const cLoans = loans.filter(l => l.customerId === custId && l.status === 'active');
    const cDues = dues.filter(d => cLoans.some(l => l.id === d.loanId));
    const cPenalties = penalties.filter(p => p.customerId === custId && p.status === 'assessed');

    let remPrincipal = 0;
    cDues.forEach(d => {
      remPrincipal += (d.scheduledPrincipalPaise - d.paidPrincipalPaise);
    });

    let remPenalties = 0;
    cPenalties.forEach(p => {
      remPenalties += (p.amountPaise - p.paidPaise - p.waivedPaise);
    });

    return {
      principalPaise: remPrincipal,
      penaltyPaise: remPenalties,
      totalPaise: remPrincipal + remPenalties,
    };
  };

  const handleAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanMobile = formData.mobileNumber.replace(/\s+/g, '');
    const cleanWhatsapp = formData.whatsappNumber.replace(/\s+/g, '');

    if (!formData.fullName.trim() || formData.fullName.length < 2) {
      setFormError('Full name must be at least 2 characters');
      return;
    }

    if (cleanMobile.length < 10) {
      setFormError('Valid mobile number with country code is required (e.g. +919842100001)');
      return;
    }

    // Check duplicate phone
    const duplicate = customers.find(
      c => c.mobileNumber.replace(/\s+/g, '') === cleanMobile
    );
    if (duplicate) {
      setFormError(`Customer already exists with this mobile number (${duplicate.fullName} - ${duplicate.customerCode})`);
      return;
    }

    const nextCodeNumber = customers.length + 1;
    const customerCode = `CUST-${String(nextCodeNumber).padStart(4, '0')}`;
    const now = new Date().toISOString();

    const newCustomer: Customer = {
      id: `cust_${Date.now()}`,
      customerCode,
      fullName: formData.fullName.trim(),
      mobileNumber: cleanMobile,
      whatsappNumber: cleanWhatsapp || cleanMobile,
      address: formData.address.trim(),
      city: formData.city.trim() || 'Salem',
      idProofType: formData.idProofType,
      idProofNumber: formData.idProofNumber.trim(),
      status: 'active',
      whatsappConsent: formData.whatsappConsent,
      whatsappConsentTimestamp: now,
      whatsappConsentSource: formData.whatsappConsentSource,
      internalNotes: formData.internalNotes.trim(),
      createdAt: now,
      updatedAt: now,
    };

    storage.saveCustomers([newCustomer, ...customers]);
    storage.logAudit(
      'CUSTOMER_CREATED',
      'customer',
      newCustomer.customerCode,
      `Registered new customer ${newCustomer.fullName} (${newCustomer.mobileNumber})`
    );

    setIsAddModalOpen(false);
    setFormData({
      fullName: '',
      mobileNumber: '+91 ',
      whatsappNumber: '+91 ',
      address: '',
      city: 'Salem',
      idProofType: 'Aadhaar',
      idProofNumber: '',
      whatsappConsent: true,
      whatsappConsentSource: 'Office Loan Application Signature',
      internalNotes: '',
    });
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={lang === 'ta' ? 'பெயர், தொலைபேசி அல்லது எண் மூலம் தேடுக...' : 'Search by name, phone, or customer ID...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-emerald-600"
          />
        </div>

        {/* Filter Segment & Add Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-100">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.common.all}
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === 'active'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.common.active}
            </button>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t.customer.addCustomer}</span>
          </button>
        </div>
      </div>

      {/* Main Customers Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">{lang === 'ta' ? 'வாடிக்கையாளர்' : 'Customer'}</th>
                <th className="py-3 px-4">{lang === 'ta' ? 'தொடர்பு & வாட்ஸ்அப்' : 'Contact & Consent'}</th>
                <th className="py-3 px-4">{lang === 'ta' ? 'நகரம் / முகவரி' : 'Address'}</th>
                <th className="py-3 px-4 text-right">{t.metrics.principalOutstanding}</th>
                <th className="py-3 px-4 text-right">{t.metrics.penaltiesOutstanding}</th>
                <th className="py-3 px-4 text-center">{t.common.status}</th>
                <th className="py-3 px-4 text-right">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {t.common.noData}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(customer => {
                  const bal = getCustomerOutstanding(customer.id);
                  const activeLoan = loans.find(l => l.customerId === customer.id && l.status === 'active');

                  return (
                    <tr
                      key={customer.id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={() => setSelectedCustomerId(customer.id)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{customer.fullName}</div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {customer.customerCode}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-slate-800">{customer.mobileNumber}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          {customer.whatsappConsent ? (
                            <span className="text-emerald-700 font-medium">WhatsApp Opted-In</span>
                          ) : (
                            <span className="text-slate-400">Opted-Out</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div>{customer.city}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                          {customer.address}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatINR(bal.principalPaise)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-amber-700 tabular-nums">
                        {bal.penaltyPaise > 0 ? formatINR(bal.penaltyPaise) : '₹0'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block text-[11px] text-emerald-700 font-medium capitalize">
                          {customer.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedCustomerId(customer.id);
                          }}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 px-2 py-1 rounded hover:bg-emerald-50"
                        >
                          {t.customer.customerDetails}
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

      {/* CUSTOMER PROFILE & LEDGER MODAL */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                  {selectedCustomer.fullName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedCustomer.fullName}</h3>
                  <div className="text-xs text-slate-500 font-mono">
                    {selectedCustomer.customerCode} · {selectedCustomer.mobileNumber} · {selectedCustomer.city}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomerId(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Balances Overview Card */}
              {(() => {
                const bal = getCustomerOutstanding(selectedCustomer.id);
                return (
                  <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-slate-500 block">{t.metrics.principalOutstanding}</span>
                      <span className="text-base font-bold font-mono text-slate-900 tabular-nums">
                        {formatINR(bal.principalPaise)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">{t.metrics.penaltiesOutstanding}</span>
                      <span className="text-base font-bold font-mono text-amber-700 tabular-nums">
                        {formatINR(bal.penaltyPaise)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">{t.metrics.totalDue}</span>
                      <span className="text-base font-bold font-mono text-emerald-800 tabular-nums">
                        {formatINR(bal.totalPaise)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Customer Loans Section */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
                  {lang === 'ta' ? 'கடன்கள் பட்டியல்' : 'Loan History'}
                </h4>
                {customerLoans.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded text-slate-500 text-center">
                    No loans issued yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customerLoans.map(loan => (
                      <div
                        key={loan.id}
                        className="p-3 border border-slate-200 rounded-lg flex items-center justify-between bg-white"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{loan.loanCode}</div>
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            Original: {formatINR(loan.originalPrincipalPaise)} · Deduction: {formatINR(loan.upfrontDeductionPaise)} · Net: {formatINR(loan.netDisbursedPaise)}
                          </div>
                          <div className="text-slate-500 text-[11px]">
                            Duration: {loan.loanDurationWeeks} Weeks · Due: {formatINR(loan.weeklyPrincipalPaise)}/week (Sunday)
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                            loan.status === 'completed' || (loan.status as any) === 'closed'
                              ? 'bg-slate-100 text-slate-700 border-slate-300'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {loan.status === 'completed' || (loan.status as any) === 'closed'
                              ? (lang === 'ta' ? 'முடிந்தது' : 'CLOSED')
                              : loan.status}
                          </span>
                          {onOpenRecordPaymentWithCustomer && loan.status === 'active' && (
                            <button
                              onClick={() => {
                                setSelectedCustomerId(null);
                                onOpenRecordPaymentWithCustomer(loan.id);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700"
                            >
                              {t.nav.recordPayment}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Payment History */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
                  {lang === 'ta' ? 'செலுத்திய கட்டணங்கள்' : 'Payment Ledger Records'}
                </h4>
                {customerPayments.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded text-slate-500 text-center">
                    No payments posted yet.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="py-2 px-3">Receipt / Code</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3 text-right">Principal</th>
                          <th className="py-2 px-3 text-right">Penalty</th>
                          <th className="py-2 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {customerPayments.map(p => (
                          <tr key={p.id}>
                            <td className="py-2 px-3 font-mono font-medium text-slate-900">{p.paymentCode}</td>
                            <td className="py-2 px-3 text-slate-600">{new Date(p.paymentDate).toLocaleDateString('en-IN')}</td>
                            <td className="py-2 px-3 uppercase text-slate-600">{p.paymentMethod}</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums">{formatINR(p.allocatedToPrincipalPaise)}</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums text-amber-700">{formatINR(p.allocatedToPenaltyPaise)}</td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">{formatINR(p.amountReceivedPaise)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Consent Information */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="font-semibold text-slate-800 block">WhatsApp Automation Consent</span>
                <p className="text-slate-600">
                  Status: {selectedCustomer.whatsappConsent ? 'Consented (Active)' : 'Withdrawn'} · Source: {selectedCustomer.whatsappConsentSource} · Timestamp: {new Date(selectedCustomer.whatsappConsentTimestamp).toLocaleString('en-IN')}
                </p>
                {selectedCustomer.internalNotes && (
                  <p className="text-slate-500 italic mt-1">Note: {selectedCustomer.internalNotes}</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedCustomerId(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900"
              >
                {t.common.back}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CUSTOMER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-900 text-base">{t.customer.addCustomer}</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomerSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">{t.customer.fullName} *</label>
                <input
                  type="text"
                  placeholder="e.g. K. Ramasamy"
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">{t.customer.mobileNumber} *</label>
                  <input
                    type="text"
                    placeholder="+919842100001"
                    value={formData.mobileNumber}
                    onChange={e => setFormData({ ...formData, mobileNumber: e.target.value, whatsappNumber: e.target.value })}
                    className="w-full font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">WhatsApp Number *</label>
                  <input
                    type="text"
                    placeholder="+919842100001"
                    value={formData.whatsappNumber}
                    onChange={e => setFormData({ ...formData, whatsappNumber: e.target.value })}
                    className="w-full font-mono border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">{t.common.address} *</label>
                <input
                  type="text"
                  placeholder="Street and Area address"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">City / District</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">ID Proof (Aadhaar / Voter)</label>
                  <input
                    type="text"
                    placeholder="XXXX-XXXX-1234"
                    value={formData.idProofNumber}
                    onChange={e => setFormData({ ...formData, idProofNumber: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
                  />
                </div>
              </div>

              {/* WhatsApp Consent */}
              <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="waConsent"
                  checked={formData.whatsappConsent}
                  onChange={e => setFormData({ ...formData, whatsappConsent: e.target.checked })}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="waConsent" className="text-slate-700 cursor-pointer">
                  <span className="font-semibold block">{t.customer.whatsappConsent}</span>
                  <span className="text-[11px] text-slate-500">
                    {lang === 'ta'
                      ? 'ஞாயிறு தவணை நினைவூட்டல் மற்றும் கட்டண ரசீதுகளை வாட்ஸ்அப்பில் பெற ஒப்புதல் அளிக்கிறார்'
                      : 'Customer explicitly consents to receive Sunday due reminders and official payment receipts via WhatsApp Cloud API'}
                  </span>
                </label>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">{t.common.notes}</label>
                <textarea
                  rows={2}
                  placeholder="Occupation, shop location, reference notes"
                  value={formData.internalNotes}
                  onChange={e => setFormData({ ...formData, internalNotes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-emerald-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium shadow-xs"
                >
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
