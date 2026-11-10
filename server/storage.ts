import fs from 'fs';
import path from 'path';
import { Invoice, ActivityLogEntry, InvoiceSummary } from '../types/invoice.js';
import { REAL_PAYPAL_ID_REGEX } from './paypal.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'invoices_db.json');

interface DatabaseSchema {
  invoices: Invoice[];
  activityLogs: ActivityLogEntry[];
}

const SEED_INVOICES: Invoice[] = [
  {
    id: 'inv-1001',
    invoiceNumber: 'INV-2026-001',
    clientName: 'Apex Creative Labs (Ravi Sharma)',
    clientEmail: 'ravi@apexcreative.io',
    description: 'Brand Identity & 3 Logo Concepts + Social Media Banner Kit',
    amount: 400.0,
    currency: 'USD',
    issueDate: '2026-11-08',
    dueDate: '2026-11-18',
    status: 'Draft',
    rawClientMessage: 'Hi, I need 3 logo designs and a banner, $400 total, can you send the invoice, due in 10 days. - Ravi (ravi@apexcreative.io)',
    notes: 'Payment terms: Due in 10 days via PayPal Sandbox. Final vector SVG & PNG delivered upon payment approval.',
    lineItems: [
      {
        id: 'li-1',
        name: 'Brand Identity & Logo Concepts',
        description: '3 custom vector logo proposals with monochrome & full color variants',
        quantity: 3,
        unitPrice: 100.0,
        total: 300.0,
      },
      {
        id: 'li-2',
        name: 'Social Media Banner Kit',
        description: 'High-res banners formatted for Twitter/X, LinkedIn, and YouTube',
        quantity: 1,
        unitPrice: 100.0,
        total: 100.0,
      },
    ],
    createdAt: '2026-11-08T09:15:00.000Z',
    updatedAt: '2026-11-08T09:15:00.000Z',
  },
  {
    id: 'inv-1002',
    invoiceNumber: 'INV-2026-002',
    clientName: 'CloudScale Systems (Sarah Jenkins)',
    clientEmail: 'sarah.j@cloudscale.net',
    description: 'Full-Stack API Integration & Microservices Security Audit (40 hrs)',
    amount: 3200.0,
    currency: 'USD',
    issueDate: '2026-10-22',
    dueDate: '2026-11-05',
    status: 'Overdue',
    rawClientMessage: 'Please invoice for sprint 4 microservices audit 40 hrs at $80/hr. Thanks Sarah.',
    notes: 'Overdue since November 5th. Reminder notification pending collections sequence.',
    lineItems: [
      {
        id: 'li-3',
        name: 'Backend API Audit & Performance Profiling',
        description: '40 billable engineering hours on distributed cache & auth gateway',
        quantity: 40,
        unitPrice: 80.0,
        total: 3200.0,
      },
    ],
    createdAt: '2026-10-22T14:30:00.000Z',
    updatedAt: '2026-11-06T00:00:00.000Z',
  },
  {
    id: 'inv-1003',
    invoiceNumber: 'INV-2026-003',
    clientName: 'Nordic Wellness Co. (Elin Larsson)',
    clientEmail: 'finance@nordicwellness.se',
    description: 'E-commerce Shopify Theme Customization & Mobile Checkout UX',
    amount: 1450.0,
    currency: 'USD',
    issueDate: '2026-11-02',
    dueDate: '2026-11-20',
    status: 'Sent',
    rawClientMessage: 'Invoice for mobile checkout optimization ($1,450) with net 18 terms. Send to Elin Larsson.',
    notes: 'Ready for PayPal Sandbox Invoicing API dispatch.',
    lineItems: [
      {
        id: 'li-4',
        name: 'Shopify Liquid Frontend Customization',
        description: 'Responsive cart drawer, speed optimization, and upsell modules',
        quantity: 1,
        unitPrice: 1450.0,
        total: 1450.0,
      },
    ],
    createdAt: '2026-11-02T11:00:00.000Z',
    updatedAt: '2026-11-02T11:05:00.000Z',
  },
  {
    id: 'inv-1004',
    invoiceNumber: 'INV-2026-004',
    clientName: 'Vanguard Legal Tech (Marcus Vance)',
    clientEmail: 'mvance@vanguardtech.co',
    description: 'UI/UX Dashboard Prototyping & Design System in Figma',
    amount: 850.0,
    currency: 'USD',
    issueDate: '2026-10-14',
    dueDate: '2026-10-28',
    status: 'Paid',
    rawClientMessage: 'Marcus here from Vanguard. Send the $850 Figma prototype invoice due in two weeks.',
    notes: 'Paid in full on October 27, 2026.',
    lineItems: [
      {
        id: 'li-5',
        name: 'Figma Interactive Component Library & 10 UI Screens',
        description: 'Dark-mode compliant attorney review workstation designs',
        quantity: 1,
        unitPrice: 850.0,
        total: 850.0,
      },
    ],
    createdAt: '2026-10-14T10:00:00.000Z',
    updatedAt: '2026-10-27T16:20:00.000Z',
  },
  {
    id: 'inv-1005',
    invoiceNumber: 'INV-2026-005',
    clientName: 'Brightline Digital (Priya Patel)',
    clientEmail: 'priya@brightline.agency',
    description: 'Monthly Fractional Frontend Engineering Retainer (October 2026)',
    amount: 2000.0,
    currency: 'USD',
    issueDate: '2026-10-01',
    dueDate: '2026-10-31',
    status: 'Paid',
    rawClientMessage: 'Hi! Billing for October monthly engineering retainer $2,000 as agreed. Priya.',
    notes: 'Recurring retainer payment confirmed on October 30, 2026.',
    lineItems: [
      {
        id: 'li-6',
        name: 'Fractional Senior React / TypeScript Support',
        description: 'Monthly architecture advisory, PR reviews, and critical bug fixes',
        quantity: 1,
        unitPrice: 2000.0,
        total: 2000.0,
      },
    ],
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-30T17:45:00.000Z',
  },
];

const SEED_ACTIVITY: ActivityLogEntry[] = [
  {
    id: 'act-1',
    invoiceId: 'inv-1001',
    invoiceNumber: 'INV-2026-001',
    action: 'created',
    description: 'Draft invoice extracted from Ravi Sharma message via Gemini AI',
    timestamp: '2026-11-08T09:15:00.000Z',
  },
  {
    id: 'act-2',
    invoiceId: 'inv-1003',
    invoiceNumber: 'INV-2026-003',
    action: 'created',
    description: 'Extracted invoice from client email message via Gemini AI',
    timestamp: '2026-11-02T11:00:00.000Z',
  },
  {
    id: 'act-3',
    invoiceId: 'inv-1003',
    invoiceNumber: 'INV-2026-003',
    action: 'approved',
    description: 'User reviewed and approved invoice details for $1,450.00',
    timestamp: '2026-11-02T11:04:30.000Z',
  },
  {
    id: 'act-4',
    invoiceId: 'inv-1003',
    invoiceNumber: 'INV-2026-003',
    action: 'sent',
    description: 'Dispatched invoice via PayPal Invoicing API Sandbox (ID: INV2-NW-3319-SANDBOX)',
    timestamp: '2026-11-02T11:05:00.000Z',
  },
  {
    id: 'act-5',
    invoiceId: 'inv-1002',
    invoiceNumber: 'INV-2026-002',
    action: 'sent',
    description: 'Invoice dispatched to sarah.j@cloudscale.net via PayPal Sandbox',
    timestamp: '2026-10-22T14:35:00.000Z',
  },
  {
    id: 'act-6',
    invoiceId: 'inv-1002',
    invoiceNumber: 'INV-2026-002',
    action: 'status_checked',
    description: 'Invoice due date (2026-11-05) lapsed without payment; marked as Overdue',
    timestamp: '2026-11-06T00:00:00.000Z',
  },
  {
    id: 'act-7',
    invoiceId: 'inv-1004',
    invoiceNumber: 'INV-2026-004',
    action: 'paid',
    description: 'Payment of $850.00 confirmed on PayPal Sandbox for Marcus Vance',
    timestamp: '2026-10-27T16:20:00.000Z',
  },
  {
    id: 'act-8',
    invoiceId: 'inv-1005',
    invoiceNumber: 'INV-2026-005',
    action: 'paid',
    description: 'Payment of $2,000.00 received for October Retainer',
    timestamp: '2026-10-30T17:45:00.000Z',
  },
];

class Storage {
  private db: DatabaseSchema = { invoices: [], activityLogs: [] };
  private initialized = false;

  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized() {
    if (this.initialized) return;

    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.invoices) && parsed.invoices.length > 0) {
          // Strip legacy manual hash links and remove made-up fake PayPal IDs
          let cleaned = false;
          parsed.invoices.forEach((inv: any) => {
            if (
              inv.paypalPaymentLink &&
              (inv.paypalPaymentLink.includes('#CS9842') ||
                inv.paypalPaymentLink.includes('#NW3319') ||
                inv.paypalPaymentLink.includes('#VL7721') ||
                inv.paypalPaymentLink.includes('#BL5501') ||
                inv.paypalPaymentLink.includes('SANDBOX-DEMO') ||
                inv.paypalPaymentLink.includes('#INV2') ||
                inv.paypalPaymentLink.includes('undefined'))
            ) {
              delete inv.paypalPaymentLink;
              cleaned = true;
            }

            // Cleanse made-up IDs that do not match real PayPal format INV2-XXXX-XXXX-XXXX-XXXX
            if (inv.paypalInvoiceId && !REAL_PAYPAL_ID_REGEX.test(inv.paypalInvoiceId)) {
              console.log(`Clearing made-up PayPal ID "${inv.paypalInvoiceId}" from invoice ${inv.invoiceNumber}`);
              delete inv.paypalInvoiceId;
              delete inv.paypalPaymentLink;
              delete inv.paypalSellerLink;
              cleaned = true;
            }
          });
          this.db = parsed;
          if (cleaned) {
            this.persist();
          }
          this.initialized = true;
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to read existing database, re-seeding:', err);
    }

    // Seed default data
    this.db = {
      invoices: [...SEED_INVOICES],
      activityLogs: [...SEED_ACTIVITY],
    };
    this.persist();
    this.initialized = true;
  }

  private persist() {
    try {
      const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(this.db, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('Failed to persist database file:', err);
    }
  }

  public getInvoices(): Invoice[] {
    this.ensureInitialized();
    // Auto-update overdue status if due date has passed and still Sent
    const today = new Date().toISOString().split('T')[0];
    let changed = false;

    this.db.invoices.forEach((inv) => {
      if (inv.status === 'Sent' && inv.dueDate < today) {
        inv.status = 'Overdue';
        inv.updatedAt = new Date().toISOString();
        changed = true;
        this.addActivity({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          action: 'status_checked',
          description: `Invoice ${inv.invoiceNumber} due date (${inv.dueDate}) has passed; marked as Overdue.`,
        });
      }
    });

    if (changed) {
      this.persist();
    }

    return [...this.db.invoices].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getInvoiceById(id: string): Invoice | undefined {
    this.ensureInitialized();
    return this.db.invoices.find((inv) => inv.id === id);
  }

  public createInvoice(
    invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'invoiceNumber'> & {
      invoiceNumber?: string;
    }
  ): Invoice {
    this.ensureInitialized();
    const count = this.db.invoices.length + 1;
    const invoiceNumber = invoiceData.invoiceNumber || `INV-2026-${String(count).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const newInvoice: Invoice = {
      ...invoiceData,
      id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      invoiceNumber,
      createdAt: now,
      updatedAt: now,
    };

    this.db.invoices.unshift(newInvoice);
    this.addActivity({
      invoiceId: newInvoice.id,
      invoiceNumber: newInvoice.invoiceNumber,
      action: 'created',
      description: `Invoice ${newInvoice.invoiceNumber} created for ${newInvoice.clientName} ($${newInvoice.amount.toFixed(2)})`,
    });

    this.persist();
    return newInvoice;
  }

  public updateInvoice(id: string, updates: Partial<Invoice>): Invoice | null {
    this.ensureInitialized();
    const index = this.db.invoices.findIndex((inv) => inv.id === id);
    if (index === -1) return null;

    const previous = this.db.invoices[index];
    const updated: Invoice = {
      ...previous,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.db.invoices[index] = updated;

    this.addActivity({
      invoiceId: updated.id,
      invoiceNumber: updated.invoiceNumber,
      action: 'edited',
      description: `Invoice ${updated.invoiceNumber} updated. Status: ${updated.status}`,
    });

    this.persist();
    return updated;
  }

  public deleteInvoice(id: string): boolean {
    this.ensureInitialized();
    const index = this.db.invoices.findIndex((inv) => inv.id === id);
    if (index === -1) return false;

    const deleted = this.db.invoices[index];
    this.db.invoices.splice(index, 1);

    this.addActivity({
      invoiceId: id,
      invoiceNumber: deleted.invoiceNumber,
      action: 'deleted',
      description: `Invoice ${deleted.invoiceNumber} for ${deleted.clientName} was deleted.`,
    });

    this.persist();
    return true;
  }

  public addActivity(entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>): ActivityLogEntry {
    this.ensureInitialized();
    const newLog: ActivityLogEntry = {
      ...entry,
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
    };

    this.db.activityLogs.unshift(newLog);
    // Keep max 200 logs
    if (this.db.activityLogs.length > 200) {
      this.db.activityLogs.length = 200;
    }
    this.persist();
    return newLog;
  }

  public getActivityLogs(invoiceId?: string): ActivityLogEntry[] {
    this.ensureInitialized();
    if (invoiceId) {
      return this.db.activityLogs.filter((log) => log.invoiceId === invoiceId);
    }
    return [...this.db.activityLogs];
  }

  public getSummary(): InvoiceSummary {
    this.ensureInitialized();
    const invoices = this.getInvoices();

    let totalOutstanding = 0;
    let totalPaid = 0;
    let overdueCount = 0;
    let draftCount = 0;
    let sentCount = 0;
    let paidCount = 0;

    for (const inv of invoices) {
      if (inv.status === 'Paid') {
        totalPaid += inv.amount;
        paidCount++;
      } else if (
        inv.status === 'Sent' ||
        inv.status === 'Partially paid' ||
        inv.status === 'Payment pending'
      ) {
        totalOutstanding += inv.amount;
        sentCount++;
      } else if (inv.status === 'Overdue') {
        totalOutstanding += inv.amount;
        overdueCount++;
      } else if (inv.status === 'Draft') {
        draftCount++;
      }
    }

    return {
      totalOutstanding,
      totalPaid,
      overdueCount,
      totalCount: invoices.length,
      draftCount,
      sentCount,
      paidCount,
    };
  }
}

export const storage = new Storage();
