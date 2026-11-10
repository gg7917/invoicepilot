import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { ExtractedInvoiceData, LineItem } from '../types/invoice.js';

interface ExtractionResult extends ExtractedInvoiceData {
  usedFallback?: boolean;
  warning?: string;
}

/**
 * Smart heuristic fallback parser if Gemini API encounters temporary network issues,
 * model demand spikes (503), or invalid API keys.
 */
function heuristicExtract(messageText: string, referenceDateStr?: string): ExtractedInvoiceData {
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

  const systemInstruction = `You are InvoicePilot AI, an expert collections and invoicing extraction agent for freelancers and businesses.
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

  // Official models from @google/genai guidelines in order of priority
  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

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

      // Fast per-model timeout (8s for primary, 5s for fallback) to prevent stalls
      const timeoutMs = model === 'gemini-3.8-flash' ? 8000 : 5000;

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
