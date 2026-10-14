/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  OutboxMessage,
  MessageDeliveryStatus,
  SupportedLanguage,
  formatINR,
} from '../lib/types';
import { translations } from '../lib/i18n';
import { StorageService } from '../lib/storage';
import {
  Send,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  CheckCheck,
  Eye,
  X,
  Play,
  RotateCw,
  Terminal,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { buildDirectWhatsAppUrl } from '../lib/whatsappService';

interface WhatsAppQueueViewProps {
  outbox: OutboxMessage[];
  lang: SupportedLanguage;
  onRefresh: () => void;
}

export const WhatsAppQueueView: React.FC<WhatsAppQueueViewProps> = ({
  outbox,
  lang,
  onRefresh,
}) => {
  const t = translations[lang];
  const storage = StorageService.getInstance();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedMessage, setSelectedMessage] = useState<OutboxMessage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Test send states
  const [testPhone, setTestPhone] = useState('+91 98421 00001');
  const [testMode, setTestMode] = useState<'template' | 'text'>('template');
  const [testMessage, setTestMessage] = useState('வணக்கம், ஸ்ரீ முருகன் பைனான்ஸ் சோதனை செய்தி (Test Message).');
  const [isSendingTest, setIsSendingTest] = useState(false);

  const filteredMessages = outbox.filter(m => {
    return statusFilter === 'all' || m.status === statusFilter;
  });

  const queuedCount = outbox.filter(m => m.status === 'queued' || m.status === 'processing').length;
  const sentCount = outbox.filter(m => m.status === 'sent' || m.status === 'delivered' || m.status === 'read').length;
  const failedCount = outbox.filter(m => m.status === 'failed').length;

  const handleProcessQueue = async () => {
    setIsProcessing(true);
    setStatusFeedback(null);

    const queuedItems = outbox.filter(m => m.status === 'queued');
    if (queuedItems.length === 0) {
      setStatusFeedback('No pending queued messages to send.');
      setIsProcessing(false);
      return;
    }

    let processedCount = 0;
    const currentOutbox = [...storage.getOutbox()];
    const activeSettings = storage.getSettings();

    for (const item of queuedItems) {
      try {
        const response = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientPhone: item.recipientPhone,
            text: item.renderedText,
            messageType: item.messageType,
            accessToken: activeSettings.whatsappAccessToken,
            phoneNumberId: activeSettings.whatsappPhoneNumberId,
          }),
        });

        const data = await response.json();
        const now = new Date().toISOString();

        const itemIdx = currentOutbox.findIndex(m => m.id === item.id);
        if (itemIdx >= 0) {
          if (data.success) {
            currentOutbox[itemIdx] = {
              ...currentOutbox[itemIdx],
              status: 'delivered',
              whatsappMessageId: data.whatsappMessageId,
              sentAt: now,
              deliveredAt: now,
              attemptCount: currentOutbox[itemIdx].attemptCount + 1,
              updatedAt: now,
            };
            processedCount++;
          } else {
            currentOutbox[itemIdx] = {
              ...currentOutbox[itemIdx],
              status: 'failed',
              lastError: data.diagnostics?.userMessage || data.error || 'API delivery failure',
              attemptCount: currentOutbox[itemIdx].attemptCount + 1,
              updatedAt: now,
            };
          }
        }
      } catch (err: any) {
        console.error('Queue error', err);
      }
    }

    storage.saveOutbox(currentOutbox);
    setStatusFeedback(`Processed ${processedCount} messages successfully via WhatsApp Cloud API proxy.`);
    setIsProcessing(false);
    onRefresh();
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingTest(true);
    setStatusFeedback(null);

    const activeSettings = storage.getSettings();

    try {
      const response = await fetch('/api/whatsapp/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone: testPhone,
          mode: testMode,
          customText: testMessage,
          accessToken: activeSettings.whatsappAccessToken,
          phoneNumberId: activeSettings.whatsappPhoneNumberId,
        }),
      });

      const data = await response.json();
      const now = new Date().toISOString();

      const newMsg: OutboxMessage = {
        id: `msg_test_${Date.now()}`,
        idempotencyKey: `test_${Date.now()}`,
        customerId: 'manual_test',
        customerName: 'Test Recipient',
        recipientPhone: data.recipientPhone || testPhone,
        messageType: 'manual_notice',
        language: lang,
        templateName: testMode === 'template' ? 'hello_world' : 'manual_broadcast_v1',
        renderedText: testMode === 'template' ? '[Meta Template: hello_world]' : testMessage,
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

      const currentOutbox = storage.getOutbox();
      storage.saveOutbox([newMsg, ...currentOutbox]);

      if (data.success) {
        setStatusFeedback(
          `Test message dispatched successfully! Message ID: ${data.whatsappMessageId} ${data.simulated ? '(Simulation Mode)' : '(Live Meta API)'}`
        );
      } else {
        const diag = data.diagnostics;
        const errMsg = diag
          ? `${diag.userMessage} — ${diag.advice}`
          : data.error || 'Delivery failed';
        setStatusFeedback(`Test message delivery failed: ${errMsg}`);
      }
    } catch (err: any) {
      setStatusFeedback(`Exception: ${err.message}`);
    } finally {
      setIsSendingTest(false);
      onRefresh();
    }
  };

  const handleRetryMessage = async (message: OutboxMessage) => {
    const updated = outbox.map(m =>
      m.id === message.id ? { ...m, status: 'queued' as const, attemptCount: 0 } : m
    );
    storage.saveOutbox(updated);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 mb-1">
            <Send className="w-4 h-4" />
            <span>Official WhatsApp Business Cloud API (Transactional Outbox)</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {lang === 'ta' ? 'வாட்ஸ்அப் செய்தி வரிசை & டெலிவரி வரலாறு' : 'WhatsApp Outbox & Delivery Status'}
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            {lang === 'ta'
              ? 'ஞாயிறு தவணை நினைவூட்டல், செவ்வாய் பாக்கி எச்சரிக்கை மற்றும் கட்டண ரசீதுகள். முழுமையாக செலுத்திய தவணைகளுக்கு நினைவூட்டல் தானாக ரத்து செய்யப்படும்.'
              : 'Server-side Meta Cloud API messaging with automatic reminder suppression for fully settled dues and webhook delivery tracking.'}
          </p>
        </div>

        {/* Process Queue CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleProcessQueue}
            disabled={isProcessing || queuedCount === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>
              {isProcessing
                ? 'Processing...'
                : `Process Outbox Queue (${queuedCount} Pending)`}
            </span>
          </button>
        </div>
      </div>

      {statusFeedback && (
        <div className="p-4 bg-slate-900 text-white rounded-xl text-xs flex items-center justify-between font-mono">
          <span>{statusFeedback}</span>
          <button
            onClick={() => setStatusFeedback(null)}
            className="text-xs underline text-slate-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metric Counters */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block">Pending In Queue</span>
          <span className="text-xl font-bold font-mono text-amber-700 tabular-nums">
            {queuedCount}
          </span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block">Delivered Successfully</span>
          <span className="text-xl font-bold font-mono text-emerald-700 tabular-nums">
            {sentCount}
          </span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block">Delivery Failures</span>
          <span className="text-xl font-bold font-mono text-red-700 tabular-nums">
            {failedCount}
          </span>
        </div>
      </div>

      {/* Main Grid: Outbox Table (8 cols) + Test Dispatch Console (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Outbox Table (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Message Queue ({filteredMessages.length})
            </span>
            <div className="flex items-center gap-1">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded p-1 bg-white text-slate-700"
              >
                <option value="all">All Statuses</option>
                <option value="queued">Queued</option>
                <option value="delivered">Delivered</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">Recipient</th>
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">Preview</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMessages.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No messages matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredMessages.map(msg => {
                    const isDelivered = msg.status === 'delivered' || msg.status === 'read';
                    const isQueued = msg.status === 'queued';
                    const isFailed = msg.status === 'failed';

                    return (
                      <tr key={msg.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{msg.customerName}</div>
                          <div className="font-mono text-slate-500 text-[11px]">{msg.recipientPhone}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-slate-800 capitalize">
                            {msg.messageType.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {msg.templateName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="truncate max-w-[200px] text-slate-600 text-[11px]">
                            {msg.renderedText.split('\n')[0]}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isDelivered && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                              <CheckCheck className="w-3.5 h-3.5" />
                              Delivered
                            </span>
                          )}
                          {isQueued && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-semibold">
                              <Clock className="w-3.5 h-3.5" />
                              Queued
                            </span>
                          )}
                          {isFailed && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-red-700 font-semibold">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedMessage(msg)}
                              className="p-1 rounded text-slate-500 hover:text-slate-800"
                              title="View Full Text"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {isFailed && (
                              <button
                                onClick={() => handleRetryMessage(msg)}
                                className="p-1 rounded text-amber-700 hover:text-amber-900 hover:bg-amber-50"
                                title="Re-queue Message"
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Test WhatsApp Dispatch Console (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {lang === 'ta' ? 'வாட்ஸ்அப் நேரடி சோதனை' : 'Live WhatsApp Test Dispatch'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Verify your server credentials or sandbox simulation
            </p>
          </div>

          <form onSubmit={handleSendTestMessage} className="p-4 space-y-3 text-xs flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Recipient Mobile Number</label>
                <input
                  type="text"
                  required
                  placeholder="+91 98421 00001"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  className="w-full font-mono border border-slate-300 rounded-lg p-2 text-slate-900"
                />
                <span className="text-[10px] text-slate-500">
                  {lang === 'ta' ? 'தானாக +91 சேர்க்கப்படும்' : 'Country code 91 automatically formatted'}
                </span>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Message Mode</label>
                <select
                  value={testMode}
                  onChange={e => setTestMode(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-900 bg-white"
                >
                  <option value="template">Meta Template (hello_world) - [Delivers Outside 24h]</option>
                  <option value="text">Custom Text Message - [Requires active 24h window]</option>
                </select>
              </div>

              {testMode === 'text' && (
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Message Body (Tamil / English)</label>
                  <textarea
                    rows={3}
                    required
                    value={testMessage}
                    onChange={e => setTestMessage(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-[11px] space-y-1">
                <span className="font-semibold text-slate-800 block">Automatic Suppression Rule:</span>
                <p>
                  When a customer makes a full repayment for a weekly due, the system sets <code className="font-mono text-emerald-800">remindersSuppressed: true</code> on that due. Future Sunday and Tuesday alerts for that specific week are immediately prevented.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSendingTest}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 mt-4"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSendingTest ? 'Dispatching...' : 'Dispatch Test Message'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* MESSAGE DETAILS MODAL */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">WhatsApp Payload Inspector</h3>
                <span className="text-xs text-slate-500 font-mono">{selectedMessage.idempotencyKey}</span>
              </div>
              <button
                onClick={() => setSelectedMessage(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Recipient</span>
                  <span className="font-semibold text-slate-900">{selectedMessage.customerName}</span>
                  <span className="font-mono text-slate-600 block">{selectedMessage.recipientPhone}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Delivery Status</span>
                  <span className="font-semibold text-emerald-700 uppercase">{selectedMessage.status}</span>
                  <span className="text-[11px] text-slate-500 block font-mono">{selectedMessage.whatsappMessageId || 'Pending'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-700 block">Rendered WhatsApp Text</span>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs whitespace-pre-wrap leading-relaxed">
                  {selectedMessage.renderedText}
                </pre>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              <a
                href={buildDirectWhatsAppUrl(selectedMessage.recipientPhone, selectedMessage.renderedText)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 shadow-xs"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>
                  {lang === 'ta' ? 'வாட்ஸ்அப் ஆப்பில் திறக்க (Direct WhatsApp)' : 'Open in WhatsApp App'}
                </span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={() => setSelectedMessage(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
