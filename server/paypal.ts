import { Invoice, InvoiceStatus } from '../types/invoice.js';

const PAYPAL_SANDBOX_API = 'https://api-m.sandbox.paypal.com';

// Default confirmed sandbox business merchant email
const DEFAULT_SANDBOX_MERCHANT_EMAIL = 'sb-oogc653795134@business.example.com';

interface PayPalTokenResponse {
  access_token: string;
  token_type: string;
  app_id: string;
  expires_in: number;
}

export function getPayPalCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim() || '';
  // Optional MERCHANT_EMAIL: defaults to sb-oogc653795134@business.example.com
  // If explicitly set to empty string (""), email_address will be omitted so PayPal uses the account's own email
  const merchantEmail =
    process.env.MERCHANT_EMAIL !== undefined
      ? process.env.MERCHANT_EMAIL.trim()
      : DEFAULT_SANDBOX_MERCHANT_EMAIL;

  return {
    clientId,
    clientSecret,
    merchantEmail,
    isConfigured: Boolean(clientId && clientSecret),
  };
}

/**
 * Ensures any PayPal link explicitly targets the sandbox domain (sandbox.paypal.com),
 * and converts any live domain references to sandbox.
 */
export function ensureSandboxUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  let trimmed = url.trim();
  if (!trimmed) return undefined;

  // Convert live PayPal domains to sandbox.paypal.com
  trimmed = trimmed
    .replace('https://www.paypal.com', 'https://www.sandbox.paypal.com')
    .replace('http://www.paypal.com', 'https://www.sandbox.paypal.com')
    .replace('https://paypal.com', 'https://sandbox.paypal.com')
    .replace('http://paypal.com', 'https://sandbox.paypal.com');

  return trimmed;
}

/**
 * Fetch OAuth 2.0 Access Token from PayPal Sandbox
 */
async function getPayPalAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${PAYPAL_SANDBOX_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `PayPal Sandbox Authentication failed (${response.status}): ${errorBody}. Check your PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.`
    );
  }

  const data = (await response.json()) as PayPalTokenResponse;
  return data.access_token;
}

/**
 * Splits a full client name into given name and surname for PayPal API
 */
function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { given_name: parts[0], surname: 'Client' };
  }
  return {
    given_name: parts[0],
    surname: parts.slice(1).join(' '),
  };
}

/**
 * Queries PayPal Sandbox for the next recommended invoice number.
 */
async function getNextPayPalInvoiceNumber(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${PAYPAL_SANDBOX_API}/v2/invoicing/generate-next-invoice-number`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.invoice_number) {
        return String(data.invoice_number);
      }
    }
  } catch (err) {
    console.warn('Could not generate next invoice number from PayPal API:', err);
  }
  return null;
}

/**
 * Creates and sends an invoice through PayPal Invoicing API in Sandbox.
 * Does NOT construct manual URLs. Fetches the invoice details directly
 * from GET /v2/invoicing/invoices/{id} to obtain the official recipient_view_url
 * and invoicer_view_url from PayPal's response metadata.
 */
export async function createAndSendPayPalInvoice(invoice: Invoice): Promise<{
  paypalInvoiceId: string;
  paypalPaymentLink?: string;
  paypalSellerLink?: string;
  isSimulated: boolean;
  message?: string;
  updatedInvoiceNumber?: string;
}> {
  const { clientId, clientSecret, merchantEmail, isConfigured } = getPayPalCredentials();

  // If PayPal Sandbox credentials are not provided, operate in Simulation Mode without broken manual links
  if (!isConfigured) {
    const mockId = `INV2-SANDBOX-DEMO-${Date.now().toString(36).toUpperCase()}`;
    return {
      paypalInvoiceId: mockId,
      paypalPaymentLink: undefined, // Do not build fake manual links
      paypalSellerLink: undefined,
      isSimulated: true,
      message:
        'Created in PayPal Sandbox Simulation Mode. Configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in Settings > Secrets to generate live sandbox checkout links.',
    };
  }

  // Real PayPal Sandbox API Call
  const accessToken = await getPayPalAccessToken(clientId, clientSecret);
  const nameObj = splitName(invoice.clientName);

  // Recipient email from invoice, or fallback client email
  const recipientEmail =
    invoice.clientEmail && invoice.clientEmail.includes('@')
      ? invoice.clientEmail.trim()
      : 'client@example.com';

  // Invoicer object: if merchantEmail is provided, use it; otherwise omit email_address so PayPal defaults to the account's own email
  const invoicerObj: any = {
    name: {
      given_name: 'NudgePay',
      surname: 'Merchant',
    },
  };
  if (merchantEmail) {
    invoicerObj.email_address = merchantEmail;
  }

  let invoiceNumberToUse = invoice.invoiceNumber;
  let updatedInvoiceNumber: string | undefined = undefined;

  const payload: any = {
    detail: {
      invoice_number: invoiceNumberToUse,
      reference: invoice.id,
      invoice_date: invoice.issueDate || new Date().toISOString().split('T')[0],
      currency_code: 'USD',
      note: invoice.notes || 'Thank you for your business. Generated by NudgePay.',
      payment_term: {
        term_type: 'DUE_ON_DATE_SPECIFIED',
        due_date: invoice.dueDate,
      },
    },
    invoicer: invoicerObj,
    primary_recipients: [
      {
        billing_info: {
          name: {
            given_name: nameObj.given_name,
            surname: nameObj.surname,
          },
          email_address: recipientEmail,
        },
      },
    ],
    items: invoice.lineItems.map((item) => ({
      name: item.name.substring(0, 100),
      description: (item.description || item.name).substring(0, 1000),
      quantity: String(item.quantity || 1),
      unit_amount: {
        currency_code: 'USD',
        value: Number(item.unitPrice || 0).toFixed(2),
      },
      unit_of_measure: 'QUANTITY',
    })),
  };

  // Step 1: Create Invoice in PayPal Sandbox
  let createRes = await fetch(`${PAYPAL_SANDBOX_API}/v2/invoicing/invoices`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `req-${invoice.id}-${Date.now()}`,
    },
    body: JSON.stringify(payload),
  });

  // Handle potential DUPLICATE_INVOICE_NUMBER (422) by automatically fetching or generating the next number
  if (!createRes.ok && createRes.status === 422) {
    const errorBody = await createRes.text();
    if (errorBody.includes('DUPLICATE_INVOICE_NUMBER')) {
      console.warn(`Invoice number ${invoiceNumberToUse} already exists on PayPal. Generating next number...`);
      const nextNumber =
        (await getNextPayPalInvoiceNumber(accessToken)) ||
        `${invoice.invoiceNumber}-${Math.floor(1000 + Math.random() * 9000)}`;

      invoiceNumberToUse = nextNumber;
      updatedInvoiceNumber = nextNumber;
      payload.detail.invoice_number = nextNumber;

      createRes = await fetch(`${PAYPAL_SANDBOX_API}/v2/invoicing/invoices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `req-${invoice.id}-${Date.now()}-retry`,
        },
        body: JSON.stringify(payload),
      });
    } else {
      throw new Error(`Failed to create invoice in PayPal Sandbox (422): ${errorBody}`);
    }
  }

  if (!createRes.ok) {
    const errorBody = await createRes.text();
    throw new Error(`Failed to create invoice in PayPal Sandbox (${createRes.status}): ${errorBody}`);
  }

  const createData = await createRes.json().catch(() => ({}));
  const locationHeader = createRes.headers.get('location') || '';

  // PayPal Invoicing v2 returns HTTP 201 with body {"rel":"self","href":".../invoices/{id}"}
  // The ID is not in createData.id, but at the end of href or Location header
  const rawIdFromHref = createData.href ? createData.href.split('/').filter(Boolean).pop() : '';
  const rawIdFromLocation = locationHeader ? locationHeader.split('/').filter(Boolean).pop() : '';
  const paypalInvoiceId = createData.id || rawIdFromHref || rawIdFromLocation;

  if (!paypalInvoiceId) {
    throw new Error(
      `Failed to parse PayPal invoice ID from creation response. Received href: "${createData.href}", location: "${locationHeader}"`
    );
  }

  console.log(`Successfully created PayPal Sandbox invoice with ID: ${paypalInvoiceId}`);

  // Step 2: Send Invoice via PayPal Sandbox
  const sendRes = await fetch(`${PAYPAL_SANDBOX_API}/v2/invoicing/invoices/${encodeURIComponent(paypalInvoiceId)}/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      send_to_recipient: true,
      send_to_invoicer: false,
    }),
  });

  if (!sendRes.ok) {
    const errorBody = await sendRes.text();
    throw new Error(`Failed to send invoice in PayPal Sandbox (${sendRes.status}): ${errorBody}`);
  }

  // Attempt to read send response which sometimes returns payer-view link directly
  let initialPayerLink: string | undefined = undefined;
  try {
    const sendData = await sendRes.json();
    if (sendData?.rel === 'payer-view' && sendData?.href) {
      initialPayerLink = ensureSandboxUrl(sendData.href);
    } else if (Array.isArray(sendData?.links)) {
      const payerLinkObj = sendData.links.find((l: any) => l.rel === 'payer-view');
      if (payerLinkObj?.href) {
        initialPayerLink = ensureSandboxUrl(payerLinkObj.href);
      }
    }
  } catch {
    // Send response may be 204 or empty
  }

  // Step 3: Fetch Invoice details to extract recipient_view_url and invoicer_view_url
  let paypalPaymentLink: string | undefined = initialPayerLink;
  let paypalSellerLink: string | undefined = undefined;

  // Retry up to 3 times with brief pause to ensure PayPal metadata is populated
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const detailsRes = await fetch(`${PAYPAL_SANDBOX_API}/v2/invoicing/invoices/${encodeURIComponent(paypalInvoiceId)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (detailsRes.ok) {
        const detailsData = await detailsRes.json();

        // Extract recipient_view_url from response metadata
        const rawRecipient =
          detailsData.detail?.metadata?.recipient_view_url ||
          detailsData.links?.find((l: any) => l.rel === 'payer-view')?.href;

        // Extract invoicer_view_url from response metadata
        const rawInvoicer =
          detailsData.detail?.metadata?.invoicer_view_url ||
          detailsData.links?.find((l: any) => l.rel === 'self')?.href;

        if (rawRecipient) {
          paypalPaymentLink = ensureSandboxUrl(rawRecipient);
        }
        if (rawInvoicer) {
          paypalSellerLink = ensureSandboxUrl(rawInvoicer);
        }

        if (paypalPaymentLink) {
          break;
        }
      }
    } catch (err) {
      console.warn(`Attempt ${attempt + 1}: Could not fetch PayPal details for ${paypalInvoiceId}:`, err);
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  return {
    paypalInvoiceId,
    paypalPaymentLink,
    paypalSellerLink,
    isSimulated: false,
    updatedInvoiceNumber,
  };
}

// Real PayPal Sandbox Invoicing v2 ID format: INV2-XXXX-XXXX-XXXX-XXXX
export const REAL_PAYPAL_ID_REGEX = /^INV2-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/**
 * Maps raw PayPal Invoicing API status string to NudgePay application status.
 * Specification:
 * - PAID or MARKED_AS_PAID -> "Paid"
 * - PARTIALLY_PAID -> "Partially paid"
 * - SENT or UNPAID -> "Sent"
 * - PAYMENT_PENDING -> "Payment pending"
 * - CANCELLED -> "Cancelled"
 */
export function mapPayPalStatusToInvoiceStatus(rawStatus: string): InvoiceStatus {
  const upper = (rawStatus || '').toUpperCase().trim();
  if (upper === 'PAID' || upper === 'MARKED_AS_PAID') {
    return 'Paid';
  }
  if (upper === 'PARTIALLY_PAID') {
    return 'Partially paid';
  }
  if (upper === 'PAYMENT_PENDING') {
    return 'Payment pending';
  }
  if (upper === 'CANCELLED' || upper === 'REFUNDED') {
    return 'Cancelled';
  }
  if (upper === 'DRAFT') {
    return 'Draft';
  }
  // SENT or UNPAID -> "Sent"
  return 'Sent';
}

export interface PayPalStatusResult {
  success: boolean;
  status?: InvoiceStatus;
  rawPayPalStatus?: string;
  paymentLink?: string;
  sellerLink?: string;
  error?: string;
  isInvalidId?: boolean;
}

/**
 * Fetch latest status of an invoice from PayPal Sandbox,
 * and updates recipient_view_url & invoicer_view_url.
 * Returns error details if call fails instead of silently ignoring it.
 */
export async function fetchPayPalInvoiceStatus(paypalInvoiceId: string): Promise<PayPalStatusResult> {
  const { clientId, clientSecret, isConfigured } = getPayPalCredentials();

  // Validate format of PayPal invoice ID
  if (!paypalInvoiceId || !REAL_PAYPAL_ID_REGEX.test(paypalInvoiceId)) {
    return {
      success: false,
      error: `Invalid or made-up PayPal ID "${paypalInvoiceId}". Real PayPal IDs match INV2-XXXX-XXXX-XXXX-XXXX.`,
      rawPayPalStatus: 'INVALID_ID',
      isInvalidId: true,
    };
  }

  if (!isConfigured) {
    return {
      success: false,
      error: 'PayPal Sandbox credentials (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) not configured.',
      rawPayPalStatus: 'NOT_CONFIGURED',
    };
  }

  try {
    const accessToken = await getPayPalAccessToken(clientId, clientSecret);
    const response = await fetch(`${PAYPAL_SANDBOX_API}/v2/invoicing/invoices/${encodeURIComponent(paypalInvoiceId)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      let parsedMessage = `HTTP ${response.status}`;
      try {
        const j = JSON.parse(errText);
        parsedMessage = j.message || j.name || parsedMessage;
      } catch {
        parsedMessage = errText || parsedMessage;
      }

      console.warn(`Failed to fetch PayPal status for ${paypalInvoiceId}:`, response.status, parsedMessage);
      return {
        success: false,
        error: `PayPal API Error (${response.status}): ${parsedMessage}`,
        rawPayPalStatus: `HTTP_${response.status}`,
      };
    }

    const data = await response.json();
    const rawStatus = (data.status || '').toUpperCase().trim();
    const appStatus = mapPayPalStatusToInvoiceStatus(rawStatus);

    // Extract official recipient_view_url & invoicer_view_url
    const rawRecipient =
      data.detail?.metadata?.recipient_view_url ||
      data.links?.find((l: any) => l.rel === 'payer-view')?.href;

    const rawInvoicer =
      data.detail?.metadata?.invoicer_view_url ||
      data.links?.find((l: any) => l.rel === 'self')?.href;

    const paymentLink = ensureSandboxUrl(rawRecipient);
    const sellerLink = ensureSandboxUrl(rawInvoicer);

    return {
      success: true,
      status: appStatus,
      rawPayPalStatus: rawStatus || 'UNKNOWN',
      paymentLink,
      sellerLink,
    };
  } catch (err: any) {
    console.error(`Error querying PayPal for ${paypalInvoiceId}:`, err);
    return {
      success: false,
      error: err.message || 'Network error communicating with PayPal Sandbox',
      rawPayPalStatus: 'NETWORK_ERROR',
    };
  }
}

/**
 * Searches / lists all invoices in the connected PayPal Sandbox account.
 * Used to verify real invoice IDs and auto-link invoices created in Sandbox.
 */
export async function searchPayPalInvoices(): Promise<Array<{
  id: string;
  invoice_number?: string;
  status: string;
  recipient_view_url?: string;
  invoicer_view_url?: string;
}>> {
  const { clientId, clientSecret, isConfigured } = getPayPalCredentials();
  if (!isConfigured) return [];

  try {
    const accessToken = await getPayPalAccessToken(clientId, clientSecret);
    const response = await fetch(`${PAYPAL_SANDBOX_API}/v2/invoicing/invoices?page=1&page_size=50&total_required=true`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!Array.isArray(data.items)) return [];

    return data.items.map((it: any) => ({
      id: it.id,
      invoice_number: it.detail?.invoice_number,
      status: (it.status || '').toUpperCase().trim(),
      recipient_view_url: ensureSandboxUrl(
        it.detail?.metadata?.recipient_view_url || it.links?.find((l: any) => l.rel === 'payer-view')?.href
      ),
      invoicer_view_url: ensureSandboxUrl(
        it.detail?.metadata?.invoicer_view_url || it.links?.find((l: any) => l.rel === 'self')?.href
      ),
    }));
  } catch (err) {
    console.warn('Could not list invoices from PayPal Sandbox:', err);
    return [];
  }
}
