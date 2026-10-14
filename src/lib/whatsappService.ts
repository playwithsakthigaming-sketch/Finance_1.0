/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { OutboxMessage, SupportedLanguage } from './types';

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  verifyToken: string;
  enabled: boolean;
  simulationMode: boolean;
}

export interface SendMessageResult {
  success: boolean;
  whatsappMessageId?: string;
  errorMessage?: string;
  simulated?: boolean;
}

/**
 * Format phone number for WhatsApp Cloud API (E.164 without plus or spaces)
 * e.g. "+91 98400 12345" -> "919840012345"
 */
export function sanitizePhoneNumber(phone: string): string {
  let cleaned = (phone || '').replace(/[^0-9]/g, '');
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    cleaned = '91' + cleaned;
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = '91' + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Sends a message via WhatsApp Cloud API or simulates in sandbox
 */
export async function sendWhatsAppMessage(
  config: WhatsAppConfig,
  recipientPhone: string,
  renderedText: string,
  templateName?: string
): Promise<SendMessageResult> {
  const sanitized = sanitizePhoneNumber(recipientPhone);

  if (!config.enabled) {
    return {
      success: false,
      errorMessage: 'WhatsApp automation is currently disabled in settings',
    };
  }

  // If credentials are incomplete or simulation mode is explicitly enabled
  if (config.simulationMode || !config.accessToken || !config.phoneNumberId) {
    // Simulate real network delay between 200ms and 500ms
    await new Promise(r => setTimeout(r, 300));
    return {
      success: true,
      whatsappMessageId: `wamid.SIM_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      simulated: true,
    };
  }

  try {
    const url = `https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: sanitized,
        type: 'text',
        text: {
          preview_url: false,
          body: renderedText,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.error?.message || `WhatsApp API error ${response.status}`;
      return {
        success: false,
        errorMessage: errorMsg,
      };
    }

    const messageId = data?.messages?.[0]?.id || `wamid.RESP_${Date.now()}`;
    return {
      success: true,
      whatsappMessageId: messageId,
      simulated: false,
    };
  } catch (err: any) {
    return {
      success: false,
      errorMessage: err.message || 'Network exception while connecting to WhatsApp Cloud API',
    };
  }
}

/**
 * Generate Sunday Reminder Message Text
 */
export function buildSundayReminderText(params: {
  customerName: string;
  businessName: string;
  businessNameTa: string;
  loanCode: string;
  weekNumber: number;
  dueDate: string;
  dueAmountPaise: number;
  outstandingPaise: number;
  lang: SupportedLanguage;
}): string {
  const dueRupees = (params.dueAmountPaise / 100).toLocaleString('en-IN');
  const outstandingRupees = (params.outstandingPaise / 100).toLocaleString('en-IN');

  if (params.lang === 'ta') {
    return `வணக்கம் ${params.customerName},
${params.businessNameTa} (${params.businessName})

தங்களின் வாராந்திர கடன் தவணை இன்று செலுத்த வேண்டிய நாள்.

கடன் எண் (Loan ID): ${params.loanCode}
வாரம் (Week): ${params.weekNumber}
தவணை தேதி (Due Date): ${params.dueDate} (ஞாயிறு)
இன்றைய தவணை அசல்: ₹${dueRupees}
மொத்த நிலுவை தொகை: ₹${outstandingRupees}

ஏற்கனவே செலுத்தியிருந்தால் இந்த செய்தியை புறக்கணிக்கவும்.
நன்றி!`;
  }

  return `Hello ${params.customerName},
${params.businessName}

Your weekly loan repayment is due today.

Loan ID: ${params.loanCode}
Week Number: ${params.weekNumber}
Due Date: ${params.dueDate} (Sunday)
Principal Due Today: ₹${dueRupees}
Total Outstanding Balance: ₹${outstandingRupees}

If you have already made this payment, please disregard this reminder.
Thank you!`;
}

/**
 * Generate Tuesday Overdue Alert Message Text
 */
export function buildTuesdayOverdueText(params: {
  customerName: string;
  businessName: string;
  businessNameTa: string;
  loanCode: string;
  weekNumber: number;
  dueDate: string;
  remainingPrincipalPaise: number;
  penaltyAssessedPaise: number;
  totalOutstandingPaise: number;
  lang: SupportedLanguage;
}): string {
  const remPrincipal = (params.remainingPrincipalPaise / 100).toLocaleString('en-IN');
  const penalty = (params.penaltyAssessedPaise / 100).toLocaleString('en-IN');
  const total = (params.totalOutstandingPaise / 100).toLocaleString('en-IN');

  if (params.lang === 'ta') {
    return `வணக்கம் ${params.customerName},
${params.businessNameTa} (${params.businessName})

தங்கள் வாராந்திர தவணை தொகை இன்னும் செலுத்தப்படாமல் நிலுவையில் உள்ளது.

கடன் எண் (Loan ID): ${params.loanCode}
வாரம் (Week): ${params.weekNumber}
தவணை நாள் (Due Date): ${params.dueDate}
நிலுவை அசல்: ₹${remPrincipal}
தாமத அபராதக் கட்டணம்: ₹${penalty}
மொத்த நிலுவைத் தொகை: ₹${total}

தயவுசெய்து இன்றே தொடர்புகொண்டு நிலுவையை செலுத்தவும். ஏற்கனவே செலுத்தியிருந்தால் தொடர்பு கொள்ளவும்.
நன்றி!`;
  }

  return `Hello ${params.customerName},
${params.businessName}

Our records show that your weekly loan repayment remains outstanding.

Loan ID: ${params.loanCode}
Week Number: ${params.weekNumber}
Original Due Date: ${params.dueDate}
Remaining Principal: ₹${remPrincipal}
Late Penalty Assessed: ₹${penalty}
Total Outstanding Due: ₹${total}

If you have already paid, please contact us immediately to verify and update the records.
Thank you!`;
}

/**
 * Generate official payment receipt text for WhatsApp
 */
export function buildReceiptWhatsAppText(params: {
  receiptNumber: string;
  customerName: string;
  customerMobile: string;
  loanCode: string;
  amountPaidPaise: number;
  principalAllocationPaise: number;
  penaltyAllocationPaise: number;
  principalBalanceRemainingPaise: number;
  penaltyBalanceRemainingPaise: number;
  totalBalanceRemainingPaise: number;
  paymentMethod: string;
  transactionReference?: string;
  issuedDate: string;
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  lang?: SupportedLanguage;
}): string {
  const bName = params.businessName || 'FINANCE CO';
  const amountPaid = (params.amountPaidPaise / 100).toLocaleString('en-IN');
  const prinAlloc = (params.principalAllocationPaise / 100).toLocaleString('en-IN');
  const penAlloc = (params.penaltyAllocationPaise / 100).toLocaleString('en-IN');
  const prinRem = (params.principalBalanceRemainingPaise / 100).toLocaleString('en-IN');
  const penRem = (params.penaltyBalanceRemainingPaise / 100).toLocaleString('en-IN');
  const totalRem = (params.totalBalanceRemainingPaise / 100).toLocaleString('en-IN');
  const dateStr = new Date(params.issuedDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  if (params.lang === 'ta') {
    return `*${bName} - அதிகாரப்பூர்வ வரவு ரசீது*
----------------------------------------
*ரசீது எண்:* ${params.receiptNumber}
*வாடிக்கையாளர்:* ${params.customerName} (${params.customerMobile})
*கடன் எண்:* ${params.loanCode}
*தேதி:* ${dateStr}

*செலுத்திய தொகை:* ₹${amountPaid}
*செலுத்திய முறை:* ${params.paymentMethod.toUpperCase()}${params.transactionReference ? ` (${params.transactionReference})` : ''}

*வரவு விவரம்:*
• அசல் வரவு: ₹${prinAlloc}
• அபராதம் வரவு: ₹${penAlloc}

*மீதமுள்ள நிலுவைத் தொகை:*
• மீதமுள்ள அசல்: ₹${prinRem}
• மீதமுள்ள அபராதம்: ₹${penRem}
• மொத்த நிலுவை: ₹${totalRem}

தங்கள் கட்டணம் வெற்றிகரமாக வரவு வைக்கப்பட்டது. நன்றி!
${params.businessAddress ? `📍 ${params.businessAddress}` : ''}
${params.businessPhone ? `📞 ${params.businessPhone}` : ''}`.trim();
  }

  return `*${bName} - Official Payment Receipt*
----------------------------------------
*Receipt No:* ${params.receiptNumber}
*Customer:* ${params.customerName} (${params.customerMobile})
*Loan Code:* ${params.loanCode}
*Date:* ${dateStr}

*Amount Received:* ₹${amountPaid}
*Payment Method:* ${params.paymentMethod.toUpperCase()}${params.transactionReference ? ` (${params.transactionReference})` : ''}

*Credit Allocation:*
• Principal Credited: ₹${prinAlloc}
• Penalty Credited: ₹${penAlloc}

*Remaining Balance:*
• Principal Remaining: ₹${prinRem}
• Penalty Remaining: ₹${penRem}
• Total Balance Remaining: ₹${totalRem}

Payment received successfully. Thank you!
${params.businessAddress ? `📍 ${params.businessAddress}` : ''}
${params.businessPhone ? `📞 ${params.businessPhone}` : ''}`.trim();
}

/**
 * Build direct WhatsApp click-to-chat URL (wa.me) for instant guaranteed delivery
 */
export function buildDirectWhatsAppUrl(phone: string, text: string): string {
  const sanitized = sanitizePhoneNumber(phone);
  return `https://api.whatsapp.com/send?phone=${sanitized}&text=${encodeURIComponent(text)}`;
}

