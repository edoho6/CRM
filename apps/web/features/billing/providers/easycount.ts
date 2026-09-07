import 'server-only';

import {
  ProviderNotConfiguredError,
  ProviderNotImplementedError,
  type CreatePaymentInput,
  type CreatePaymentResult,
  type PaymentProvider,
  type PaymentUpdate,
  type ProviderContext,
  type ProviderCredentials,
  type WebhookVerification,
} from './types';

/**
 * EasyCount.
 *
 * The shape is here and the wiring is not, deliberately. Building the request
 * and response mapping means knowing EasyCount's actual endpoints, field names and
 * signature scheme, and I do not — inventing plausible ones would produce code
 * that compiles, looks finished, and silently fails to take a payment. A
 * practitioner would find that out from a patient standing at the desk.
 *
 * So each method throws a named error until the mapping is written against
 * their documentation. The settings screen shows the provider as unavailable,
 * the pay button does not appear for it, and nothing pretends otherwise.
 *
 * What is already decided, and what any implementation has to keep:
 *
 *   · the patient pays on EasyCount's domain — we ask for a payment page and
 *     redirect. No card number touches this server, ever.
 *   · `invoiceId` goes out with the request and must come back on the webhook,
 *     because that is what matches a payment to an invoice.
 *   · `verifyWebhook` must actually verify. If EasyCount signs its callbacks, check
 *     the signature; if it does not, say so in `reason` and fall back to
 *     re-reading the payment status from their API before trusting anything.
 *     Never trust the body alone.
 *
 * To finish this: fill in the three methods, add EasyCount's credential fields
 * below, and the rest of the system needs no changes — that is what the
 * registry is for.
 */
export const easycountProvider: PaymentProvider = {
  id: 'easycount',

  credentialFields: [{ key: 'api_key', required: true, secret: true }],

  isConfigured(credentials: ProviderCredentials) {
    return Boolean(credentials.api_key?.trim());
  },

  async createPayment(
    _input: CreatePaymentInput,
    context: ProviderContext,
  ): Promise<CreatePaymentResult> {
    if (!easycountProvider.isConfigured(context.credentials)) {
      throw new ProviderNotConfiguredError('easycount');
    }
    throw new ProviderNotImplementedError('easycount', 'createPayment');
  },

  async verifyWebhook(): Promise<WebhookVerification> {
    return {
      trusted: false,
      reason: 'easycount_webhook_verification_not_implemented',
    };
  },

  async parseWebhook(): Promise<PaymentUpdate> {
    throw new ProviderNotImplementedError('easycount', 'parseWebhook');
  },
};
