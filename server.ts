import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from './server/storage.js';
import { extractInvoiceFromMessage } from './server/gemini.js';
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

  // Refresh status of all active invoices from PayPal Sandbox
  app.post('/api/invoices/refresh-status', async (req: Request, res: Response) => {
    try {
      const invoices = storage.getInvoices();
      let updatedCount = 0;
      const syncErrors: string[] = [];
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
              // Requirement 5: Add activity log entry when an invoice becomes Paid
              if (newStatus === 'Paid' && previousStatus !== 'Paid') {
                storage.addActivity({
                  invoiceId: inv.id,
                  invoiceNumber: inv.invoiceNumber,
                  action: 'paid',
                  description: `Payment of $${inv.amount.toFixed(2)} USD confirmed via PayPal Sandbox status check for ${inv.clientName}. (PayPal: ${paypalData.rawPayPalStatus})`,
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
