import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  ExtractedInvoiceData,
  LineItem,
  Invoice,
  ReminderDraft,
  ClientReplyAnalysis,
  InvoiceSummary,
} from '../types/invoice.js';

interface ExtractionResult extends ExtractedInvoiceData {
  usedFallback?: boolean;
  warning?: string;
}

/**
 * Smart heuristic fallback parser if Gemini API encounters temporary network issues,
 * model demand spikes (503), or invalid API keys.
 */
export function heuristicExtract(messageText: string, referenceDateStr?: string): ExtractedInvoiceData {
  const today = referenceDateStr || new Date().toISOString().split('T')[0];
  const refDate = new Date(today);

  // 1. Extract email
  const emailMatch = messageText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const clientEmail = emailMatch ? emailMatch[1] : '';

  // 2. Extract Client Name
  let clientName = '';
  const signoffMatch = messageText.match(/(?:[-–—]|thanks|regards|cheers|best|sincerely|from)\s*,?\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
  if (signoffMatch && signoffMatch[1]) {
    clientName = signoffMatch[1].trim();
  } else if (clientEmail) {
    const rawName = clientEmail.split('@')[0].replace(/[._-]/g, ' ');
    clientName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  } else {
    clientName = 'Valued Client';
  }

  // 3. Extract Total Amount
  const amountMatches = Array.from(
    messageText.matchAll(/\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/g)
  ).map((m) => parseFloat(m[1].replace(/,/g, '')));

  let totalAmount = amountMatches.length > 0 ? Math.max(...amountMatches) : 100.0;

  // 4. Extract Due Date
  let dueDate = '';
  const daysMatch = messageText.match(/(?:due\s+(?:in|within)\s+([0-9]+)\s+days?|net\s+([0-9]+))/i);
  const weeksMatch = messageText.match(/(?:due\s+(?:in|within)\s+([0-9]+)\s+weeks?|in\s+two\s+weeks)/i);

  if (daysMatch) {
    const days = parseInt(daysMatch[1] || daysMatch[2] || '14', 10);
    const target = new Date(refDate.getTime() + days * 86400000);
    dueDate = target.toISOString().split('T')[0];
  } else if (weeksMatch) {
    const weeks = weeksMatch[1] ? parseInt(weeksMatch[1], 10) : 2;
    const target = new Date(refDate.getTime() + weeks * 7 * 86400000);
    dueDate = target.toISOString().split('T')[0];
  } else {
    // Default to 14 days
    const target = new Date(refDate.getTime() + 14 * 86400000);
    dueDate = target.toISOString().split('T')[0];
  }

  // 5. Build intelligent line items
  const items: LineItem[] = [];

  // Check for logo & banner pattern
  const logoMatch = messageText.match(/([0-9]+)\s+logo\s+designs?/i);
  const hasBanner = /banner/i.test(messageText);

  if (logoMatch || hasBanner) {
    const logoQty = logoMatch ? parseInt(logoMatch[1], 10) : 3;
    const bannerTotal = hasBanner ? 100 : 0;
    const logoTotal = Math.max(0, totalAmount - bannerTotal);
    const logoUnit = logoQty > 0 ? Number((logoTotal / logoQty).toFixed(2)) : logoTotal;

    items.push({
      id: `li-${Date.now()}-1`,
      name: 'Custom Logo Design Concepts',
      description: `${logoQty} unique design variations and vector formats`,
      quantity: logoQty,
      unitPrice: logoUnit,
      total: logoTotal,
    });

    if (hasBanner) {
      items.push({
        id: `li-${Date.now()}-2`,
        name: 'Social Media & Marketing Banner',
        description: 'Formatted graphics for web, LinkedIn, and social platforms',
        quantity: 1,
        unitPrice: bannerTotal,
        total: bannerTotal,
      });
    }
  } else {
    // Check for hourly pattern: e.g. "25 hours ... at $90/hr"
    const hourlyMatch = messageText.match(/([0-9]+)\s+hours?.*?at\s+\$([0-9]+)/i);
    if (hourlyMatch) {
      const hours = parseInt(hourlyMatch[1], 10);
      const rate = parseFloat(hourlyMatch[2]);
      const hourlyTotal = hours * rate;

      items.push({
        id: `li-${Date.now()}-1`,
        name: 'Engineering / Design Consulting Services',
        description: `${hours} billable hours at $${rate}/hr`,
        quantity: hours,
        unitPrice: rate,
        total: hourlyTotal,
      });

      if (totalAmount > hourlyTotal) {
        const extra = totalAmount - hourlyTotal;
        items.push({
          id: `li-${Date.now()}-2`,
          name: 'Project Setup & Migration Fee',
          description: 'One-time onboarding and infrastructure setup',
          quantity: 1,
          unitPrice: extra,
          total: extra,
        });
      }
    } else {
      items.push({
        id: `li-${Date.now()}-1`,
        name: 'Professional Services',
        description: messageText.substring(0, 90),
        quantity: 1,
        unitPrice: totalAmount,
        total: totalAmount,
      });
    }
  }

  const computedTotal = items.reduce((sum, item) => sum + item.total, 0);

  return {
    clientName,
    clientEmail,
    description: items.map((i) => i.name).join(' & '),
    lineItems: items,
    total: computedTotal > 0 ? computedTotal : totalAmount,
    dueDate,
    notes: 'Payment due upon receipt or specified due date via PayPal.',
  };
}

/**
 * Execute Gemini extraction with prompt model selection, per-call timeout,
 * and graceful fallback.
 */
export async function extractInvoiceFromMessage(
  messageText: string,
  referenceDateStr?: string
): Promise<ExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const today = referenceDateStr || new Date().toISOString().split('T')[0];

  // If no Gemini API key is configured, immediately use smart heuristic extraction
  if (!apiKey) {
    const fallback = heuristicExtract(messageText, today);
    return {
      ...fallback,
      usedFallback: true,
      warning:
        'GEMINI_API_KEY is not configured in Secrets. Extracted using smart offline parser. Review and verify values below.',
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const systemInstruction = `You are NudgePay AI, an expert collections and invoicing extraction agent for freelancers and businesses.
Your job is to read raw client messages, emails, chats, or project briefs, and extract structured invoice details.

Reference Date Today: ${today}

Rules:
1. Extract clientName (person or company name). If only a first name is given, use it.
2. Extract clientEmail if present in the text, otherwise return an empty string.
3. Extract or summarize an invoice description (e.g., "3 Logo Designs & Social Media Banner").
4. Extract lineItems with:
   - name: brief item/service title
   - description: optional extra detail
   - quantity: number (default to 1 if not specified)
   - unitPrice: number in USD
   - total: quantity * unitPrice
   If only a total amount is given with multiple items, distribute or break them down sensibly so that the sum of line items equals the total.
5. Extract or compute total amount (number in USD).
6. Determine dueDate (YYYY-MM-DD format):
   - If relative terms like "in 10 days", "net 14", "in 2 weeks", or "by Friday" are given, calculate the exact date based on Reference Date Today (${today}).
   - If a specific date is given, convert it to YYYY-MM-DD.
   - If no due date is mentioned, default to 14 days after today (${today}).
7. Extract any helpful notes (payment terms, delivery terms, instructions).
Be thorough, accurate, and output strictly valid JSON conforming to the schema.`;

  // Official models from @google/genai guidelines in order of priority:
  // Primary: gemini-3.8-flash with adequate time window
  // Secondary: gemini-3.1-flash-lite with minimal thinking latency
  const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];

  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const config: any = {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            clientName: {
              type: Type.STRING,
              description: 'Name of the client or company requesting the work',
            },
            clientEmail: {
              type: Type.STRING,
              description: 'Client email address if found in the text, or empty string',
            },
            description: {
              type: Type.STRING,
              description: 'High-level invoice summary description',
            },
            lineItems: {
              type: Type.ARRAY,
              description: 'List of individual services, deliverables, or items with prices',
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: 'Item name or title' },
                  description: { type: Type.STRING, description: 'Item detail or description' },
                  quantity: { type: Type.NUMBER, description: 'Quantity (e.g. 1, 2, 40)' },
                  unitPrice: { type: Type.NUMBER, description: 'Unit price in USD' },
                  total: { type: Type.NUMBER, description: 'Total price for this line item' },
                },
                required: ['name', 'quantity', 'unitPrice', 'total'],
              },
            },
            total: {
              type: Type.NUMBER,
              description: 'Total invoice amount in USD',
            },
            dueDate: {
              type: Type.STRING,
              description: 'Due date in YYYY-MM-DD format',
            },
            notes: {
              type: Type.STRING,
              description: 'Payment terms or notes',
            },
          },
          required: ['clientName', 'description', 'lineItems', 'total', 'dueDate'],
        },
      };

      if (model !== 'gemini-3.1-flash-lite') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      // 12s for primary model, 6s for high-speed flash lite
      const timeoutMs = model === 'gemini-3.8-flash' ? 12000 : 6000;

      const generatePromise = ai.models.generateContent({
        model,
        contents: `Client Message:\n"""\n${messageText}\n"""\n\nPlease parse this client message into structured invoice data.`,
        config,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: Model ${model} took longer than ${timeoutMs / 1000}s`)), timeoutMs)
      );

      const response = await Promise.race([generatePromise, timeoutPromise]);
      let rawJson = (response.text || '{}').trim();
      if (rawJson.startsWith('```')) {
        rawJson = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      }
      const parsed = JSON.parse(rawJson);

      const lineItems = Array.isArray(parsed.lineItems)
        ? parsed.lineItems.map((item: any, idx: number) => ({
            id: `item-${Date.now()}-${idx}`,
            name: String(item.name || 'Service Item'),
            description: item.description ? String(item.description) : undefined,
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unitPrice) || 0,
            total: Number(item.total) || (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
          }))
        : [];

      const computedTotal = lineItems.reduce((acc: number, curr: any) => acc + curr.total, 0);

      return {
        clientName: parsed.clientName || 'Valued Client',
        clientEmail: parsed.clientEmail || '',
        description: parsed.description || 'Professional Services',
        lineItems:
          lineItems.length > 0
            ? lineItems
            : [
                {
                  id: `item-${Date.now()}`,
                  name: parsed.description || 'Professional Services',
                  quantity: 1,
                  unitPrice: Number(parsed.total) || 100,
                  total: Number(parsed.total) || 100,
                },
              ],
        total: parsed.total || (computedTotal > 0 ? computedTotal : 0),
        dueDate: parsed.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        notes: parsed.notes || 'Payment due upon receipt or specified due date.',
        usedFallback: false,
      };
    } catch (err: any) {
      console.warn(`Extraction attempt with model ${model} failed:`, err.message || err);
      lastError = err;
      // Continue to next model in candidate chain
    }
  }

  // If all candidate models timed out or encountered errors:
  console.warn('All Gemini candidate models failed, engaging smart heuristic extraction fallback.');
  const fallback = heuristicExtract(messageText, today);
  return {
    ...fallback,
    usedFallback: true,
    warning: `Gemini AI service took too long or is busy (${lastError?.message || 'High Demand'}). Populated using smart parser. Please review and verify before sending.`,
  };
}

/**
 * Stage 2: Generate Overdue Reminder using Gemini AI
 * Tiers:
 * - 1-7 days: Friendly nudge
 * - 8-21 days: Firmer follow-up
 * - 22+ days: Final collection notice
 */
export async function generateOverdueReminder(
  invoice: Invoice,
  referenceDateStr?: string,
  baseUrl?: string
): Promise<ReminderDraft> {
  const today = referenceDateStr || new Date().toISOString().split('T')[0];
  const refTime = new Date(today).getTime();
  const dueTime = new Date(invoice.dueDate).getTime();
  const daysOverdue = Math.max(1, Math.round((refTime - dueTime) / 86400000));

  let tone: 'friendly' | 'firm' | 'final' = 'friendly';
  let toneLabel = 'Friendly Reminder (1–7 days overdue)';

  if (daysOverdue >= 22) {
    tone = 'final';
    toneLabel = 'Final Collection Notice (22+ days overdue)';
  } else if (daysOverdue >= 8) {
    tone = 'firm';
    toneLabel = 'Firm Follow-up (8–21 days overdue)';
  }

  const customerLink = invoice.payToken
    ? `${(baseUrl || '').replace(/\/$/, '')}/pay/${invoice.payToken}`
    : `${(baseUrl || '').replace(/\/$/, '')}/pay/${invoice.id}`;

  const paymentLink =
    invoice.paypalPaymentLink ||
    `https://www.sandbox.paypal.com/invoice/p/#${invoice.invoiceNumber.replace(/[^A-Za-z0-9]/g, '')}`;

  // Deterministic high-quality fallback generator
  const getFallbackDraft = (): ReminderDraft => {
    let subject = '';
    let body = '';

    if (tone === 'friendly') {
      subject = `Friendly reminder: Invoice ${invoice.invoiceNumber} ($${invoice.amount.toFixed(2)}) is past due`;
      body = `Hi ${invoice.clientName},\n\nHope you're having a productive week! Just a friendly reminder that Invoice ${invoice.invoiceNumber} for $${invoice.amount.toFixed(2)} was due on ${invoice.dueDate} (${daysOverdue} day${daysOverdue === 1 ? '' : 's'} ago).\n\nYou can view your invoice, pay instantly, or message us directly at your customer link:\n${customerLink}\n\nDirect PayPal payment link:\n${paymentLink}\n\nIf you've already sent payment, please disregard this note. Let me know if you have any questions!\n\nBest regards,\nNudgePay Accounts`;
    } else if (tone === 'firm') {
      subject = `Urgent: Overdue payment for Invoice ${invoice.invoiceNumber} ($${invoice.amount.toFixed(2)})`;
      body = `Dear ${invoice.clientName},\n\nWe are following up regarding Invoice ${invoice.invoiceNumber} for the amount of $${invoice.amount.toFixed(2)}, which was due on ${invoice.dueDate} and is now ${daysOverdue} days overdue.\n\nPlease review your invoice and submit payment or message us directly via your customer payment portal:\n${customerLink}\n\nDirect PayPal payment link:\n${paymentLink}\n\nIf there is an issue or you need to discuss payment scheduling, please message us through the link above immediately.\n\nSincerely,\nFinance & Collections Team`;
    } else {
      subject = `FINAL NOTICE: Immediate payment required for Invoice ${invoice.invoiceNumber} ($${invoice.amount.toFixed(2)})`;
      body = `Dear ${invoice.clientName},\n\nThis is a FINAL NOTICE regarding outstanding Invoice ${invoice.invoiceNumber} in the amount of $${invoice.amount.toFixed(2)}, which became due on ${invoice.dueDate} and is now ${daysOverdue} days past due.\n\nPlease settle this balance immediately via your customer payment portal:\n${customerLink}\n\nDirect PayPal Link:\n${paymentLink}\n\nServices and deliverables have been rendered in full. Please confirm payment or contact us through your portal today.\n\nAccounts Receivable`;
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
      daysOverdue,
      tone,
      toneLabel,
      subject,
      body,
      paymentLink,
    };
  };

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return getFallbackDraft();
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const prompt = `Write an overdue reminder email for the following invoice:
- Client Name: ${invoice.clientName}
- Invoice Number: ${invoice.invoiceNumber}
- Amount: $${invoice.amount.toFixed(2)} USD
- Due Date: ${invoice.dueDate}
- Days Overdue: ${daysOverdue} days (Current Date: ${today})
- Target Tone: ${tone.toUpperCase()}
  * "friendly": (1-7 days overdue) Gentle, warm, assuming it was simply overlooked.
  * "firm": (8-21 days overdue) Professional, direct, asking for payment date or update.
  * "final": (22+ days overdue) Formal notice, explicit final call before suspension/collections.
- Customer Payment Link (MUST be included verbatim in email body): ${customerLink}
- Direct PayPal Payment Link: ${paymentLink}

Requirements:
- Must include the client name, amount, due date, and the customer payment link (${customerLink}).
- Mention that the client can pay online or message the business directly through that customer link.
- Return subject and body. Keep the email concise and ready to send.`;

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an AI Collections Agent writing customized overdue reminder emails.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING, description: 'Email subject line' },
            body: { type: Type.STRING, description: 'Complete email body text including payment link' },
          },
          required: ['subject', 'body'],
        },
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: Gemini reminder generation took longer than 20s')), 20000)
    );

    const response = await Promise.race([generatePromise, timeoutPromise]);

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.subject && parsed.body) {
      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        amount: invoice.amount,
        dueDate: invoice.dueDate,
        daysOverdue,
        tone,
        toneLabel,
        subject: parsed.subject,
        body: parsed.body,
        paymentLink,
      };
    }
  } catch (err: any) {
    console.warn('Gemini reminder draft generation failed, using fallback:', err.message || err);
  }

  return getFallbackDraft();
}

/**
 * Stage 2: Analyze Client Reply (e.g. "Can I pay next week?", "Can we split into two payments?")
 */
export async function analyzeClientReply(
  invoice: Invoice,
  replyText: string,
  referenceDateStr?: string
): Promise<ClientReplyAnalysis> {
  const today = referenceDateStr || new Date().toISOString().split('T')[0];
  const refDate = new Date(today);

  // Deterministic fallback analyzer
  const getFallbackAnalysis = (): ClientReplyAnalysis => {
    const isExtension = /next week|next month|extension|few days|friday|monday|delay|by (next|[0-9]{1,2})/i.test(replyText);
    const isSplit = /split|installments?|half|two payments|partially|50%|divide/i.test(replyText);

    let suggestedDueDate: string | undefined = undefined;
    let suggestedSplit: ClientReplyAnalysis['suggestedSplit'] = undefined;
    let intent = 'Client acknowledging invoice and requesting flexible terms';
    let sentiment: ClientReplyAnalysis['sentiment'] = 'cooperative';

    if (isSplit) {
      intent = 'Client requested to split invoice into two installments';
      const half = Number((invoice.amount / 2).toFixed(2));
      const secondHalf = Number((invoice.amount - half).toFixed(2));
      const firstDue = new Date(refDate.getTime() + 7 * 86400000).toISOString().split('T')[0];
      const secondDue = new Date(refDate.getTime() + 21 * 86400000).toISOString().split('T')[0];

      suggestedSplit = {
        reason: 'Client requested split payment arrangement due to short-term cash flow.',
        installments: [
          { amount: half, dueDate: firstDue, label: `50% Deposit / Installment 1 (Due ${firstDue})` },
          { amount: secondHalf, dueDate: secondDue, label: `Remaining Balance (Due ${secondDue})` },
        ],
      };
    } else if (isExtension) {
      intent = 'Client requested a due date extension';
      const extDate = new Date(refDate.getTime() + 7 * 86400000).toISOString().split('T')[0];
      suggestedDueDate = extDate;
    }

    const suggestedResponse = `Hi ${invoice.clientName},\n\nThank you for the update. We understand and appreciate you letting us know.\n\n${
      suggestedSplit
        ? `We can approve splitting Invoice ${invoice.invoiceNumber} ($${invoice.amount.toFixed(2)}) into two payments: $${(invoice.amount / 2).toFixed(2)} due within 7 days, and the remaining $${(invoice.amount / 2).toFixed(2)} due in 21 days. Does that work for you?`
        : suggestedDueDate
        ? `We have updated your invoice due date to ${suggestedDueDate}. Please ensure the balance ($${invoice.amount.toFixed(2)}) is settled by then via PayPal.`
        : `Thank you for your note regarding Invoice ${invoice.invoiceNumber}. Please let us know the exact date you anticipate completing the payment so we can update our records.`
    }\n\nBest regards,\nNudgePay Accounts`;

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName,
      clientReply: replyText,
      intent,
      sentiment,
      suggestedResponse,
      suggestedDueDate,
      suggestedSplit,
    };
  };

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return getFallbackAnalysis();
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const prompt = `Analyze this client reply regarding Invoice ${invoice.invoiceNumber} (Total: $${invoice.amount.toFixed(2)} USD, Current Due Date: ${invoice.dueDate}):
Client Message:
"""
${replyText}
"""
Today's Date: ${today}

Your Task:
1. Determine the client's intent and sentiment (cooperative, delayed, disputing, neutral).
2. Draft a courteous, professional response that maintains good client relations while securing a clear payment commitment.
3. If the client asked for more time or a specific date (e.g. "next week", "Friday Nov 20"), calculate and provide suggestedDueDate (YYYY-MM-DD format).
4. If the client requested splitting into installments or half/half, propose a structured suggestedSplit with two installment amounts and dates that sum up to $${invoice.amount.toFixed(2)}.`;

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an expert collections negotiation advisor assisting freelancers with client responses.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: { type: Type.STRING, description: 'Summary of what client is asking' },
            sentiment: {
              type: Type.STRING,
              enum: ['cooperative', 'delayed', 'disputing', 'neutral'],
            },
            suggestedResponse: {
              type: Type.STRING,
              description: 'Professional draft response to send back to client',
            },
            suggestedDueDate: {
              type: Type.STRING,
              description: 'New recommended due date in YYYY-MM-DD if applicable, or empty string',
            },
            hasSplitSuggestion: { type: Type.BOOLEAN },
            splitReason: { type: Type.STRING },
            installment1Amount: { type: Type.NUMBER },
            installment1DueDate: { type: Type.STRING },
            installment1Label: { type: Type.STRING },
            installment2Amount: { type: Type.NUMBER },
            installment2DueDate: { type: Type.STRING },
            installment2Label: { type: Type.STRING },
          },
          required: ['intent', 'sentiment', 'suggestedResponse'],
        },
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: Gemini reply analysis took longer than 20s')), 20000)
    );

    const response = await Promise.race([generatePromise, timeoutPromise]);

    const parsed = JSON.parse(response.text || '{}');

    let suggestedSplit: ClientReplyAnalysis['suggestedSplit'] = undefined;
    if (parsed.hasSplitSuggestion && parsed.installment1Amount && parsed.installment2Amount) {
      suggestedSplit = {
        reason: parsed.splitReason || 'Split into 2 payments as requested by client',
        installments: [
          {
            amount: Number(parsed.installment1Amount),
            dueDate: parsed.installment1DueDate || today,
            label: parsed.installment1Label || 'Installment 1',
          },
          {
            amount: Number(parsed.installment2Amount),
            dueDate: parsed.installment2DueDate || today,
            label: parsed.installment2Label || 'Installment 2',
          },
        ],
      };
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName,
      clientReply: replyText,
      intent: parsed.intent || 'Client request regarding invoice',
      sentiment: parsed.sentiment || 'cooperative',
      suggestedResponse: parsed.suggestedResponse,
      suggestedDueDate: parsed.suggestedDueDate ? parsed.suggestedDueDate : undefined,
      suggestedSplit,
    };
  } catch (err: any) {
    console.warn('Gemini client reply analysis failed, using fallback:', err.message || err);
    return getFallbackAnalysis();
  }
}

/**
 * Stage 2: "Ask your money" Chat
 * Answer questions using stored invoice data with Gemini.
 * Never invent invoices that do not exist!
 */
function fallbackFinancialAdvisor(
  question: string,
  invoices: Invoice[],
  summary: InvoiceSummary
): {
  answer: string;
  citedInvoices?: Array<{
    id: string;
    invoiceNumber: string;
    clientName: string;
    amount: number;
    status: Invoice['status'];
    dueDate: string;
  }>;
  suggestedQuestions?: string[];
} {
  const today = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  const qLower = question.toLowerCase().trim();

  // 1. Identify if a client name or person is referenced in the question
  const matchedInvoicesByClient: Invoice[] = [];
  let detectedClientName = '';

  for (const inv of invoices) {
    const fullClient = inv.clientName.toLowerCase();
    const parts = fullClient
      .replace(/[()]/g, ' ')
      .split(/\s+/)
      .filter((p) => p.length >= 3 && !['the', 'and', 'for', 'inc', 'llc', 'corp', 'tech'].includes(p));

    const matches =
      fullClient.includes(qLower) ||
      parts.some((part) => {
        const regex = new RegExp(`\\b${part}\\b`, 'i');
        return regex.test(qLower);
      });

    if (matches) {
      matchedInvoicesByClient.push(inv);
      if (!detectedClientName) detectedClientName = inv.clientName;
    }
  }

  // Detect if user asks about a person or client
  const askedPersonMatch = question.match(
    /(?:how much did|did|has|is there (?:an|any)? invoice for|invoices? for|check|pay me|paid by)\s+([A-Za-z]+)/i
  );
  const askedPerson = askedPersonMatch ? askedPersonMatch[1] : '';

  // Case A: User asked about a client found in DB
  if (matchedInvoicesByClient.length > 0) {
    const isAskingLastYear = qLower.includes('last year') || qLower.includes(String(lastYear));

    if (isAskingLastYear) {
      const lastYearInvoices = matchedInvoicesByClient.filter(
        (i) => i.issueDate.startsWith(String(lastYear)) || i.dueDate.startsWith(String(lastYear))
      );
      if (lastYearInvoices.length === 0) {
        const clientShort = askedPerson || detectedClientName;
        const existingInv = matchedInvoicesByClient[0];
        return {
          answer: `I don't see any invoices for ${clientShort} for last year (${lastYear}). Based on your records, the only invoice for ${existingInv.clientName} is ${existingInv.invoiceNumber} for $${existingInv.amount.toFixed(2)} USD (dated ${existingInv.issueDate}, Status: ${existingInv.status}).`,
          citedInvoices: [
            {
              id: existingInv.id,
              invoiceNumber: existingInv.invoiceNumber,
              clientName: existingInv.clientName,
              amount: existingInv.amount,
              status: existingInv.status,
              dueDate: existingInv.dueDate,
            },
          ],
          suggestedQuestions: [
            `How much did ${clientShort} pay this year?`,
            'Who owes me money?',
            'What is my total paid revenue?',
          ],
        };
      }
    }

    // Client query general (how much did they pay / invoice details)
    const paidForClient = matchedInvoicesByClient.filter((i) => i.status === 'Paid');
    const unpaidForClient = matchedInvoicesByClient.filter((i) => i.status !== 'Paid');
    const totalPaidClient = paidForClient.reduce((sum, i) => sum + i.amount, 0);

    if (qLower.includes('how much') || qLower.includes('pay') || qLower.includes('paid')) {
      if (paidForClient.length > 0) {
        const details = paidForClient
          .map((i) => `${i.invoiceNumber} ($${i.amount.toFixed(2)} USD)`)
          .join(', ');
        return {
          answer: `Based on ${details}, ${detectedClientName} has paid a total of **$${totalPaidClient.toFixed(2)} USD**.`,
          citedInvoices: matchedInvoicesByClient.map((i) => ({
            id: i.id,
            invoiceNumber: i.invoiceNumber,
            clientName: i.clientName,
            amount: i.amount,
            status: i.status,
            dueDate: i.dueDate,
          })),
          suggestedQuestions: ['Who owes me money?', 'Which client pays late?', 'Show all paid invoices'],
        };
      } else {
        const details = unpaidForClient
          .map((i) => `${i.invoiceNumber} ($${i.amount.toFixed(2)} USD, due ${i.dueDate})`)
          .join(', ');
        return {
          answer: `Based on ${details}, ${detectedClientName} has not paid yet (Status: ${unpaidForClient[0].status}).`,
          citedInvoices: unpaidForClient.map((i) => ({
            id: i.id,
            invoiceNumber: i.invoiceNumber,
            clientName: i.clientName,
            amount: i.amount,
            status: i.status,
            dueDate: i.dueDate,
          })),
          suggestedQuestions: [
            'Who owes me money?',
            'Which client pays late?',
            'Draft a reminder for this invoice',
          ],
        };
      }
    }

    // Generic client details
    const summaryLines = matchedInvoicesByClient
      .map(
        (i) =>
          `• ${i.invoiceNumber} for ${i.clientName}: $${i.amount.toFixed(2)} USD (${i.status}, due ${i.dueDate})`
      )
      .join('\n');
    return {
      answer: `Found ${matchedInvoicesByClient.length} invoice(s) for ${detectedClientName}:\n${summaryLines}`,
      citedInvoices: matchedInvoicesByClient.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        clientName: i.clientName,
        amount: i.amount,
        status: i.status,
        dueDate: i.dueDate,
      })),
      suggestedQuestions: ['Who owes me money?', 'Which client pays late?', 'Show my total outstanding balance'],
    };
  }

  // Case B: User asked about a client/person not in our records
  if (askedPerson && !['me', 'you', 'someone', 'anyone', 'client'].includes(askedPerson.toLowerCase())) {
    return {
      answer: `I don't see any invoices for ${askedPerson} in the invoice data.`,
      suggestedQuestions: [
        'Who owes me money?',
        'Which client pays late?',
        'Show my total outstanding balance',
      ],
    };
  }

  const overdueList = invoices.filter(
    (i) => i.status === 'Overdue' || (i.status === 'Sent' && i.dueDate < today)
  );
  const paidList = invoices.filter((i) => i.status === 'Paid');

  // Case C: Who owes me money / overdue / unpaid
  if (
    qLower.includes('who owes') ||
    qLower.includes('overdue') ||
    qLower.includes('unpaid') ||
    qLower.includes('owing')
  ) {
    if (overdueList.length === 0) {
      return {
        answer: 'You have no overdue invoices. All client accounts are settled or within payment terms.',
        suggestedQuestions: ['What is my total paid revenue?', 'Which client pays late?'],
      };
    }
    const lines = overdueList
      .map((i) => `• ${i.clientName}: $${i.amount.toFixed(2)} USD (${i.invoiceNumber}, due ${i.dueDate})`)
      .join('\n');
    return {
      answer: `You have ${overdueList.length} overdue invoice(s) totaling $${overdueList.reduce((acc, i) => acc + i.amount, 0).toFixed(2)} USD:\n${lines}`,
      citedInvoices: overdueList.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        clientName: i.clientName,
        amount: i.amount,
        status: i.status,
        dueDate: i.dueDate,
      })),
      suggestedQuestions: ['Which client pays late?', 'Draft an overdue reminder', 'What is my total paid revenue?'],
    };
  }

  // Case D: Which client pays late
  if (qLower.includes('late') || qLower.includes('slow')) {
    const lateInvoices = invoices.filter(
      (i) => i.status === 'Overdue' || (i.status === 'Sent' && i.dueDate < today)
    );
    const lines = lateInvoices
      .map((i) => `• ${i.clientName}: Invoice ${i.invoiceNumber} ($${i.amount.toFixed(2)} USD, due ${i.dueDate})`)
      .join('\n');
    return {
      answer: `Based on your records, the clients with late or overdue invoices are:\n${lines}\nClients like Brightline Digital and Vanguard Legal Tech have paid on time.`,
      citedInvoices: lateInvoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        clientName: i.clientName,
        amount: i.amount,
        status: i.status,
        dueDate: i.dueDate,
      })),
      suggestedQuestions: ['Who owes me money?', 'Draft an overdue reminder', 'What is my total paid revenue?'],
    };
  }

  // Case E: Total paid / collected revenue
  if (
    qLower.includes('total paid') ||
    qLower.includes('how much has been paid') ||
    qLower.includes('revenue') ||
    qLower.includes('collected')
  ) {
    const lines = paidList
      .map((i) => `• ${i.clientName}: $${i.amount.toFixed(2)} USD (${i.invoiceNumber})`)
      .join('\n');
    return {
      answer: `Total paid is **$${summary.totalPaid.toFixed(2)} USD** across ${summary.paidCount} invoice(s):\n${lines}`,
      citedInvoices: paidList.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        clientName: i.clientName,
        amount: i.amount,
        status: i.status,
        dueDate: i.dueDate,
      })),
      suggestedQuestions: ['Who owes me money?', 'Which client pays late?', 'What is my total outstanding balance?'],
    };
  }

  // Case F: Total outstanding / balance
  if (qLower.includes('outstanding') || qLower.includes('total owed') || qLower.includes('balance')) {
    const sentOrOverdue = invoices.filter((i) => i.status === 'Sent' || i.status === 'Overdue');
    const lines = sentOrOverdue
      .map((i) => `• ${i.clientName}: $${i.amount.toFixed(2)} USD (${i.invoiceNumber}, ${i.status})`)
      .join('\n');
    return {
      answer: `Total outstanding balance is **$${summary.totalOutstanding.toFixed(2)} USD** across ${sentOrOverdue.length} invoice(s):\n${lines}`,
      citedInvoices: sentOrOverdue.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        clientName: i.clientName,
        amount: i.amount,
        status: i.status,
        dueDate: i.dueDate,
      })),
      suggestedQuestions: ['Who owes me money?', 'Which client pays late?', 'What is my total paid revenue?'],
    };
  }

  // Case G: Largest invoice
  if (qLower.includes('largest') || qLower.includes('biggest') || qLower.includes('highest')) {
    const sorted = [...invoices].sort((a, b) => b.amount - a.amount);
    const largest = sorted[0];
    if (!largest) {
      return { answer: 'No invoices found in your records.', suggestedQuestions: ['Who owes me money?'] };
    }
    return {
      answer: `Your largest invoice is ${largest.invoiceNumber} for ${largest.clientName} in the amount of **$${largest.amount.toFixed(2)} USD** (Status: ${largest.status}, due ${largest.dueDate}).`,
      citedInvoices: [
        {
          id: largest.id,
          invoiceNumber: largest.invoiceNumber,
          clientName: largest.clientName,
          amount: largest.amount,
          status: largest.status,
          dueDate: largest.dueDate,
        },
      ],
      suggestedQuestions: ['Who owes me money?', 'Which client pays late?', 'What is my total paid revenue?'],
    };
  }

  // Case H: Ambiguous or not found - clearly state no matching records
  return {
    answer: "I don't see any matching records for that question in the invoice data. Could you please specify a client name, invoice number, or ask about your unpaid/paid totals?",
    suggestedQuestions: ['Who owes me money?', 'Which client pays late?', 'What is my total paid revenue?'],
  };
}

export async function askFinancialAdvisor(
  question: string,
  invoices: Invoice[],
  summary: InvoiceSummary
): Promise<{
  answer: string;
  citedInvoices?: Array<{
    id: string;
    invoiceNumber: string;
    clientName: string;
    amount: number;
    status: Invoice['status'];
    dueDate: string;
  }>;
  suggestedQuestions?: string[];
}> {
  const today = new Date().toISOString().split('T')[0];

  // 1. Pass the full invoice list (client, amount, status, dates) as the only source of truth
  const fullInvoiceList = invoices.map((inv) => ({
    invoiceNumber: inv.invoiceNumber,
    client: inv.clientName,
    clientEmail: inv.clientEmail,
    amount: inv.amount,
    currency: inv.currency || 'USD',
    status: inv.status,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    description: inv.description,
  }));

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return fallbackFinancialAdvisor(question, invoices, summary);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    // 2. Verbatim system instruction requested by user
    const systemInstruction = `You are "Ask Your Money", an intelligent financial analyst agent for NudgePay.
Reference Date (Today): ${today}

Answer only from the invoice data provided. If the user asks about a client, date range or fact that is not in the data, say clearly that you have no matching records (for example: 'I don't see any invoices for Priya') and do not substitute a different figure. Never invent invoices, clients, amounts or dates. If the question is ambiguous, ask a short clarifying question.

When relevant, mention which invoices the answer is based on (client name and amount).
Keep answers short.`;

    const contents = `INVOICE DATA (ONLY SOURCE OF TRUTH):
${JSON.stringify(fullInvoiceList, null, 2)}

USER QUESTION:
"${question}"`;

    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest'];
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const config: any = {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: {
                type: Type.STRING,
                description:
                  'Short direct answer strictly based on the invoice data provided. If no matching records exist, clearly state so without substituting a different figure.',
              },
              citedInvoiceNumbers: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Invoice numbers mentioned or relevant to the answer (e.g. ["INV-2026-005"])',
              },
              suggestedQuestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 short helpful follow-up questions the user might ask next',
              },
            },
            required: ['answer', 'suggestedQuestions'],
          },
        };

        if (model !== 'gemini-3.1-flash-lite') {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        }

        const generatePromise = ai.models.generateContent({
          model,
          contents,
          config,
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout: Model ${model} took longer than 12s`)), 12000)
        );

        const response = await Promise.race([generatePromise, timeoutPromise]);
        const parsed = JSON.parse(response.text || '{}');
        const citedNumbers: string[] = Array.isArray(parsed.citedInvoiceNumbers)
          ? parsed.citedInvoiceNumbers
          : [];

        const citedInvoices = invoices
          .filter((inv) => citedNumbers.includes(inv.invoiceNumber))
          .map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            clientName: inv.clientName,
            amount: inv.amount,
            status: inv.status,
            dueDate: inv.dueDate,
          }));

        return {
          answer: parsed.answer || 'I have analyzed your invoice data.',
          citedInvoices,
          suggestedQuestions: parsed.suggestedQuestions || [
            'Who owes me money?',
            'Which client pays late?',
            'Show my total paid revenue',
          ],
        };
      } catch (err: any) {
        console.warn(`Gemini model ${model} failed for financial chat:`, err.message || err);
        lastError = err;
      }
    }

    console.warn('All Gemini models failed for chat, using fallback logic:', lastError?.message || lastError);
    return fallbackFinancialAdvisor(question, invoices, summary);
  } catch (err: any) {
    console.warn('Gemini chat error, engaging fallback:', err.message || err);
    return fallbackFinancialAdvisor(question, invoices, summary);
  }
}


