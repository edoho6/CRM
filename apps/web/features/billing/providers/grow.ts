import 'server-only';

import { createPaymentProcess } from '../grow-client';
import {
  ProviderNotConfiguredError,
  type CreatePaymentInput,
  type CreatePaymentResult,
  type PaymentProvider,
  type PaymentUpdate,
  type ProviderContext,
  type ProviderCredentials,
  type WebhookVerification,
} from './types';

/**
 * Grow (formerly Meshulam).
 *
 * A thin adapter over the client that was already here, so the rest of the
 * system can stop knowing about Grow specifically. The client keeps the
 * form-encoded request building and the odd field names; this maps them onto the
 * shape every provider shares.
 *
 * The honest part, and it has not changed: **Grow sends no cryptographic
 * signature on its callback.** It sends the process id and the process token it
 * gave us when the payment page was created, and those are what can be checked.
 * That is weaker than an HMAC — anyone who obtained both could forge a callback
 * — but it is what the provider offers, so `verifyWebhook` says exactly what it
 * verified rather than returning a bare `true` that implies more.
 */
export const growProvider: PaymentProvider = {
  id: 'grow',

  credentialFields: [
    { key: 'user_id', required: true, secret: false },
    { key: 'page_code', required: true, secret: false },
    // Only needed for platform integrations; a single clinic leaves it empty.
    { key: 'api_key', required: false, secret: true },
  ],

  isConfigured(credentials: ProviderCredentials) {
    return Boolean(credentials.user_id?.trim() && credentials.page_code?.trim());
  },

  async createPayment(
    input: CreatePaymentInput,
    context: ProviderContext,
  ): Promise<CreatePaymentResult> {
    if (!growProvider.isConfigured(context.credentials)) {
      throw new ProviderNotConfiguredError('grow');
    }

    const result = await createPaymentProcess(
      {
        environment: context.environment,
        userId: context.credentials.user_id!,
        pageCode: context.credentials.page_code!,
      },
      {
        sum: input.amount,
        // Grow shows this on the payment page and caps it, so it says what is
        // being paid for rather than listing every line.
        description: input.lines[0]?.description ?? `#${input.invoiceNumber}`,
        fullName: input.payer.name,
        phone: input.payer.phone ?? '',
        email: input.payer.email,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        notifyUrl: input.callbackUrl,
        // Echoed back on the callback: this is what matches a payment to an
        // invoice, and without it a webhook cannot be acted on at all.
        reference: input.invoiceId,
      },
    );

    if (!result.ok || !result.data) {
      throw new Error(result.error ?? 'grow_create_payment_failed');
    }

    return {
      paymentUrl: result.data.url,
      providerReference: result.data.processId,
    };
  },

  async verifyWebhook(request: {
    headers: Headers;
    rawBody: string;
  }): Promise<WebhookVerification> {
    // Grow posts form-encoded fields, not JSON.
    const params = new URLSearchParams(request.rawBody);
    const processId = params.get('data[processId]') ?? params.get('processId');
    const processToken = params.get('data[processToken]') ?? params.get('processToken');

    if (!processId || !processToken) {
      return { trusted: false, reason: 'grow_callback_missing_process_identifiers' };
    }

    // The caller checks these against what was stored when the page was created.
    // That is the strongest check Grow makes possible; it is not a signature and
    // is not described as one.
    return {
      trusted: true,
      reason: 'grow_process_id_and_token_present_pending_stored_comparison',
    };
  },

  async parseWebhook(rawBody: string): Promise<PaymentUpdate> {
    const params = new URLSearchParams(rawBody);
    const status = params.get('data[statusCode]') ?? params.get('statusCode');
    const sum = params.get('data[sum]') ?? params.get('sum');

    return {
      invoiceId: params.get('data[customFields][cField1]') ?? params.get('reference'),
      providerReference: params.get('data[processId]') ?? params.get('processId'),
      // Grow uses 2 for a completed transaction; anything else is not a payment.
      state: status === '2' ? 'paid' : status === '0' ? 'failed' : 'pending',
      amountPaid: sum ? Number(sum) : null,
      documentUrl: params.get('data[invoiceUrl]') ?? null,
      raw: Object.fromEntries(params.entries()),
    };
  },
};
