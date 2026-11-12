import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Invoice,
  ActivityLogEntry,
  InvoiceSummary,
  ApprovalDraft,
  LastAgentRunSummary,
  BusinessUser,
  BusinessUserRecord,
  SessionRecord,
} from '../types/invoice.js';
import { REAL_PAYPAL_ID_REGEX } from './paypal.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'invoices_db.json');

export const DEMO_BUSINESS_ID = 'biz-demo-001';
export const DEMO_EMAIL = 'demo@example.com';
export const DEMO_PASSWORD = 'Demo1234!';
export const DEMO_BUSINESS_NAME = 'Apex Creative Studio';

export function hashPassword(password: string, saltInput?: string): { salt: string; hash: string } {
  const salt = saltInput || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  try {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

interface DatabaseSchema {
  businesses: BusinessUserRecord[];
  sessions: SessionRecord[];
  invoices: Invoice[];
  activityLogs: ActivityLogEntry[];
  approvalQueue: ApprovalDraft[];
  lastAgentRuns?: Record<string, LastAgentRunSummary>;
  lastAgentRun?: LastAgentRunSummary; // legacy format
}

const SEED_INVOICES: Invoice[] = [
  {
    id: 'inv-1001',
    businessId: DEMO_BUSINESS_ID,
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
    businessId: DEMO_BUSINESS_ID,
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
    businessId: DEMO_BUSINESS_ID,
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
    businessId: DEMO_BUSINESS_ID,
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
    businessId: DEMO_BUSINESS_ID,
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

const DEMO_OVERDUE_INVOICES: Invoice[] = [
  {
    id: 'demo-overdue-1',
    businessId: DEMO_BUSINESS_ID,
    invoiceNumber: 'INV-2026-DEMO1',
    clientName: '[Demo] Horizon Studio (Liam Chen)',
    clientEmail: 'liam@horizonstudio.design',
    description: 'Website Landing Page & Interactive Motion Graphics',
    amount: 650.0,
    currency: 'USD',
    issueDate: '2026-10-23',
    dueDate: '2026-11-06',
    status: 'Overdue',
    isDemo: true,
    rawClientMessage: 'Hi Liam, sending over the agreed landing page work invoice ($650). Due Nov 6.',
    notes: '[Demo Data] 4 days overdue. Ideal for testing friendly reminder generation (1-7 days overdue).',
    lineItems: [
      {
        id: 'li-demo-1',
        name: 'Landing Page Responsive UI',
        description: 'Figma to React conversion with smooth interactions',
        quantity: 1,
        unitPrice: 450.0,
        total: 450.0,
      },
      {
        id: 'li-demo-2',
        name: 'Motion Graphics Asset Pack',
        description: 'Lottie animations for hero illustration',
        quantity: 1,
        unitPrice: 200.0,
        total: 200.0,
      },
    ],
    createdAt: '2026-10-23T10:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
  },
  {
    id: 'demo-overdue-2',
    businessId: DEMO_BUSINESS_ID,
    invoiceNumber: 'INV-2026-DEMO2',
    clientName: '[Demo] Quantum Labs (Dr. Aris Thorne)',
    clientEmail: 'aris@quantumlabs.ai',
    description: 'Data Pipeline Automation & Real-Time Dashboard Integration',
    amount: 1850.0,
    currency: 'USD',
    issueDate: '2026-10-14',
    dueDate: '2026-10-28',
    status: 'Overdue',
    isDemo: true,
    rawClientMessage: 'Billing for Python telemetry pipeline and WebSocket dashboard: $1,850. Due Oct 28.',
    notes: '[Demo Data] 13 days overdue. Ideal for testing firmer reminder tone and client reply negotiations.',
    lineItems: [
      {
        id: 'li-demo-3',
        name: 'ETL Pipeline & Kafka Integration',
        description: 'High-throughput stream processing setup',
        quantity: 1,
        unitPrice: 1200.0,
        total: 1200.0,
      },
      {
        id: 'li-demo-4',
        name: 'WebSocket Live Telemetry UI',
        description: 'Real-time charts and KPI indicators',
        quantity: 1,
        unitPrice: 650.0,
        total: 650.0,
      },
    ],
    createdAt: '2026-10-14T11:30:00.000Z',
    updatedAt: '2026-10-29T00:00:00.000Z',
  },
  {
    id: 'demo-overdue-3',
    businessId: DEMO_BUSINESS_ID,
    invoiceNumber: 'INV-2026-DEMO3',
    clientName: '[Demo] Nexus Media Partners (Elena Rostova)',
    clientEmail: 'billing@nexusmedia.agency',
    description: 'Q3 Brand Strategy & Video Post-Production Campaign',
    amount: 3400.0,
    currency: 'USD',
    issueDate: '2026-09-30',
    dueDate: '2026-10-15',
    status: 'Overdue',
    isDemo: true,
    rawClientMessage: 'Deliverable complete for video post-production retainer: $3,400. Due Oct 15.',
    notes: '[Demo Data] 26 days overdue. Ideal for testing final collection notice generation.',
    lineItems: [
      {
        id: 'li-demo-5',
        name: 'Brand Campaign Video Editing & Color Grading',
        description: '4 video cuts for YouTube and paid ads',
        quantity: 1,
        unitPrice: 2200.0,
        total: 2200.0,
      },
      {
        id: 'li-demo-6',
        name: 'Sound Design & Audio Mastering',
        description: 'Custom Foley and voiceover mixing in 5.1',
        quantity: 1,
        unitPrice: 1200.0,
        total: 1200.0,
      },
    ],
    createdAt: '2026-09-30T09:00:00.000Z',
    updatedAt: '2026-10-16T00:00:00.000Z',
  },
];

const SEED_ACTIVITY: ActivityLogEntry[] = [
  {
    id: 'act-101',
    businessId: DEMO_BUSINESS_ID,
    invoiceId: 'inv-1001',
    invoiceNumber: 'INV-2026-001',
    action: 'created',
    description: 'Invoice extracted from client message via Gemini AI parser',
    timestamp: '2026-11-08T09:15:00.000Z',
  },
  {
    id: 'act-102',
    businessId: DEMO_BUSINESS_ID,
    invoiceId: 'inv-1004',
    invoiceNumber: 'INV-2026-004',
    action: 'paid',
    description: 'Payment of $850.00 USD confirmed via PayPal Sandbox Invoicing API',
    timestamp: '2026-10-27T16:20:00.000Z',
  },
  {
    id: 'act-103',
    businessId: DEMO_BUSINESS_ID,
    invoiceId: 'inv-1005',
    invoiceNumber: 'INV-2026-005',
    action: 'paid',
    description: 'Payment of $2,000.00 USD confirmed via PayPal Sandbox Invoicing API',
    timestamp: '2026-10-30T17:45:00.000Z',
  },
  {
    id: 'act-104',
    businessId: DEMO_BUSINESS_ID,
    invoiceId: 'inv-1003',
    invoiceNumber: 'INV-2026-003',
    action: 'sent',
    description: 'Invoice approved and dispatched to Nordic Wellness Co. via PayPal Sandbox',
    timestamp: '2026-11-02T11:05:00.000Z',
  },
];

class Storage {
  private db: DatabaseSchema = {
    businesses: [],
    sessions: [],
    invoices: [],
    activityLogs: [],
    approvalQueue: [],
    lastAgentRuns: {},
  };
  private initialized = false;

  private ensureInitialized() {
    if (this.initialized) return;

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.invoices)) {
          let cleaned = false;

          if (!Array.isArray(parsed.businesses)) {
            parsed.businesses = [];
            cleaned = true;
          }
          if (!Array.isArray(parsed.sessions)) {
            parsed.sessions = [];
            cleaned = true;
          }
          if (!Array.isArray(parsed.approvalQueue)) {
            parsed.approvalQueue = [];
            cleaned = true;
          }
          if (!parsed.lastAgentRuns) {
            parsed.lastAgentRuns = {};
            if (parsed.lastAgentRun) {
              parsed.lastAgentRuns[DEMO_BUSINESS_ID] = parsed.lastAgentRun;
              delete parsed.lastAgentRun;
            }
            cleaned = true;
          }

          // Ensure Seeded Demo Business Account exists
          let demoBiz = parsed.businesses.find(
            (b: any) => b.id === DEMO_BUSINESS_ID || b.email.toLowerCase() === DEMO_EMAIL.toLowerCase()
          );

          if (!demoBiz) {
            console.log(`Seeding demo business account (${DEMO_EMAIL})`);
            const { salt, hash } = hashPassword(DEMO_PASSWORD);
            demoBiz = {
              id: DEMO_BUSINESS_ID,
              email: DEMO_EMAIL.toLowerCase(),
              businessName: DEMO_BUSINESS_NAME,
              passwordSalt: salt,
              passwordHash: hash,
              createdAt: '2026-11-01T00:00:00.000Z',
            };
            parsed.businesses.unshift(demoBiz);
            cleaned = true;
          }

          // Migrate all existing invoices without a businessId to demo business, and ensure payToken
          parsed.invoices.forEach((inv: any) => {
            if (!inv.businessId) {
              inv.businessId = DEMO_BUSINESS_ID;
              cleaned = true;
            }
            if (!inv.payToken) {
              inv.payToken = crypto.randomBytes(16).toString('hex');
              cleaned = true;
            }
            // Sanitize invalid non-standard PayPal IDs
            if (inv.paypalInvoiceId && !REAL_PAYPAL_ID_REGEX.test(inv.paypalInvoiceId)) {
              console.log(`Clearing made-up PayPal ID "${inv.paypalInvoiceId}" from invoice ${inv.invoiceNumber}`);
              delete inv.paypalInvoiceId;
              delete inv.paypalPaymentLink;
              delete inv.paypalSellerLink;
              cleaned = true;
            }
          });

          // Migrate existing activity logs without businessId
          if (Array.isArray(parsed.activityLogs)) {
            parsed.activityLogs.forEach((log: any) => {
              if (!log.businessId) {
                log.businessId = DEMO_BUSINESS_ID;
                cleaned = true;
              }
            });
          }

          // Migrate existing approval queue drafts without businessId
          parsed.approvalQueue.forEach((draft: any) => {
            if (!draft.businessId) {
              draft.businessId = DEMO_BUSINESS_ID;
              cleaned = true;
            }
          });

          // Check if 3 sample overdue demo invoices exist; add only if missing
          const hasDemoOverdue = parsed.invoices.some((inv: any) => inv.id === 'demo-overdue-1');
          if (!hasDemoOverdue) {
            console.log('Seeding 3 sample overdue demo invoices for collections and reminder testing.');
            parsed.invoices.push(...DEMO_OVERDUE_INVOICES);
            cleaned = true;
          }

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

    // Default Fresh Seed
    const { salt, hash } = hashPassword(DEMO_PASSWORD);
    const demoBizRecord: BusinessUserRecord = {
      id: DEMO_BUSINESS_ID,
      email: DEMO_EMAIL.toLowerCase(),
      businessName: DEMO_BUSINESS_NAME,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: '2026-11-01T00:00:00.000Z',
    };

    this.db = {
      businesses: [demoBizRecord],
      sessions: [],
      invoices: [...SEED_INVOICES, ...DEMO_OVERDUE_INVOICES],
      activityLogs: [...SEED_ACTIVITY],
      approvalQueue: [],
      lastAgentRuns: {},
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

  // --- Business Account & Auth Methods ---

  public findBusinessByEmail(email: string): BusinessUserRecord | undefined {
    this.ensureInitialized();
    const cleanEmail = email.trim().toLowerCase();
    return this.db.businesses.find((b) => b.email.toLowerCase() === cleanEmail);
  }

  public findBusinessRecordByEmail(email: string): BusinessUserRecord | undefined {
    return this.findBusinessByEmail(email);
  }

  public findBusinessById(id: string): BusinessUser | undefined {
    this.ensureInitialized();
    const b = this.db.businesses.find((b) => b.id === id);
    if (!b) return undefined;
    return {
      id: b.id,
      email: b.email,
      businessName: b.businessName,
      createdAt: b.createdAt,
    };
  }

  public findBusinessRecordById(id: string): BusinessUserRecord | undefined {
    this.ensureInitialized();
    return this.db.businesses.find((b) => b.id === id);
  }

  public createBusiness(email: string, password: string, businessName: string): BusinessUser {
    this.ensureInitialized();
    const cleanEmail = email.trim().toLowerCase();
    const { salt, hash } = hashPassword(password);
    const newBiz: BusinessUserRecord = {
      id: `biz-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      email: cleanEmail,
      businessName: businessName.trim(),
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    };

    this.db.businesses.unshift(newBiz);

    // Add initial activity log for the new business
    this.addActivity(
      {
        action: 'created',
        description: `Welcome to NudgePay! Business account "${newBiz.businessName}" created.`,
      },
      newBiz.id
    );

    this.persist();
    return {
      id: newBiz.id,
      email: newBiz.email,
      businessName: newBiz.businessName,
      createdAt: newBiz.createdAt,
    };
  }

  public createSession(businessId: string): SessionRecord {
    this.ensureInitialized();
    if (!this.db.sessions) this.db.sessions = [];
    if (businessId === DEMO_BUSINESS_ID) {
      const demoSession: SessionRecord = {
        token: 'demo-session-token-2026',
        businessId: DEMO_BUSINESS_ID,
        createdAt: new Date().toISOString(),
        expiresAt: '2099-01-01T00:00:00.000Z',
      };
      if (!this.db.sessions.some((s) => s.token === 'demo-session-token-2026')) {
        this.db.sessions.push(demoSession);
        this.persist();
      }
      return demoSession;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    // 30 days session
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const session: SessionRecord = {
      token,
      businessId,
      createdAt: now.toISOString(),
      expiresAt,
    };
    this.db.sessions.push(session);
    this.persist();
    return session;
  }

  public getSession(token: string): SessionRecord | undefined {
    this.ensureInitialized();
    if (token === 'demo-session-token-2026') {
      return {
        token: 'demo-session-token-2026',
        businessId: DEMO_BUSINESS_ID,
        createdAt: '2026-11-01T00:00:00.000Z',
        expiresAt: '2099-01-01T00:00:00.000Z',
      };
    }
    if (!this.db.sessions) this.db.sessions = [];
    const session = this.db.sessions.find((s) => s.token === token);
    if (!session) return undefined;
    if (new Date(session.expiresAt) < new Date()) {
      this.deleteSession(token);
      return undefined;
    }
    return session;
  }

  public deleteSession(token: string): void {
    this.ensureInitialized();
    if (!this.db.sessions) return;
    const index = this.db.sessions.findIndex((s) => s.token === token);
    if (index !== -1) {
      this.db.sessions.splice(index, 1);
      this.persist();
    }
  }

  // --- Multi-Tenant Invoicing Methods ---

  public getInvoices(businessId: string): Invoice[] {
    this.ensureInitialized();
    const today = new Date().toISOString().split('T')[0];
    let changed = false;

    // Filter by businessId
    const businessInvoices = this.db.invoices.filter((inv) => inv.businessId === businessId);

    businessInvoices.forEach((inv) => {
      if (inv.status === 'Sent' && inv.dueDate < today) {
        inv.status = 'Overdue';
        inv.updatedAt = new Date().toISOString();
        changed = true;
        this.addActivity(
          {
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            action: 'status_checked',
            description: `Invoice ${inv.invoiceNumber} due date (${inv.dueDate}) has passed; marked as Overdue.`,
          },
          businessId
        );
      }
    });

    if (changed) {
      this.persist();
    }

    return businessInvoices.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getInvoiceById(id: string, businessId?: string): Invoice | undefined {
    this.ensureInitialized();
    return this.db.invoices.find(
      (inv) => inv.id === id && (!businessId || inv.businessId === businessId)
    );
  }

  public getInvoiceByPayToken(payToken: string): { invoice: Invoice; businessName: string } | undefined {
    this.ensureInitialized();
    const cleanToken = (payToken || '').trim();
    if (!cleanToken) return undefined;
    const invoice = this.db.invoices.find((inv) => inv.payToken === cleanToken);
    if (!invoice) return undefined;
    const business = invoice.businessId ? this.findBusinessById(invoice.businessId) : undefined;
    const businessName = business?.businessName || DEMO_BUSINESS_NAME;
    return { invoice, businessName };
  }

  public addClientMessage(
    payToken: string,
    messageText: string
  ): { invoice: Invoice; message: { id: string; message: string; timestamp: string; sender: 'client' } } | undefined {
    this.ensureInitialized();
    const cleanToken = (payToken || '').trim();
    const invoice = this.db.invoices.find((inv) => inv.payToken === cleanToken);
    if (!invoice) return undefined;

    const messageObj = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      message: messageText.trim(),
      timestamp: new Date().toISOString(),
      sender: 'client' as const,
    };

    if (!Array.isArray(invoice.clientMessages)) {
      invoice.clientMessages = [];
    }
    invoice.clientMessages.push(messageObj);
    invoice.rawClientMessage = messageText.trim();
    invoice.updatedAt = new Date().toISOString();

    const businessId = invoice.businessId || DEMO_BUSINESS_ID;
    this.addActivity(
      {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        action: 'client_message',
        description: `Customer message received on Invoice ${invoice.invoiceNumber} (${invoice.clientName}): "${messageText.trim().substring(0, 80)}"`,
        metadata: {
          messageId: messageObj.id,
          fullMessage: messageText.trim(),
          clientName: invoice.clientName,
          payToken,
        },
      },
      businessId
    );

    this.persist();
    return { invoice, message: messageObj };
  }

  public createInvoice(
    invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'invoiceNumber'> & {
      invoiceNumber?: string;
    },
    businessId: string
  ): Invoice {
    this.ensureInitialized();
    const businessInvoices = this.db.invoices.filter((inv) => inv.businessId === businessId);
    const count = businessInvoices.length + 1;
    const invoiceNumber = invoiceData.invoiceNumber || `INV-2026-${String(count).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const newInvoice: Invoice = {
      ...invoiceData,
      id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      businessId,
      payToken: invoiceData.payToken || crypto.randomBytes(16).toString('hex'),
      invoiceNumber,
      clientMessages: [],
      createdAt: now,
      updatedAt: now,
    };

    this.db.invoices.unshift(newInvoice);
    this.addActivity(
      {
        invoiceId: newInvoice.id,
        invoiceNumber: newInvoice.invoiceNumber,
        action: 'created',
        description: `Invoice ${newInvoice.invoiceNumber} created for ${newInvoice.clientName} ($${newInvoice.amount.toFixed(2)})`,
      },
      businessId
    );

    this.persist();
    return newInvoice;
  }

  public updateInvoice(id: string, updates: Partial<Invoice>, businessId?: string): Invoice | null {
    this.ensureInitialized();
    const index = this.db.invoices.findIndex(
      (inv) => inv.id === id && (!businessId || inv.businessId === businessId)
    );
    if (index === -1) return null;

    const previous = this.db.invoices[index];
    const targetBusinessId = previous.businessId || businessId || DEMO_BUSINESS_ID;

    const updated: Invoice = {
      ...previous,
      ...updates,
      businessId: targetBusinessId,
      updatedAt: new Date().toISOString(),
    };

    this.db.invoices[index] = updated;

    this.addActivity(
      {
        invoiceId: updated.id,
        invoiceNumber: updated.invoiceNumber,
        action: 'edited',
        description: `Invoice ${updated.invoiceNumber} updated. Status: ${updated.status}`,
      },
      targetBusinessId
    );

    this.persist();
    return updated;
  }

  public deleteInvoice(id: string, businessId?: string): boolean {
    this.ensureInitialized();
    const index = this.db.invoices.findIndex(
      (inv) => inv.id === id && (!businessId || inv.businessId === businessId)
    );
    if (index === -1) return false;

    const deleted = this.db.invoices[index];
    const targetBusinessId = deleted.businessId || businessId || DEMO_BUSINESS_ID;
    this.db.invoices.splice(index, 1);

    this.addActivity(
      {
        invoiceId: id,
        invoiceNumber: deleted.invoiceNumber,
        action: 'deleted',
        description: `Invoice ${deleted.invoiceNumber} for ${deleted.clientName} was deleted.`,
      },
      targetBusinessId
    );

    this.persist();
    return true;
  }

  public addActivity(
    entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>,
    businessId: string
  ): ActivityLogEntry {
    this.ensureInitialized();
    const newLog: ActivityLogEntry = {
      ...entry,
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      businessId,
      timestamp: new Date().toISOString(),
    };

    this.db.activityLogs.unshift(newLog);
    // Keep max 500 logs total
    if (this.db.activityLogs.length > 500) {
      this.db.activityLogs.length = 500;
    }
    this.persist();
    return newLog;
  }

  public getActivityLogs(businessId: string, invoiceId?: string): ActivityLogEntry[] {
    this.ensureInitialized();
    return this.db.activityLogs.filter(
      (log) => log.businessId === businessId && (!invoiceId || log.invoiceId === invoiceId)
    );
  }

  public getSummary(businessId: string): InvoiceSummary {
    this.ensureInitialized();
    const invoices = this.getInvoices(businessId);

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

  public getApprovalQueue(businessId: string, status?: 'pending' | 'approved' | 'rejected'): ApprovalDraft[] {
    this.ensureInitialized();
    if (!this.db.approvalQueue) this.db.approvalQueue = [];
    return this.db.approvalQueue.filter(
      (d) => d.businessId === businessId && (!status || d.status === status)
    );
  }

  public getApprovalDraftById(id: string, businessId?: string): ApprovalDraft | undefined {
    this.ensureInitialized();
    if (!this.db.approvalQueue) this.db.approvalQueue = [];
    return this.db.approvalQueue.find(
      (d) => d.id === id && (!businessId || d.businessId === businessId)
    );
  }

  public hasPendingDraftForInvoice(invoiceId: string, businessId: string): boolean {
    this.ensureInitialized();
    if (!this.db.approvalQueue) this.db.approvalQueue = [];
    return this.db.approvalQueue.some(
      (d) => d.invoiceId === invoiceId && d.businessId === businessId && d.status === 'pending'
    );
  }

  public addApprovalDraft(draft: ApprovalDraft, businessId: string): ApprovalDraft {
    this.ensureInitialized();
    if (!this.db.approvalQueue) this.db.approvalQueue = [];
    draft.businessId = businessId;

    // Prevent duplicate draft for the same invoice if already pending
    const existingIndex = this.db.approvalQueue.findIndex(
      (d) => d.invoiceId === draft.invoiceId && d.businessId === businessId && d.status === 'pending'
    );
    if (existingIndex >= 0) {
      return this.db.approvalQueue[existingIndex];
    }
    this.db.approvalQueue.unshift(draft);
    this.persist();
    return draft;
  }

  public updateApprovalDraft(id: string, updates: Partial<ApprovalDraft>, businessId?: string): ApprovalDraft | null {
    this.ensureInitialized();
    if (!this.db.approvalQueue) this.db.approvalQueue = [];
    const index = this.db.approvalQueue.findIndex(
      (d) => d.id === id && (!businessId || d.businessId === businessId)
    );
    if (index === -1) return null;

    const updated = {
      ...this.db.approvalQueue[index],
      ...updates,
      businessId: this.db.approvalQueue[index].businessId || businessId || DEMO_BUSINESS_ID,
    };
    this.db.approvalQueue[index] = updated;
    this.persist();
    return updated;
  }

  public deleteApprovalDraft(id: string, businessId?: string): boolean {
    this.ensureInitialized();
    if (!this.db.approvalQueue) this.db.approvalQueue = [];
    const index = this.db.approvalQueue.findIndex(
      (d) => d.id === id && (!businessId || d.businessId === businessId)
    );
    if (index === -1) return false;
    this.db.approvalQueue.splice(index, 1);
    this.persist();
    return true;
  }

  public getLastAgentRun(businessId: string): LastAgentRunSummary | undefined {
    this.ensureInitialized();
    if (!this.db.lastAgentRuns) this.db.lastAgentRuns = {};
    if (this.db.lastAgentRuns[businessId]) {
      return this.db.lastAgentRuns[businessId];
    }
    const pending = this.getApprovalQueue(businessId, 'pending');
    if (pending.length > 0) {
      return {
        businessId,
        timestamp: pending[0].createdAt || new Date().toISOString(),
        overdueCount: pending.length,
        draftsCreatedCount: pending.length,
        draftsReasoning: pending.map((d) => {
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
    }
    return undefined;
  }

  public setLastAgentRun(businessId: string, summary: LastAgentRunSummary): void {
    this.ensureInitialized();
    if (!this.db.lastAgentRuns) this.db.lastAgentRuns = {};
    summary.businessId = businessId;
    this.db.lastAgentRuns[businessId] = summary;
    this.persist();
  }
}

export const storage = new Storage();
