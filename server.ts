import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from './server/storage.js';
import { LastAgentRunSummary } from './types/invoice.js';
import {
  extractInvoiceFromMessage,
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

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Config Status
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

  // Get Invoices + Summary
  app.get('/api/invoices', (req: Request, res: Response) => {
    try {
      const invoices = storage.getInvoices();
      const summary = storage.getSummary();
      res.json({ invoices, summary });
    } catch (err: any) {
      console.error('Failed to get invoices:', err);
      res.status(500).json({ error: err.message || 'Failed to get invoices' });
    }
  });

  // Get Single Invoice + its Activity
  app.get('/api/invoices/:id', (req: Request, res: Response) => {
    try {
      const invoice = storage.getInvoiceById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      const activity = storage.getActivityLogs(invoice.id);
      res.json({ invoice, activity });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch invoice' });
    }
  });

  // Extract Invoice Details from Client Message using Gemini 3.8 Flash
  app.post('/api/invoices/extract', async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'Please provide a message to extract invoice from.' });
      }

      const extracted = await extractInvoiceFromMessage(message);
      res.json(extracted);
    } catch (err: any) {
      console.error('Extraction error:', err);
      const isQuotaOrKey =
        err.message?.includes('API_KEY') ||
        err.message?.includes('PERMISSION_DENIED') ||
        err.message?.includes('GEMINI_API_KEY');

      res.status(500).json({
        error: isQuotaOrKey
          ? 'Gemini API authentication issue. Please check your GEMINI_API_KEY in the Secrets panel.'
          : err.message || 'Failed to extract invoice from message.',
      });
    }
  });

  // Create New Invoice (as Draft or custom)
  app.post('/api/invoices', (req: Request, res: Response) => {
    try {
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

      const newInvoice = storage.createInvoice({
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
      });

      res.status(201).json(newInvoice);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create invoice' });
    }
  });

  // Update Invoice
  app.put('/api/invoices/:id', (req: Request, res: Response) => {
    try {
      const updated = storage.updateInvoice(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update invoice' });
    }
  });

  // Delete Invoice
  app.delete('/api/invoices/:id', (req: Request, res: Response) => {
    try {
      const success = storage.deleteInvoice(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete invoice' });
    }
  });

  // Approve and Send via PayPal Invoicing API (SANDBOX)
  app.post('/api/invoices/:id/approve-and-send', async (req: Request, res: Response) => {
    try {
      const invoice = storage.getInvoiceById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Log the explicit user approval step
      storage.addActivity({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        action: 'approved',
        description: `User approved invoice ${invoice.invoiceNumber} for $${invoice.amount.toFixed(2)} to ${invoice.clientName}`,
      });

      // Execute PayPal Sandbox dispatch
      const paypalResult = await createAndSendPayPalInvoice(invoice);

      const finalInvoiceNumber = paypalResult.updatedInvoiceNumber || invoice.invoiceNumber;
      const updated = storage.updateInvoice(invoice.id, {
        status: 'Sent',
        invoiceNumber: finalInvoiceNumber,
        paypalInvoiceId: paypalResult.paypalInvoiceId,
        paypalPaymentLink: paypalResult.paypalPaymentLink,
        paypalSellerLink: paypalResult.paypalSellerLink,
      });

      storage.addActivity({
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
      });

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

  // Mark as Paid (Manual confirmation or Sandbox test shortcut)
  app.post('/api/invoices/:id/mark-paid', (req: Request, res: Response) => {
    try {
      const invoice = storage.getInvoiceById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const updated = storage.updateInvoice(invoice.id, {
        status: 'Paid',
      });

      storage.addActivity({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        action: 'paid',
        description: `Payment of $${invoice.amount.toFixed(2)} confirmed and recorded.`,
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update invoice status' });
    }
  });

  // Stage 2: Draft Overdue Reminder using Gemini AI
  app.post('/api/invoices/:id/draft-reminder', async (req: Request, res: Response) => {
    try {
      const invoice = storage.getInvoiceById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const draft = await generateOverdueReminder(invoice);

      storage.addActivity({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        action: 'reminder_drafted',
        description: `Gemini AI drafted ${draft.toneLabel} for ${invoice.clientName} ($${invoice.amount.toFixed(2)})`,
        metadata: {
          tone: draft.tone,
          daysOverdue: draft.daysOverdue,
          subject: draft.subject,
        },
      });

      res.json(draft);
    } catch (err: any) {
      console.error('Draft reminder error:', err);
      res.status(500).json({ error: err.message || 'Failed to draft reminder' });
    }
  });

  // Stage 2: Approve & Send Overdue Reminder (User must approve before dispatch)
  app.post('/api/invoices/:id/send-reminder', (req: Request, res: Response) => {
    try {
      const invoice = storage.getInvoiceById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const { subject, body, recipientEmail, tone } = req.body;
      const recipient = recipientEmail || invoice.clientEmail || 'client';
      const now = new Date().toISOString();

      const updated = storage.updateInvoice(invoice.id, {
        lastReminderSentAt: now,
        remindersCount: (invoice.remindersCount || 0) + 1,
      });

      storage.addActivity({
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
      });

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

  // Agent Run: Scan all invoices, find Sent + overdue invoices, draft Gemini reminders based on lateness,
  // place in Approval queue, avoid duplicate pending drafts, and log decisions in activity log.
  app.post('/api/agent/run', async (req: Request, res: Response) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const invoices = storage.getInvoices();

      // Find invoices that are Sent (or Overdue) and past due date
      const overdueInvoices = invoices.filter(
        (inv) => (inv.status === 'Overdue' || inv.status === 'Sent') && inv.dueDate < today
      );

      let newDraftsCount = 0;
      let alreadyDraftedCount = 0;
      const createdDrafts: any[] = [];

      for (const inv of overdueInvoices) {
        // Don't create duplicate drafts for an invoice that already has a pending draft
        if (storage.hasPendingDraftForInvoice(inv.id)) {
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

        // Draft reminder using Gemini (with fallback if needed)
        const draftContent = await generateOverdueReminder(inv, today);

        const approvalDraft = storage.addApprovalDraft({
          id: `draft-${inv.id}-${Date.now()}`,
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
        });

        // Log agent action in activity log including decision and reasoning
        storage.addActivity({
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
        });

        createdDrafts.push(approvalDraft);
        newDraftsCount++;
      }

      const allPending = storage.getApprovalQueue('pending');

      // Log overall agent run
      storage.addActivity({
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
      });

      const lastAgentRun: LastAgentRunSummary = {
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
      storage.setLastAgentRun(lastAgentRun);

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

  // Get approval queue
  app.get('/api/agent/queue', (req: Request, res: Response) => {
    try {
      const pendingDrafts = storage.getApprovalQueue('pending');
      const allDrafts = storage.getApprovalQueue();
      const lastAgentRun = storage.getLastAgentRun();
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
  app.post('/api/agent/queue/:id/approve', (req: Request, res: Response) => {
    try {
      const draft = storage.getApprovalDraftById(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      const { subject, body, recipientEmail } = req.body;
      const finalSubject = subject || draft.subject;
      const finalBody = body || draft.body;
      const recipient = recipientEmail || draft.clientEmail;

      const invoice = storage.getInvoiceById(draft.invoiceId);
      const now = new Date().toISOString();

      if (invoice) {
        storage.updateInvoice(invoice.id, {
          lastReminderSentAt: now,
          remindersCount: (invoice.remindersCount || 0) + 1,
        });
      }

      const updatedDraft = storage.updateApprovalDraft(draft.id, {
        status: 'approved',
        subject: finalSubject,
        body: finalBody,
        clientEmail: recipient,
        reviewedAt: now,
      });

      storage.addActivity({
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
      });

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
  app.put('/api/agent/queue/:id', (req: Request, res: Response) => {
    try {
      const draft = storage.getApprovalDraftById(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      const { subject, body, clientEmail, tone } = req.body;
      const updated = storage.updateApprovalDraft(draft.id, {
        ...(subject ? { subject } : {}),
        ...(body ? { body } : {}),
        ...(clientEmail ? { clientEmail } : {}),
        ...(tone ? { tone } : {}),
      });

      res.json({ success: true, draft: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update draft' });
    }
  });

  // 1-Click Reject / Dismiss a draft
  app.post('/api/agent/queue/:id/reject', (req: Request, res: Response) => {
    try {
      const draft = storage.getApprovalDraftById(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      const { reason } = req.body;
      const now = new Date().toISOString();

      const updated = storage.updateApprovalDraft(draft.id, {
        status: 'rejected',
        reviewedAt: now,
      });

      storage.addActivity({
        invoiceId: draft.invoiceId,
        invoiceNumber: draft.invoiceNumber,
        action: 'reminder_rejected',
        description: `User dismissed reminder draft for Invoice ${draft.invoiceNumber} (${draft.clientName})`,
        metadata: {
          draftId: draft.id,
          reason: reason || 'Dismissed by user',
        },
      });

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
  app.post('/api/agent/queue/approve-all', (req: Request, res: Response) => {
    try {
      const pending = storage.getApprovalQueue('pending');
      const now = new Date().toISOString();
      let approvedCount = 0;

      for (const draft of pending) {
        const invoice = storage.getInvoiceById(draft.invoiceId);
        if (invoice) {
          storage.updateInvoice(invoice.id, {
            lastReminderSentAt: now,
            remindersCount: (invoice.remindersCount || 0) + 1,
          });
        }

        storage.updateApprovalDraft(draft.id, {
          status: 'approved',
          reviewedAt: now,
        });

        storage.addActivity({
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
        });
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

  // Stage 2: Analyze Client Reply with Gemini AI
  app.post('/api/invoices/:id/analyze-reply', async (req: Request, res: Response) => {
    try {
      const invoice = storage.getInvoiceById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const { replyText } = req.body;
      if (!replyText || typeof replyText !== 'string' || replyText.trim().length === 0) {
        return res.status(400).json({ error: 'Please paste the client reply text.' });
      }

      const analysis = await analyzeClientReply(invoice, replyText);

      storage.addActivity({
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
      });

      res.json(analysis);
    } catch (err: any) {
      console.error('Analyze reply error:', err);
      res.status(500).json({ error: err.message || 'Failed to analyze client reply' });
    }
  });

  // Stage 2: Approve and Apply Updated Terms from Client Reply
  app.post('/api/invoices/:id/apply-reply-terms', (req: Request, res: Response) => {
    try {
      const invoice = storage.getInvoiceById(req.params.id);
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

      const updated = storage.updateInvoice(invoice.id, updates);

      const termsSummary = [
        newDueDate ? `Extended due date to ${newDueDate}` : '',
        installments ? `Split into ${installments.length} installments` : '',
      ]
        .filter(Boolean)
        .join(', ');

      storage.addActivity({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        action: 'terms_updated',
        description: `User approved new terms for ${invoice.invoiceNumber}: ${termsSummary || 'Terms updated'}`,
        metadata: {
          newDueDate,
          installments,
        },
      });

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

  // Stage 2: "Ask Your Money" Chat endpoint
  app.post('/api/chat/ask-money', async (req: Request, res: Response) => {
    try {
      const { question } = req.body;
      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({ error: 'Please provide a question about your finances.' });
      }

      const invoices = storage.getInvoices();
      const summary = storage.getSummary();

      const result = await askFinancialAdvisor(question, invoices, summary);
      res.json(result);
    } catch (err: any) {
      console.error('Ask money chat error:', err);
      res.status(500).json({ error: err.message || 'Failed to answer financial question' });
    }
  });

  // Refresh status of all active invoices from PayPal Sandbox
  app.post('/api/invoices/refresh-status', async (req: Request, res: Response) => {

    try {
      const invoices = storage.getInvoices();
      let updatedCount = 0;
      const syncErrors: string[] = [];
      const newlyPaidInvoices: Array<{
        id: string;
        invoiceNumber: string;
        clientName: string;
        amount: number;
      }> = [];
      const today = new Date().toISOString().split('T')[0];

      // Step A: Fetch remote invoices from PayPal Sandbox to auto-link any real PayPal invoices
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
        // Requirement: Don't poll invoices that are already Paid or Cancelled
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
            storage.updateInvoice(inv.id, {
              paypalInvoiceId: matchedRemote.id,
              paypalPaymentLink: matchedRemote.recipient_view_url || inv.paypalPaymentLink,
              paypalSellerLink: matchedRemote.invoicer_view_url || inv.paypalSellerLink,
            });
          }
        }

        // If the invoice has a PayPal invoice ID, query GET /v2/invoicing/invoices/{invoice_id}
        if (activePaypalId) {
          const paypalData = await fetchPayPalInvoiceStatus(activePaypalId);

          if (!paypalData.success) {
            // Requirement 4: Show error on screen instead of silently keeping old status
            const errorMsg = paypalData.error || 'Failed to query PayPal Sandbox API';
            syncErrors.push(`${inv.invoiceNumber}: ${errorMsg}`);
            storage.updateInvoice(inv.id, {
              lastSyncError: errorMsg,
              rawPayPalStatus: paypalData.rawPayPalStatus || 'ERROR',
            });
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
            storage.updateInvoice(inv.id, {
              status: newStatus,
              rawPayPalStatus: paypalData.rawPayPalStatus,
              lastSyncError: undefined,
              paypalPaymentLink: paypalData.paymentLink || inv.paypalPaymentLink,
              paypalSellerLink: paypalData.sellerLink || inv.paypalSellerLink,
            });

            if (statusChanged) {
              updatedCount++;
              // Requirement: Add activity log entry when an invoice becomes Paid
              if (newStatus === 'Paid') {
                newlyPaidInvoices.push({
                  id: inv.id,
                  invoiceNumber: inv.invoiceNumber,
                  clientName: inv.clientName,
                  amount: inv.amount,
                });

                storage.addActivity({
                  invoiceId: inv.id,
                  invoiceNumber: inv.invoiceNumber,
                  action: 'paid',
                  description: `Payment received: Invoice ${inv.invoiceNumber} ($${inv.amount.toFixed(2)} USD) from ${inv.clientName} confirmed via PayPal Sandbox.`,
                  metadata: {
                    paypalInvoiceId: activePaypalId,
                    rawPayPalStatus: paypalData.rawPayPalStatus,
                    amount: inv.amount,
                  },
                });
              } else {
                storage.addActivity({
                  invoiceId: inv.id,
                  invoiceNumber: inv.invoiceNumber,
                  action: 'status_checked',
                  description: `PayPal Sandbox status sync: Updated from ${previousStatus} to ${newStatus} (${paypalData.rawPayPalStatus})`,
                  metadata: {
                    paypalInvoiceId: activePaypalId,
                    rawPayPalStatus: paypalData.rawPayPalStatus,
                  },
                });
              }
            }
          }
          continue;
        }

        // Automatic overdue check for invoices without a PayPal ID
        if (inv.status === 'Sent' && inv.dueDate < today) {
          storage.updateInvoice(inv.id, { status: 'Overdue' });
          storage.addActivity({
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            action: 'status_checked',
            description: `Invoice ${inv.invoiceNumber} past due date (${inv.dueDate}); marked as Overdue.`,
          });
          updatedCount++;
        }
      }

      const updatedInvoices = storage.getInvoices();
      const summary = storage.getSummary();

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

  // Get Activity Log
  app.get('/api/activity', (req: Request, res: Response) => {
    try {
      const logs = storage.getActivityLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch activity logs' });
    }
  });

  // Vite Integration: Dev vs Production
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
    console.log(`InvoicePilot server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
