import 'server-only';

/**
 * The payment provider contract.
 *
 * Three providers are supported — Grow, SUMIT and EasyCount — and a clinic picks
 * one. They differ in their APIs and agree on the only thing that matters here:
 *
 *   **A card number never reaches this system.** We ask the provider for a
 *   payment page, the patient pays on the provider's own domain, and a webhook
 *   tells us what happened. That is the entire reason a provider is involved.
 *   Any adapter that needs a PAN is the wrong shape and must not be written.
 *
 * The interface is deliberately small. Everything a clinic does is one of four
 * things: create something to pay, check whether it was paid, verify that a
 * callback is genuine, and read what the callback says. Anything a provider
 * offers beyond that — subscriptions, tokenised cards, standing orders — is not
 * modelled until it is actually wanted, because an abstraction over three APIs
 * built for features none of them is being used for is an abstraction that fits
 * none of them.
 *
 * All of this runs on the server. `server-only` is not decoration: credentials
 * live in these modules and a stray client import would ship them to a browser.
 */

export const PAYMENT_PROVIDERS = ['grow', 'sumit', 'easycount'] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDERS)[number];

export type PaymentEnvironment = 'sandbox' | 'production';

/** One line on the payment page, so the patient sees what they are paying for. */
export interface PaymentLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreatePaymentInput {
  /** Our invoice, used as the reference the webhook comes back with. */
  invoiceId: string;
  invoiceNumber: number;
  amount: number;
  currency: string;
  lines: PaymentLineInput[];
  payer: {
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  /** Where the patient lands after paying, and where the provider calls us. */
  successUrl: string;
  cancelUrl: string;
  callbackUrl: string;
  /**
   * Israeli invoicing reform: the allocation number a tax invoice above the
   * threshold needs. Passed through when the provider issues the document.
   */
  issueInvoice: boolean;
}

export interface CreatePaymentResult {
  /** Where to send the patient. Always the provider's domain, never ours. */
  paymentUrl: string;
  /** The provider's own id for this attempt, kept so a webhook can be matched. */
  providerReference: string;
}

export type PaymentState = 'paid' | 'pending' | 'failed' | 'cancelled';

export interface PaymentUpdate {
  /** Our invoice id, recovered from whatever the provider echoed back. */
  invoiceId: string | null;
  providerReference: string | null;
  state: PaymentState;
  amountPaid: number | null;
  /** The provider's receipt or tax document, when it issued one. */
  documentUrl: string | null;
  /** Kept verbatim for the audit trail and for diagnosing a mismatch. */
  raw: unknown;
}

/**
 * Whether an incoming webhook is genuinely from the provider.
 *
 * `trusted: false` must stop the update. A payment status that anyone on the
 * internet can set by POSTing to a URL is not a payment status.
 *
 * `reason` explains what was checked, because the providers differ in what they
 * can offer and the difference is worth stating rather than hiding behind a
 * boolean — Grow, for one, sends no signature at all.
 */
export interface WebhookVerification {
  trusted: boolean;
  reason: string;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;

  /** Which credential fields the settings screen should ask for. */
  readonly credentialFields: readonly {
    key: string;
    required: boolean;
    secret: boolean;
  }[];

  /** True when the stored credentials are complete enough to attempt a call. */
  isConfigured(credentials: ProviderCredentials): boolean;

  createPayment(input: CreatePaymentInput, context: ProviderContext): Promise<CreatePaymentResult>;

  verifyWebhook(
    request: { headers: Headers; rawBody: string },
    context: ProviderContext,
  ): Promise<WebhookVerification>;

  parseWebhook(rawBody: string, context: ProviderContext): Promise<PaymentUpdate>;
}

export type ProviderCredentials = Record<string, string | undefined>;

export interface ProviderContext {
  environment: PaymentEnvironment;
  credentials: ProviderCredentials;
}

/** Thrown when a provider is asked to do something it has not been set up for. */
export class ProviderNotConfiguredError extends Error {
  constructor(provider: PaymentProviderId) {
    super(`payment_provider_not_configured:${provider}`);
    this.name = 'ProviderNotConfiguredError';
  }
}

/** Thrown when an adapter exists but its API mapping has not been written yet. */
export class ProviderNotImplementedError extends Error {
  constructor(provider: PaymentProviderId, what: string) {
    super(`payment_provider_not_implemented:${provider}:${what}`);
    this.name = 'ProviderNotImplementedError';
  }
}
