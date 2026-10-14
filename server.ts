/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { runAutomatedTestSuite } from './src/lib/automatedTests.ts';

dotenv.config();

import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// In-memory store for webhook events logged by the server
const webhookEventsLog: any[] = [];

// Ensure data directory exists for persistent settings
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn('[Storage] Could not create data directory:', err);
  }
}
const SETTINGS_FILE_PATH = path.join(DATA_DIR, 'settings.json');

// Default active settings (₹100 penalty for ₹10,000 principal)
const defaultInitialSettings = {
  businessName: process.env.BUSINESS_NAME || 'Sri Murugan Finance',
  businessNameTa: process.env.BUSINESS_NAME_TA || 'ஸ்ரீ முருகன் பைனான்ஸ்',
  businessPhone: process.env.BUSINESS_PHONE || '+91 98400 12345',
  businessAddress: process.env.BUSINESS_ADDRESS || '45 Bazaar Street, Salem, Tamil Nadu, 636001',
  businessAddressTa: '45 பஜார் தெரு, சேலம், தமிழ்நாடு, 636001',
  currencySymbol: '₹',
  timezone: process.env.BUSINESS_TIMEZONE || 'Asia/Kolkata',
  defaultPrincipalPaise: 1000000, // ₹10,000
  defaultDeductionPaise: 150000,  // ₹1,500
  defaultDurationWeeks: 10,
  defaultWeeklyPrincipalPaise: 100000, // ₹1,000
  defaultDueDay: 0,
  defaultPenaltyDay: 2,
  defaultPenaltyPaise: 10000, // ₹100 per ₹10,000 (1%)
  whatsappEnabled: true,
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  whatsappBusinessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'finance_mgmt_verify_token_2026',
  senderStatus: 'simulation_mode',
  sendRemindersAutomatically: true,
  sundayReminderHourIST: 9,
  tuesdayEvaluationHourIST: 10,
  tuesdayAlertHourIST: 11,
};

// Load saved settings if they exist on disk
let activeSettings: any = { ...defaultInitialSettings };
let hasSavedCustomSettings = false;

try {
  if (fs.existsSync(SETTINGS_FILE_PATH)) {
    const raw = fs.readFileSync(SETTINGS_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    activeSettings = { ...defaultInitialSettings, ...parsed };
    hasSavedCustomSettings = true;
    console.log('[Settings API] Loaded saved settings from disk:', activeSettings.businessName);
  }
} catch (err) {
  console.warn('[Settings API] Error loading settings file:', err);
}

// ====================================================================
// SETTINGS API (GET & POST)
// ====================================================================
app.get('/api/settings', (_req: Request, res: Response) => {
  res.json({
    success: true,
    settings: activeSettings,
    hasCustomSettings: hasSavedCustomSettings,
  });
});

app.post('/api/settings', (req: Request, res: Response) => {
  try {
    const updated = req.body;
    activeSettings = {
      ...activeSettings,
      ...updated,
    };
    hasSavedCustomSettings = true;

    // Persist to disk
    try {
      fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(activeSettings, null, 2), 'utf-8');
      console.log('[Settings API] Saved updated settings to disk:', activeSettings.businessName);
    } catch (fsErr) {
      console.warn('[Settings API] Could not write settings to disk:', fsErr);
    }

    res.json({ success: true, settings: activeSettings, hasCustomSettings: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====================================================================
// HEALTH CHECK
// ====================================================================
app.get('/api/health', (_req: Request, res: Response) => {
  const hasToken = Boolean(activeSettings.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN);
  const hasPhone = Boolean(activeSettings.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID);
  res.json({
    status: 'healthy',
    system: activeSettings.businessName,
    timezone: activeSettings.timezone || 'Asia/Kolkata',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    whatsappConfigured: hasToken && hasPhone,
  });
});

// ====================================================================
// WHATSAPP CLOUD API - WEBHOOK VERIFICATION (GET)
// ====================================================================
app.get('/api/whatsapp/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = activeSettings.whatsappVerifyToken || process.env.WHATSAPP_VERIFY_TOKEN || 'finance_mgmt_verify_token_2026';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[WhatsApp Webhook] Verification successful');
    res.status(200).send(challenge);
  } else {
    console.warn('[WhatsApp Webhook] Verification token mismatch');
    res.status(403).json({ error: 'Verification token invalid' });
  }
});

// ====================================================================
// WHATSAPP CLOUD API - WEBHOOK EVENT HANDLER (POST)
// ====================================================================
app.post('/api/whatsapp/webhook', (req: Request, res: Response) => {
  try {
    const body = req.body;
    console.log('[WhatsApp Webhook] Received event:', JSON.stringify(body, null, 2));

    const eventRecord = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      receivedAt: new Date().toISOString(),
      payload: body,
      processed: true,
    };
    webhookEventsLog.unshift(eventRecord);
    if (webhookEventsLog.length > 50) {
      webhookEventsLog.pop();
    }

    // Acknowledge Meta with 200 immediately
    res.status(200).send('EVENT_RECEIVED');
  } catch (err: any) {
    console.error('[WhatsApp Webhook Error]', err);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

app.get('/api/whatsapp/webhook/events', (_req: Request, res: Response) => {
  res.json({ events: webhookEventsLog });
});

// ====================================================================
// SERVER-SIDE WHATSAPP SEND PROXY (Keeps secrets safe on server)
// Helper to format recipient phone for Meta WhatsApp Cloud API (E.164 format without plus or spaces)
function formatRecipientPhoneForMeta(rawPhone: string): string {
  let cleaned = (rawPhone || '').replace(/[^0-9]/g, '');
  // If 10 digits starting with 6, 7, 8, 9 (standard Indian mobile numbers), prepend '91'
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    cleaned = '91' + cleaned;
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = '91' + cleaned.slice(1);
  }
  return cleaned;
}

// Helper to provide friendly diagnostics for Meta WhatsApp API errors
function getMetaErrorDiagnostics(metaData: any, sanitizedPhone: string) {
  const code = metaData?.error?.code;
  const subcode = metaData?.error?.error_subcode;
  const rawMessage = metaData?.error?.message || '';

  if (code === 131030) {
    return {
      errorCode: 131030,
      userMessage: `Meta Sandbox Allowed List Restriction: Recipient number (+${sanitizedPhone}) is not in your allowed list.`,
      userMessageTa: `மெட்டா சோதனை கட்டுப்பாடு: வாட்ஸ்அப் எண் (+${sanitizedPhone}) அனுமதிக்கப்பட்ட பட்டியலில் இல்லை.`,
      advice: `In Meta Developer Portal > WhatsApp > API Setup > Step 2: Click 'Manage phone number list', add +${sanitizedPhone}, and enter the OTP to verify it.`,
      adviceTa: `Meta Developer Portal > WhatsApp > API Setup > Step 2-ல் 'Manage phone number list' திறந்து +${sanitizedPhone} எண்ணைச் சேர்த்து OTP சரிபார்க்கவும்.`,
    };
  }

  if (code === 131047) {
    return {
      errorCode: 131047,
      userMessage: `Meta 24-Hour Policy Window: Customer has not replied to this business number within the last 24 hours.`,
      userMessageTa: `24 மணி நேர வாட்ஸ்அப் விதிமுறை: வாடிக்கையாளர் கடந்த 24 மணி நேரத்திற்குள் இந்த பிசினஸ் எண்ணிற்கு செய்தி அனுப்பவில்லை.`,
      advice: `Send a 'Hi' from your WhatsApp (+${sanitizedPhone}) to your WhatsApp Business number to open the 24-hour window, or send using the pre-approved 'hello_world' template.`,
      adviceTa: `உங்கள் மொபைலிலிருந்து (+${sanitizedPhone}) உங்கள் பிசினஸ் வாட்ஸ்அப் எண்ணிற்கு 'Hi' என்று ஒரு செய்தி அனுப்பவும், அல்லது 'hello_world' டெம்ப்ளேட்டைத் தேர்வுசெய்து அனுப்பவும்.`,
    };
  }

  if (code === 190) {
    return {
      errorCode: 190,
      userMessage: `Meta Access Token Expired or Invalid.`,
      userMessageTa: `மெட்டா அணுகல் டோக்கன் (Access Token) காலாவதியாகிவிட்டது அல்லது தவறானது.`,
      advice: `Generate a new permanent System User Token in Meta Business Manager with 'whatsapp_business_messaging' permission.`,
      adviceTa: `Meta Business Manager-ல் புதிய System User Token உருவாக்கி சேமிக்கவும்.`,
    };
  }

  if (code === 100) {
    return {
      errorCode: 100,
      userMessage: `Invalid Parameter or Phone Number: ${rawMessage}`,
      userMessageTa: `தவறான தொலைபேசி எண் அல்லது அளவுரு: ${rawMessage}`,
      advice: `Ensure recipient phone includes country code (e.g. +91 98421 12345) and is a valid WhatsApp mobile number.`,
      adviceTa: `நாட்டின் குறியீட்டுடன் (+91) சரியான வாட்ஸ்அப் எண்ணை உள்ளிடவும்.`,
    };
  }

  return {
    errorCode: code || 0,
    userMessage: rawMessage || 'Meta WhatsApp Cloud API error',
    userMessageTa: rawMessage || 'மெட்டா வாட்ஸ்அப் ஏபிஐ பிழை',
    advice: 'Verify Phone Number ID, Access Token, and ensure recipient phone number is active on WhatsApp.',
    adviceTa: 'Settings-ல் Phone Number ID மற்றும் Access Token சரியாக உள்ளதா என உறுதிப்படுத்தவும்.',
  };
}

// ====================================================================
// SERVER-SIDE WHATSAPP SEND PROXY (Keeps secrets safe on server)
// ====================================================================
app.post('/api/whatsapp/send', async (req: Request, res: Response) => {
  try {
    const {
      recipientPhone,
      text,
      messageType,
      useTemplate,
      templateName,
      templateLanguage,
      accessToken: reqToken,
      phoneNumberId: reqPhoneId,
    } = req.body;

    if (!recipientPhone) {
      return res.status(400).json({ error: 'recipientPhone is required' });
    }

    // Automatically synchronize credentials if passed from client
    let credentialsChanged = false;
    if (reqToken && reqToken.trim() && activeSettings.whatsappAccessToken !== reqToken.trim()) {
      activeSettings.whatsappAccessToken = reqToken.trim();
      credentialsChanged = true;
    }
    if (reqPhoneId && reqPhoneId.trim() && activeSettings.whatsappPhoneNumberId !== reqPhoneId.trim()) {
      activeSettings.whatsappPhoneNumberId = reqPhoneId.trim();
      credentialsChanged = true;
    }
    if (credentialsChanged) {
      try {
        fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(activeSettings, null, 2), 'utf-8');
        console.log('[Server] Persisted updated WhatsApp credentials to disk.');
      } catch (e) {
        console.warn('Could not persist updated tokens to settings file:', e);
      }
    }

    const accessToken = reqToken || activeSettings.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = reqPhoneId || activeSettings.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    // Sanitize phone: format for India (+91) if 10 digits
    const sanitizedTo = formatRecipientPhoneForMeta(recipientPhone);

    // If server environment credentials are missing, perform simulated delivery
    if (!accessToken || !phoneNumberId) {
      const simulatedId = `wamid.SIM_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      console.log(`[WhatsApp Sandbox] Simulated send to ${sanitizedTo}: "${(text || 'Template').slice(0, 40)}..."`);
      return res.json({
        success: true,
        whatsappMessageId: simulatedId,
        simulated: true,
        recipientPhone: sanitizedTo,
        status: 'delivered',
        note: 'Simulation mode: To send real WhatsApp messages, enter your WhatsApp Access Token and Phone Number ID in Settings.',
      });
    }

    // Call real Meta WhatsApp Business Cloud API
    const metaUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

    // Construct payload: template or text
    let payload: any;
    if (useTemplate || templateName) {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: sanitizedTo,
        type: 'template',
        template: {
          name: templateName || 'hello_world',
          language: {
            code: templateLanguage || 'en_US',
          },
        },
      };
    } else {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: sanitizedTo,
        type: 'text',
        text: {
          preview_url: false,
          body: text || 'Hello from Finance Management System',
        },
      };
    }

    const metaResponse = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const metaData: any = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error('[WhatsApp Cloud API Error]', metaData);
      const diagnostics = getMetaErrorDiagnostics(metaData, sanitizedTo);
      return res.status(metaResponse.status).json({
        success: false,
        error: metaData?.error?.message || 'Meta API returned error',
        metaCode: metaData?.error?.code,
        diagnostics,
        recipientPhone: sanitizedTo,
      });
    }

    const messageId = metaData?.messages?.[0]?.id || `wamid.LIVE_${Date.now()}`;
    console.log(`[WhatsApp Live] Message sent successfully to ${sanitizedTo}, id: ${messageId}`);
    return res.json({
      success: true,
      whatsappMessageId: messageId,
      simulated: false,
      recipientPhone: sanitizedTo,
      status: 'sent',
    });
  } catch (err: any) {
    console.error('[WhatsApp Send Route Error]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ====================================================================
// TEST CONNECTION ENDPOINT
// ====================================================================
app.post('/api/whatsapp/test-connection', async (req: Request, res: Response) => {
  const reqToken = req.body.accessToken?.trim();
  const reqPhoneId = req.body.phoneNumberId?.trim();

  let credentialsChanged = false;
  if (reqToken && activeSettings.whatsappAccessToken !== reqToken) {
    activeSettings.whatsappAccessToken = reqToken;
    credentialsChanged = true;
  }
  if (reqPhoneId && activeSettings.whatsappPhoneNumberId !== reqPhoneId) {
    activeSettings.whatsappPhoneNumberId = reqPhoneId;
    credentialsChanged = true;
  }
  if (credentialsChanged) {
    try {
      fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(activeSettings, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Could not persist updated tokens in test connection:', e);
    }
  }

  const accessToken = reqToken || activeSettings.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = reqPhoneId || activeSettings.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    return res.json({
      connected: false,
      status: 'not_configured',
      message: 'WhatsApp Access Token or Phone Number ID is not configured. Simulation mode is currently active.',
    });
  }

  try {
    const metaUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}?fields=verified_name,code_verification_status,display_phone_number,quality_rating`;
    const response = await fetch(metaUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data: any = await response.json();

    if (!response.ok) {
      return res.json({
        connected: false,
        status: 'error',
        error: data?.error?.message || 'Failed to authenticate with Meta Graph API',
      });
    }

    // If test succeeded and caller provided tokens, keep activeSettings updated and persist
    if (reqToken && reqPhoneId) {
      activeSettings.whatsappAccessToken = reqToken;
      activeSettings.whatsappPhoneNumberId = reqPhoneId;
      try {
        fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(activeSettings, null, 2), 'utf-8');
      } catch (e) {
        console.warn('Could not persist verified tokens:', e);
      }
    }

    return res.json({
      connected: true,
      status: 'connected',
      details: {
        verifiedName: data.verified_name,
        displayPhoneNumber: data.display_phone_number,
        qualityRating: data.quality_rating,
      },
    });
  } catch (err: any) {
    return res.json({
      connected: false,
      status: 'error',
      error: err.message || 'Network error reaching Meta API',
    });
  }
});

// ====================================================================
// DEDICATED LIVE TEST MESSAGE SENDER
// ====================================================================
app.post('/api/whatsapp/send-test', async (req: Request, res: Response) => {
  try {
    const {
      recipientPhone,
      mode = 'template', // 'template' (hello_world) or 'text'
      customText,
      accessToken: reqToken,
      phoneNumberId: reqPhoneId,
    } = req.body;

    if (!recipientPhone) {
      return res.status(400).json({ error: 'recipientPhone is required' });
    }

    const accessToken = reqToken || activeSettings.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = reqPhoneId || activeSettings.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    const sanitizedTo = formatRecipientPhoneForMeta(recipientPhone);

    if (!accessToken || !phoneNumberId) {
      return res.json({
        success: true,
        whatsappMessageId: `wamid.SIM_${Date.now()}`,
        simulated: true,
        recipientPhone: sanitizedTo,
        message: 'Simulation mode: Saved to simulated sandbox. Enter your Meta credentials to send real messages to WhatsApp.',
      });
    }

    const metaUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

    let payload: any;
    if (mode === 'template') {
      // Send pre-approved hello_world template (bypasses 24h customer window restriction)
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: sanitizedTo,
        type: 'template',
        template: {
          name: 'hello_world',
          language: { code: 'en_US' },
        },
      };
    } else {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: sanitizedTo,
        type: 'text',
        text: {
          preview_url: false,
          body: customText || `வணக்கம், ஸ்ரீ முருகன் பைனான்ஸ் சோதனை செய்தி (Test Message). தேதி: ${new Date().toLocaleDateString('en-IN')}`,
        },
      };
    }

    const response = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const metaData: any = await response.json();

    if (!response.ok) {
      const diagnostics = getMetaErrorDiagnostics(metaData, sanitizedTo);
      return res.status(response.status).json({
        success: false,
        error: metaData?.error?.message || 'Meta API returned error',
        metaCode: metaData?.error?.code,
        diagnostics,
        recipientPhone: sanitizedTo,
      });
    }

    const messageId = metaData?.messages?.[0]?.id || `wamid.LIVE_${Date.now()}`;
    return res.json({
      success: true,
      whatsappMessageId: messageId,
      simulated: false,
      recipientPhone: sanitizedTo,
      mode,
      message: `Test message successfully sent via Meta Cloud API to +${sanitizedTo}! Check your WhatsApp.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ====================================================================
// AUTOMATED TEST SUITE RUNNER API
// ====================================================================
app.get('/api/tests/run', (_req: Request, res: Response) => {
  const report = runAutomatedTestSuite();
  res.json(report);
});

// ====================================================================
// VITE OR STATIC SERVING
// ====================================================================
async function startServer() {
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Finance Management System running on http://0.0.0.0:${PORT}`);
    console.log(`Timezone: Asia/Kolkata`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
