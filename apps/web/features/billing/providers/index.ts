import 'server-only';

import { growProvider } from './grow';
import { sumitProvider } from './sumit';
import { easycountProvider } from './easycount';
import {
  PAYMENT_PROVIDERS,
  type PaymentProvider,
  type PaymentProviderId,
  type ProviderContext,
} from './types';

export * from './types';

/**
 * The registry.
 *
 * Every screen and every action asks for a provider by id and gets the same
 * interface back, so nothing outside this folder knows which company is taking
 * the money. Adding a fourth means writing an adapter and adding one line here.
 *
 * Which provider a clinic uses is a row in `clinic_payment_settings`, not an
 * environment variable — it belongs to the practice rather than to the
 * deployment, and a multi-clinic install has a different answer per tenant.
 */
const REGISTRY: Record<PaymentProviderId, PaymentProvider> = {
  grow: growProvider,
  sumit: sumitProvider,
  easycount: easycountProvider,
};

export function getPaymentProvider(id: PaymentProviderId): PaymentProvider {
  return REGISTRY[id];
}

export function isPaymentProviderId(value: unknown): value is PaymentProviderId {
  return typeof value === 'string' && (PAYMENT_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Which providers can actually take a payment today.
 *
 * Grow is wired; SUMIT and EasyCount have their shape and not their mapping. The
 * settings screen uses this to show them as unavailable rather than letting a
 * practitioner configure one, believe they are set up, and discover otherwise
 * with a patient standing at the desk.
 */
export function isProviderImplemented(id: PaymentProviderId): boolean {
  return id === 'grow';
}

/** Reads the credentials for one provider out of the settings blob. */
export function providerContext(
  id: PaymentProviderId,
  settings: { environment: string; credentials: unknown } | null,
): ProviderContext {
  const all =
    settings && typeof settings.credentials === 'object' && settings.credentials !== null
      ? (settings.credentials as Record<string, unknown>)
      : {};

  const raw = all[id];
  const credentials: Record<string, string | undefined> = {};

  if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === 'string') credentials[key] = value;
    }
  }

  return {
    environment: settings?.environment === 'production' ? 'production' : 'sandbox',
    credentials,
  };
}
