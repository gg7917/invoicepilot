import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage, verifyPassword, DEMO_BUSINESS_ID } from './server/storage.js';
import { LastAgentRunSummary, BusinessUser } from './types/invoice.js';
import {
  extractInvoiceFromMessage,
  heuristicExtract,
  generateOverdueReminder,
  analyzeClientReply,
  askFinancialAdvisor,
} from './server/gemini.js';
import {
  getPayPalCredentials,
  createAndSendPayPalInvoice,
  fetchPayPalInvoiceStatus,
  searchPayPalInvoices,
  REAL_PAYPAL_ID_REGEX,
} from './server/paypal.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AuthenticatedRequest extends Request {
  business?: BusinessUser;
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const cookies: Record<string, string> = {};
  header.split(';').forEach((item) => {
    const [key, ...v] = item.trim().split('=');
    if (key) cookies[key] = decodeURIComponent(v.join('='));
  });
  return cookies;
}

function getAuthenticatedBusiness(req: Request): BusinessUser | null {
  // 1. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }
  // 2. Check X-Session-Token header
  if (!token && typeof req.headers['x-session-token'] === 'string') {
    token = req.headers['x-session-token'].trim();
  }
  // 3. Check query param
  if (!token && typeof req.query.token === 'string') {
    token = req.query.token.trim();
  }
  // 4. Check cookies
  if (!token) {
    const cookies = parseCookies(req);
    token = cookies['nudgepay_session'];
  }

  if (!token) return null;
  const session = storage.getSession(token);
  if (!session) return null;
  const business = storage.findBusinessById(session.businessId);
  return business || null;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const business = getAuthenticatedBusiness(req);
  if (!business) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  req.business = business;
  next();
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '10mb' }));

  // ==========================================
  // AUTHENTICATION ROUTES
  // ==========================================

  // Check current session
  app.get('/api/auth/me', (req: Request, res: Response) => {
    const business = getAuthenticatedBusiness(req);
    if (!business) {
      return res.json({ authenticated: false, business: null });
    }
    const authHeader = req.headers.authorization;
    let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;
    if (!token) {
      token = parseCookies(req)['nudgepay_session'];
    }
    res.json({ authenticated: true, business, token });
  });

  // Sign up new business account
  app.post('/api/auth/signup', (req: Request, res: Response) => {
    try {
      const { email, password, businessName } = req.body;

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'A valid email address is required.' });
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }
      if (!businessName || typeof businessName !== 'string' || businessName.trim().length === 0) {
        return res.status(400).json({ error: 'Business name is required.' });
      }

      const existing = storage.findBusinessByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'An account with this email already exists. Please log in.' });
      }

      const business = storage.createBusiness(email, password, businessName);
      const session = storage.createSession(business.id);

      // Set cookie (supporting both secure iframe and standard)
      res.setHeader(
        'Set-Cookie',
        `nudgepay_session=${session.token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${30 * 24 * 60 * 60}`
      );

      res.status(201).json({
        success: true,
        token: session.token,
        business,
        message: `Welcome, ${business.businessName}!`,
      });
    } catch (err: any) {
      console.error('Signup error:', err);
      res.status(500).json({ error: err.message || 'Failed to sign up.' });
    }
  });

  // Log in existing business account
  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const businessRecord = storage.findBusinessRecordByEmail(email);
      if (!businessRecord) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const isValid = verifyPassword(password, businessRecord.passwordSalt, businessRecord.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const session = storage.createSession(businessRecord.id);

      res.setHeader(
        'Set-Cookie',
        `nudgepay_session=${session.token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${30 * 24 * 60 * 60}`
      );

      const business: BusinessUser = {
        id: businessRecord.id,
        email: businessRecord.email,
        businessName: businessRecord.businessName,
        createdAt: businessRecord.createdAt,
      };

      res.json({
        success: true,
        token: session.token,
        business,
        message: `Logged in as ${business.businessName}`,
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: err.message || 'Failed to log in.' });
    }
  });

  // Log out
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;
    if (!token) {
      const cookies = parseCookies(req);
      token = cookies['nudgepay_session'];
    }
    if (token) {
      storage.deleteSession(token);
    }
    res.setHeader('Set-Cookie', 'nudgepay_session=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0');
    res.json({ success: true, message: 'Logged out successfully.' });
  });

  // ==========================================
  // CONFIGURATION & STATUS
  // ==========================================

  // API Config Status (Public check for status bar)
  app.get('/api/config-status', (req: Request, res: Response) => {
    const paypal = getPayPalCredentials();
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());

    res.json({
      hasPayPalClientId: Boolean(paypal.clientId),
      hasPayPalSecret: Boolean(paypal.clientSecret),
      hasGeminiKey,
      isSandboxReady: paypal.isConfigured,
    });
  });

  // ==========================================
  // PUBLIC CUSTOMER PAYMENT & INVOICE ROUTES (NO LOGIN REQUIRED)
  // ==========================================

  // Public customer view of a single invoice
  app.get('/api/public/pay/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const data = storage.getInvoiceByPayToken(token);
      if (!data) {
        return res.status(404).json({ error: 'Invoice not found. Please verify your payment link.' });
      }

      const { invoice, businessName } = data;

      // Auto-sync status with PayPal sandbox if Sent/Overdue and has PayPal invoice ID
      if (invoice.paypalInvoiceId && (invoice.status === 'Sent' || invoice.status === 'Overdue')) {
        try {
          const ppStatus = await fetchPayPalInvoiceStatus(invoice.paypalInvoiceId);
          if (ppStatus && ppStatus.success && ppStatus.status) {
            invoice.rawPayPalStatus = ppStatus.status;
            if (ppStatus.status === 'Paid') {
              invoice.status = 'Paid';
              invoice.updatedAt = new Date().toISOString();
              storage.updateInvoice(
                invoice.id,
                {
                  status: 'Paid',
                  rawPayPalStatus: ppStatus.status,
                },
                invoice.businessId || DEMO_BUSINESS_ID
              );
              storage.addActivity(
                {
                  invoiceId: invoice.id,
                  invoiceNumber: invoice.invoiceNumber,
                  action: 'status_checked',
                  description: `Payment received for Invoice ${invoice.invoiceNumber} via PayPal Sandbox (Status: ${ppStatus.status})`,
                },
                invoice.businessId || DEMO_BUSINESS_ID
              );
            }
          }
        } catch (syncErr) {
          // Non-blocking sync failure
        }
      }

      // Return public-safe payload only
      const publicInvoice = {
        payToken: invoice.payToken || token,
        businessName: businessName || 'NudgePay Business',
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        description: invoice.description,
        lineItems: invoice.lineItems || [],
        amount: invoice.amount,
        currency: invoice.currency || 'USD',
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        status: invoice.status,
        paypalPaymentLink: invoice.paypalPaymentLink,
        notes: invoice.notes,
        clientMessages: invoice.clientMessages || [],
      };

      res.json(publicInvoice);
    } catch (err: any) {
      console.error('Public invoice fetch error:', err);
      res.status(500).json({ error: 'Failed to retrieve invoice details.' });
    }
  });

  // Public customer message to business
  app.post('/api/public/pay/:token/message', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const { message } = req.body;

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message cannot be empty.' });
      }

      const result = storage.addClientMessage(token, message);
      if (!result) {
        return res.status(404).json({ error: 'Invoice not found. Message could not be delivered.' });
      }

      // Trigger Gemini AI reply analysis in background so business owner gets AI suggestions
      (async () => {
        try {
          const analysis = await analyzeClientReply(result.invoice, message.trim());
          const businessId = result.invoice.businessId || DEMO_BUSINESS_ID;
          storage.addActivity(
            {
              invoiceId: result.invoice.id,
              invoiceNumber: result.invoice.invoiceNumber,
              action: 'reply_analyzed',
              description: `Gemini AI analyzed customer message for ${result.invoice.invoiceNumber}: "${analysis.intent}"`,
              metadata: {
                intent: analysis.intent,
                sentiment: analysis.sentiment,
                suggestedDueDate: analysis.suggestedDueDate,
                hasSplit: Boolean(analysis.suggestedSplit),
                suggestedResponse: analysis.suggestedResponse,
              },
            },
            businessId
          );
        } catch (err) {
          console.warn('Background AI reply analysis error:', err);
        }
      })();

      res.status(201).json({
        success: true,
        message: result.message,
        clientMessages: result.invoice.clientMessages || [],
      });
    } catch (err: any) {
      console.error('Public customer message error:', err);
      res.status(500).json({ error: 'Failed to send message.' });
    }
  });

  // ==========================================
  // PROTECTED BUSINESS INVOICE ROUTES
  // ==========================================

  // Get Invoices + Summary for logged-in business
  app.get('/api/invoices', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const invoices = storage.getInvoices(businessId);
      const summary = storage.getSummary(businessId);
      res.json({ invoices, summary });
    } catch (err: any) {
      console.error('Failed to get invoices:', err);
      res.status(500).json({ error: err.message || 'Failed to get invoices' });
    }
  });

  // Get Single Invoice + its Activity
  app.get('/api/invoices/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const invoice = storage.getInvoiceById(req.params.id, businessId);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      const activity = storage.getActivityLogs(businessId, invoice.id);
      res.json({ invoice, activity });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch invoice' });
    }
  });

  // Extract Invoice Details from Client Message using Gemini
  app.post('/api/invoices/extract', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { message } = req.body;
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'Please provide a message to extract invoice from.' });
      }

      const extracted = await extractInvoiceFromMessage(message);
      res.json(extracted);
    } catch (err: any) {
      console.error('Extraction error on server, engaging heuristic fallback:', err);
      try {
        const fallback = heuristicExtract(req.body?.message || '');
        res.json({
          ...fallback,
          usedFallback: true,
          warning: 'Invoice details extracted using offline smart parser. Please review and verify values.',
        });
      } catch (fallbackErr) {
        res.status(500).json({
          error: err.message || 'Failed to extract invoice from message.',
        });
      }
    }
  });

  // Create New Invoice
  app.post('/api/invoices', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const {
        clientName,
        clientEmail,
        description,
        lineItems,
        amount,
        dueDate,
        issueDate,
        notes,
        rawClientMessage,
      } = req.body;

      if (!clientName || !amount) {
        return res.status(400).json({ error: 'Client name and amount are required.' });
      }

      const today = new Date().toISOString().split('T')[0];

      const newInvoice = storage.createInvoice(
        {
          clientName,
          clientEmail: clientEmail || '',
          description: description || 'Professional Services',
          lineItems: Array.isArray(lineItems) ? lineItems : [],
          amount: Number(amount) || 0,
          currency: 'USD',
          issueDate: issueDate || today,
          dueDate: dueDate || today,
          status: 'Draft',
          notes: notes || '',
          rawClientMessage: rawClientMessage || '',
        },
        businessId
      );

      res.status(201).json(newInvoice);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create invoice' });
    }
  });

  // Update Invoice
  app.put('/api/invoices/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const updated = storage.updateInvoice(req.params.id, req.body, businessId);
      if (!updated) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update invoice' });
    }
  });

  // Delete Invoice
  app.delete('/api/invoices/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const success = storage.deleteInvoice(req.params.id, businessId);
      if (!success) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete invoice' });
    }
  });

  // Approve and Send via PayPal Invoicing API (SANDBOX)
  app.post('/api/invoices/:id/approve-and-send', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const invoice = storage.getInvoiceById(req.params.id, businessId);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Log explicit user approval
      storage.addActivity(
        {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          action: 'approved',
          description: `User approved invoice ${invoice.invoiceNumber} for $${invoice.amount.toFixed(2)} to ${invoice.clientName}`,
        },
        businessId
      );

      // Execute PayPal Sandbox dispatch
      const paypalResult = await createAndSendPayPalInvoice(invoice);

      const finalInvoiceNumber = paypalResult.updatedInvoiceNumber || invoice.invoiceNumber;
      const updated = storage.updateInvoice(
        invoice.id,
        {
          status: 'Sent',
          invoiceNumber: finalInvoiceNumber,
          paypalInvoiceId: paypalResult.paypalInvoiceId,
          paypalPaymentLink: paypalResult.paypalPaymentLink,
          paypalSellerLink: paypalResult.paypalSellerLink,
        },
        businessId
      );

      storage.addActivity(
        {
          invoiceId: invoice.id,
          invoiceNumber: finalInvoiceNumber,
          action: 'sent',
          description: paypalResult.isSimulated
            ? `Sent in PayPal Sandbox Simulation Mode. ID: ${paypalResult.paypalInvoiceId}`
            : `Dispatched live via PayPal Sandbox API. Invoice ID: ${paypalResult.paypalInvoiceId} (Invoice: ${finalInvoiceNumber})`,
          metadata: {
            paypalInvoiceId: paypalResult.paypalInvoiceId,
            paypalPaymentLink: paypalResult.paypalPaymentLink,
            paypalSellerLink: paypalResult.paypalSellerLink,
            isSimulated: paypalResult.isSimulated,
          },
        },
        businessId
      );

      res.json({
        invoice: updated,
        paypalResult,
      });
    } catch (err: any) {
      console.error('Approve and send error:', err);
      res.status(500).json({
        error: err.message || 'Failed to approve and send invoice via PayPal Sandbox',
      });
    }
  });

  // Mark as Paid
  app.post('/api/invoices/:id/mark-paid', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const invoice = storage.getInvoiceById(req.params.id, businessId);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const updated = storage.updateInvoice(
        invoice.id,
        {
          status: 'Paid',
        },
        businessId
      );

      storage.addActivity(
        {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          action: 'paid',
          description: `Payment of $${invoice.amount.toFixed(2)} confirmed and recorded.`,
        },
        businessId
      );

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update invoice status' });
    }
  });

  // Draft Overdue Reminder using Gemini AI
  app.post('/api/invoices/:id/draft-reminder', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const invoice = storage.getInvoiceById(req.params.id, businessId);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const draft = await generateOverdueReminder(invoice, undefined, baseUrl);

      storage.addActivity(
        {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          action: 'reminder_drafted',
          description: `Gemini AI drafted ${draft.toneLabel} for ${invoice.clientName} ($${invoice.amount.toFixed(2)})`,
          metadata: {
            tone: draft.tone,
            daysOverdue: draft.daysOverdue,
            subject: draft.subject,
          },
        },
        businessId
      );

      res.json(draft);
    } catch (err: any) {
      console.error('Draft reminder error:', err);
      res.status(500).json({ error: err.message || 'Failed to draft reminder' });
    }
  });

  // Send Overdue Reminder (User must approve)
  app.post('/api/invoices/:id/send-reminder', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const invoice = storage.getInvoiceById(req.params.id, businessId);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const { subject, body, recipientEmail, tone } = req.body;
      const recipient = recipientEmail || invoice.clientEmail || 'client';
      const now = new Date().toISOString();

      const updated = storage.updateInvoice(
        invoice.id,
        {
          lastReminderSentAt: now,
          remindersCount: (invoice.remindersCount || 0) + 1,
        },
        businessId
      );

      storage.addActivity(
        {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          action: 'reminder_sent',
          description: `User approved and dispatched ${tone || 'overdue'} reminder to ${recipient} for Invoice ${invoice.invoiceNumber}`,
          metadata: {
            recipient,
            subject,
            tone,
            bodySnippet: typeof body === 'string' ? body.substring(0, 120) : '',
          },
        },
        businessId
      );

      res.json({
        success: true,
        message: `Reminder sent to ${recipient}`,
        invoice: updated,
      });
    } catch (err: any) {
      console.error('Send reminder error:', err);
      res.status(500).json({ error: err.message || 'Failed to send reminder' });
    }
  });

  function getClientDisplayName(clientName: string): string {
    const parenMatch = clientName.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1]) {
      return parenMatch[1].trim();
    }
    return clientName.replace(/\[Demo\]/gi, '').trim();
  }

  // Agent Run: Scan all invoices for current business, find Sent + overdue invoices, draft reminders,
  // place in Approval queue, avoid duplicate pending drafts, log decisions.
  app.post('/api/agent/run', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const today = new Date().toISOString().split('T')[0];
      const invoices = storage.getInvoices(businessId);

      // Find invoices that are Sent (or Overdue) and past due date
      const overdueInvoices = invoices.filter(
        (inv) => (inv.status === 'Overdue' || inv.status === 'Sent') && inv.dueDate < today
      );

      let newDraftsCount = 0;
      let alreadyDraftedCount = 0;
      const createdDrafts: any[] = [];

      for (const inv of overdueInvoices) {
        if (storage.hasPendingDraftForInvoice(inv.id, businessId)) {
          alreadyDraftedCount++;
          continue;
        }

        const refTime = new Date(today).getTime();
        const dueTime = new Date(inv.dueDate).getTime();
        const daysOverdue = Math.max(1, Math.round((refTime - dueTime) / 86400000));

        let tone: 'friendly' | 'firm' | 'final' = 'friendly';
        if (daysOverdue >= 22) tone = 'final';
        else if (daysOverdue >= 8) tone = 'firm';

        const clientDisplayName = getClientDisplayName(inv.clientName);
        const reasoning = `Invoice for ${clientDisplayName} is ${daysOverdue} days overdue, drafted a ${tone} reminder`;

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const draftContent = await generateOverdueReminder(inv, today, baseUrl);

        const approvalDraft = storage.addApprovalDraft(
          {
            id: `draft-${inv.id}-${Date.now()}`,
            businessId,
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            clientName: inv.clientName,
            clientEmail: inv.clientEmail,
            amount: inv.amount,
            currency: 'USD',
            dueDate: inv.dueDate,
            daysOverdue,
            tone,
            toneLabel: draftContent.toneLabel,
            subject: draftContent.subject,
            body: draftContent.body,
            paymentLink: draftContent.paymentLink,
            reasoning,
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
          businessId
        );

        storage.addActivity(
          {
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            action: 'reminder_drafted',
            description: reasoning,
            metadata: {
              agentRun: true,
              daysOverdue,
              tone,
              subject: draftContent.subject,
              draftId: approvalDraft.id,
              reasoning,
            },
          },
          businessId
        );

        createdDrafts.push(approvalDraft);
        newDraftsCount++;
      }

      const allPending = storage.getApprovalQueue(businessId, 'pending');

      storage.addActivity(
        {
          action: 'agent_scan',
          description:
            newDraftsCount > 0
              ? `Collections agent scanned ${invoices.length} invoices: drafted ${newDraftsCount} reminder(s) for approval.`
              : alreadyDraftedCount > 0
              ? `Collections agent scanned ${invoices.length} invoices: ${alreadyDraftedCount} overdue invoice(s) already have pending drafts in the approval queue.`
              : `Collections agent scanned ${invoices.length} invoices: no overdue invoices found.`,
          metadata: {
            scannedCount: invoices.length,
            overdueCount: overdueInvoices.length,
            newDraftsCount,
            alreadyDraftedCount,
            totalPending: allPending.length,
          },
        },
        businessId
      );

      const lastAgentRun: LastAgentRunSummary = {
        businessId,
        timestamp: new Date().toISOString(),
        overdueCount: overdueInvoices.length,
        draftsCreatedCount: newDraftsCount,
        scannedCount: invoices.length,
        draftsReasoning: allPending.map((d) => {
          const parenMatch = d.clientName.match(/\((.*?)\)/);
          const rawName = parenMatch ? parenMatch[1] : d.clientName;
          const cleanName = rawName.replace(/^Dr\.\s*/i, '');
          const shortName = cleanName.split(' ')[0] || d.clientName;
          return {
            clientName: d.clientName,
            invoiceNumber: d.invoiceNumber,
            daysOverdue: d.daysOverdue,
            tone: d.tone,
            line: `${shortName}: ${d.daysOverdue} days overdue, ${d.tone} tone`,
          };
        }),
      };
      storage.setLastAgentRun(businessId, lastAgentRun);

      res.json({
        success: true,
        scannedCount: invoices.length,
        overdueCount: overdueInvoices.length,
        newDraftsCount,
        alreadyDraftedCount,
        createdDrafts,
        pendingDrafts: allPending,
        lastAgentRun,
        message:
          newDraftsCount > 0
            ? `Collections agent drafted ${newDraftsCount} overdue reminder(s) for your approval.`
            : alreadyDraftedCount > 0
            ? `Collections agent found ${alreadyDraftedCount} overdue invoice(s); drafts are already pending in your Approval Queue.`
            : 'Collections agent scanned all invoices. No overdue invoices found.',
      });
    } catch (err: any) {
      console.error('Agent run error:', err);
      res.status(500).json({ error: err.message || 'Collections agent run failed' });
    }
  });

  // Get approval queue for current business
  app.get('/api/agent/queue', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const pendingDrafts = storage.getApprovalQueue(businessId, 'pending');
      const allDrafts = storage.getApprovalQueue(businessId);
      const lastAgentRun = storage.getLastAgentRun(businessId);
      res.json({
        pendingDrafts,
        totalPending: pendingDrafts.length,
        totalHistorical: allDrafts.length,
        lastAgentRun,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch approval queue' });
    }
  });

  // 1-Click Approve and send a single draft
  app.post('/api/agent/queue/:id/approve', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const draft = storage.getApprovalDraftById(req.params.id, businessId);
      if (!draft) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      const { subject, body, recipientEmail } = req.body;
      const finalSubject = subject || draft.subject;
      const finalBody = body || draft.body;
      const recipient = recipientEmail || draft.clientEmail;

      const invoice = storage.getInvoiceById(draft.invoiceId, businessId);
      const now = new Date().toISOString();

      if (invoice) {
        storage.updateInvoice(
          invoice.id,
          {
            lastReminderSentAt: now,
            remindersCount: (invoice.remindersCount || 0) + 1,
          },
          businessId
        );
      }

      const updatedDraft = storage.updateApprovalDraft(
        draft.id,
        {
          status: 'approved',
          subject: finalSubject,
          body: finalBody,
          clientEmail: recipient,
          reviewedAt: now,
        },
        businessId
      );

      storage.addActivity(
        {
          invoiceId: draft.invoiceId,
          invoiceNumber: draft.invoiceNumber,
          action: 'reminder_sent',
          description: `User approved and sent ${draft.tone} reminder for Invoice ${draft.invoiceNumber} to ${recipient}`,
          metadata: {
            draftId: draft.id,
            recipient,
            subject: finalSubject,
            tone: draft.tone,
          },
        },
        businessId
      );

      res.json({
        success: true,
        message: `Reminder for ${draft.invoiceNumber} approved and sent to ${recipient}.`,
        draft: updatedDraft,
      });
    } catch (err: any) {
      console.error('Approve draft error:', err);
      res.status(500).json({ error: err.message || 'Failed to approve draft' });
    }
  });

  // Edit draft in queue
  app.put('/api/agent/queue/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const draft = storage.getApprovalDraftById(req.params.id, businessId);
      if (!draft) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      const { subject, body, clientEmail, tone } = req.body;
      const updated = storage.updateApprovalDraft(
        draft.id,
        {
          ...(subject ? { subject } : {}),
          ...(body ? { body } : {}),
          ...(clientEmail ? { clientEmail } : {}),
          ...(tone ? { tone } : {}),
        },
        businessId
      );

      res.json({ success: true, draft: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update draft' });
    }
  });

  // 1-Click Reject / Dismiss a draft
  app.post('/api/agent/queue/:id/reject', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const draft = storage.getApprovalDraftById(req.params.id, businessId);
      if (!draft) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      const { reason } = req.body;
      const now = new Date().toISOString();

      const updated = storage.updateApprovalDraft(
        draft.id,
        {
          status: 'rejected',
          reviewedAt: now,
        },
        businessId
      );

      storage.addActivity(
        {
          invoiceId: draft.invoiceId,
          invoiceNumber: draft.invoiceNumber,
          action: 'reminder_rejected',
          description: `User dismissed reminder draft for Invoice ${draft.invoiceNumber} (${draft.clientName})`,
          metadata: {
            draftId: draft.id,
            reason: reason || 'Dismissed by user',
          },
        },
        businessId
      );

      res.json({
        success: true,
        message: `Reminder draft for ${draft.invoiceNumber} dismissed.`,
        draft: updated,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to reject draft' });
    }
  });

  // 1-Click Approve All pending drafts
  app.post('/api/agent/queue/approve-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const pending = storage.getApprovalQueue(businessId, 'pending');
      const now = new Date().toISOString();
      let approvedCount = 0;

      for (const draft of pending) {
        const invoice = storage.getInvoiceById(draft.invoiceId, businessId);
        if (invoice) {
          storage.updateInvoice(
            invoice.id,
            {
              lastReminderSentAt: now,
              remindersCount: (invoice.remindersCount || 0) + 1,
            },
            businessId
          );
        }

        storage.updateApprovalDraft(
          draft.id,
          {
            status: 'approved',
            reviewedAt: now,
          },
          businessId
        );

        storage.addActivity(
          {
            invoiceId: draft.invoiceId,
            invoiceNumber: draft.invoiceNumber,
            action: 'reminder_sent',
            description: `User batch-approved and sent ${draft.tone} reminder for Invoice ${draft.invoiceNumber} to ${draft.clientEmail}`,
            metadata: {
              draftId: draft.id,
              recipient: draft.clientEmail,
              subject: draft.subject,
              tone: draft.tone,
              batch: true,
            },
          },
          businessId
        );
        approvedCount++;
      }

      res.json({
        success: true,
        approvedCount,
        message: `Approved and sent ${approvedCount} reminder(s).`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to approve all drafts' });
    }
  });

  // Analyze Client Reply with Gemini AI
  app.post('/api/invoices/:id/analyze-reply', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const invoice = storage.getInvoiceById(req.params.id, businessId);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const { replyText } = req.body;
      if (!replyText || typeof replyText !== 'string' || replyText.trim().length === 0) {
        return res.status(400).json({ error: 'Please paste the client reply text.' });
      }

      const analysis = await analyzeClientReply(invoice, replyText);

      storage.addActivity(
        {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          action: 'reply_analyzed',
          description: `Gemini AI analyzed client reply for ${invoice.invoiceNumber}: "${analysis.intent}"`,
          metadata: {
            intent: analysis.intent,
            sentiment: analysis.sentiment,
            suggestedDueDate: analysis.suggestedDueDate,
            hasSplit: Boolean(analysis.suggestedSplit),
          },
        },
        businessId
      );

      res.json(analysis);
    } catch (err: any) {
      console.error('Analyze reply error:', err);
      res.status(500).json({ error: err.message || 'Failed to analyze client reply' });
    }
  });

  // Approve and Apply Updated Terms from Client Reply
  app.post('/api/invoices/:id/apply-reply-terms', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const invoice = storage.getInvoiceById(req.params.id, businessId);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const { newDueDate, installments, notesAppendix } = req.body;

      const updates: any = {};
      if (newDueDate) updates.dueDate = newDueDate;
      if (installments && Array.isArray(installments)) updates.installments = installments;
      if (notesAppendix) {
        updates.notes = `${invoice.notes || ''}\n[Negotiated Terms]: ${notesAppendix}`.trim();
      }

      const updated = storage.updateInvoice(invoice.id, updates, businessId);

      const termsSummary = [
        newDueDate ? `Extended due date to ${newDueDate}` : '',
        installments ? `Split into ${installments.length} installments` : '',
      ]
        .filter(Boolean)
        .join(', ');

      storage.addActivity(
        {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          action: 'terms_updated',
          description: `User approved new terms for ${invoice.invoiceNumber}: ${termsSummary || 'Terms updated'}`,
          metadata: {
            newDueDate,
            installments,
          },
        },
        businessId
      );

      res.json({
        success: true,
        message: 'Payment terms updated successfully upon user approval.',
        invoice: updated,
      });
    } catch (err: any) {
      console.error('Apply reply terms error:', err);
      res.status(500).json({ error: err.message || 'Failed to apply terms' });
    }
  });

  // "Ask Your Money" Chat endpoint
  app.post('/api/chat/ask-money', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const { question } = req.body;
      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({ error: 'Please provide a question about your finances.' });
      }

      const invoices = storage.getInvoices(businessId);
      const summary = storage.getSummary(businessId);

      const result = await askFinancialAdvisor(question, invoices, summary);
      res.json(result);
    } catch (err: any) {
      console.error('Ask money chat error:', err);
      res.status(500).json({ error: err.message || 'Failed to answer financial question' });
    }
  });

  // Refresh status of all active invoices from PayPal Sandbox
  app.post('/api/invoices/refresh-status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const invoices = storage.getInvoices(businessId);
      let updatedCount = 0;
      const syncErrors: string[] = [];
      const newlyPaidInvoices: Array<{
        id: string;
        invoiceNumber: string;
        clientName: string;
        amount: number;
      }> = [];
      const today = new Date().toISOString().split('T')[0];

      // Query Sandbox for invoices list
      let remotePayPalInvoices: Array<{
        id: string;
        invoice_number?: string;
        status: string;
        recipient_view_url?: string;
        invoicer_view_url?: string;
      }> = [];

      try {
        remotePayPalInvoices = await searchPayPalInvoices();
      } catch (err) {
        console.warn('Could not query PayPal remote invoices list:', err);
      }

      for (const inv of invoices) {
        if (inv.status === 'Paid' || inv.status === 'Cancelled') {
          continue;
        }

        let activePaypalId = inv.paypalInvoiceId;

        // Auto-link real PayPal ID if invoice was created in Sandbox or missing ID
        if ((!activePaypalId || !REAL_PAYPAL_ID_REGEX.test(activePaypalId)) && remotePayPalInvoices.length > 0) {
          const matchedRemote = remotePayPalInvoices.find(
            (r) => r.invoice_number && r.invoice_number === inv.invoiceNumber
          );
          if (matchedRemote) {
            console.log(`Auto-linked invoice ${inv.invoiceNumber} to real PayPal ID: ${matchedRemote.id}`);
            activePaypalId = matchedRemote.id;
            storage.updateInvoice(
              inv.id,
              {
                paypalInvoiceId: matchedRemote.id,
                paypalPaymentLink: matchedRemote.recipient_view_url || inv.paypalPaymentLink,
                paypalSellerLink: matchedRemote.invoicer_view_url || inv.paypalSellerLink,
              },
              businessId
            );
          }
        }

        // If the invoice has a PayPal invoice ID, query GET /v2/invoicing/invoices/{invoice_id}
        if (activePaypalId) {
          const paypalData = await fetchPayPalInvoiceStatus(activePaypalId);

          if (!paypalData.success) {
            const errorMsg = paypalData.error || 'Failed to query PayPal Sandbox API';
            syncErrors.push(`${inv.invoiceNumber}: ${errorMsg}`);
            storage.updateInvoice(
              inv.id,
              {
                lastSyncError: errorMsg,
                rawPayPalStatus: paypalData.rawPayPalStatus || 'ERROR',
              },
              businessId
            );
            continue;
          }

          // PayPal call succeeded
          const previousStatus = inv.status;
          const newStatus = paypalData.status || inv.status;
          const statusChanged = newStatus !== previousStatus;
          const rawStatusChanged = inv.rawPayPalStatus !== paypalData.rawPayPalStatus;
          const hadErrorBefore = Boolean(inv.lastSyncError);
          const linkChanged =
            (paypalData.paymentLink && paypalData.paymentLink !== inv.paypalPaymentLink) ||
            (paypalData.sellerLink && paypalData.sellerLink !== inv.paypalSellerLink);

          if (statusChanged || rawStatusChanged || linkChanged || hadErrorBefore) {
            storage.updateInvoice(
              inv.id,
              {
                status: newStatus,
                rawPayPalStatus: paypalData.rawPayPalStatus,
                lastSyncError: undefined,
                paypalPaymentLink: paypalData.paymentLink || inv.paypalPaymentLink,
                paypalSellerLink: paypalData.sellerLink || inv.paypalSellerLink,
              },
              businessId
            );

            if (statusChanged) {
              updatedCount++;
              if (newStatus === 'Paid') {
                newlyPaidInvoices.push({
                  id: inv.id,
                  invoiceNumber: inv.invoiceNumber,
                  clientName: inv.clientName,
                  amount: inv.amount,
                });

                storage.addActivity(
                  {
                    invoiceId: inv.id,
                    invoiceNumber: inv.invoiceNumber,
                    action: 'paid',
                    description: `Payment received: Invoice ${inv.invoiceNumber} ($${inv.amount.toFixed(2)} USD) from ${inv.clientName} confirmed via PayPal Sandbox.`,
                    metadata: {
                      paypalInvoiceId: activePaypalId,
                      rawPayPalStatus: paypalData.rawPayPalStatus,
                      amount: inv.amount,
                    },
                  },
                  businessId
                );
              } else {
                storage.addActivity(
                  {
                    invoiceId: inv.id,
                    invoiceNumber: inv.invoiceNumber,
                    action: 'status_checked',
                    description: `PayPal Sandbox status sync: Updated from ${previousStatus} to ${newStatus} (${paypalData.rawPayPalStatus})`,
                    metadata: {
                      paypalInvoiceId: activePaypalId,
                      rawPayPalStatus: paypalData.rawPayPalStatus,
                    },
                  },
                  businessId
                );
              }
            }
          }
          continue;
        }

        // Automatic overdue check for invoices without a PayPal ID
        if (inv.status === 'Sent' && inv.dueDate < today) {
          storage.updateInvoice(inv.id, { status: 'Overdue' }, businessId);
          storage.addActivity(
            {
              invoiceId: inv.id,
              invoiceNumber: inv.invoiceNumber,
              action: 'status_checked',
              description: `Invoice ${inv.invoiceNumber} past due date (${inv.dueDate}); marked as Overdue.`,
            },
            businessId
          );
          updatedCount++;
        }
      }

      const updatedInvoices = storage.getInvoices(businessId);
      const summary = storage.getSummary(businessId);

      res.json({
        success: true,
        updatedCount,
        newlyPaidInvoices,
        syncErrors,
        invoices: updatedInvoices,
        summary,
        message:
          syncErrors.length > 0
            ? `Status check completed: ${updatedCount} invoice(s) updated, ${syncErrors.length} issue(s) reported.`
            : `Status check completed. ${updatedCount} invoice(s) updated based on PayPal Sandbox data.`,
      });
    } catch (err: any) {
      console.error('Refresh status error:', err);
      res.status(500).json({ error: err.message || 'Failed to refresh invoice status' });
    }
  });

  // Get Activity Log for current business
  app.get('/api/activity', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business!.id;
      const logs = storage.getActivityLogs(businessId);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch activity logs' });
    }
  });

  // ==========================================
  // STATIC FILES & DEV SERVER
  // ==========================================
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NudgePay server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
