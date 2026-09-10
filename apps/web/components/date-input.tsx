'use client';

/**
 * The date field lives in the shared kit now (`@clinic/ui`), because the
 * questionnaire renderer — used by this app and by the patient portal — needs
 * the same day/month/year behaviour. Its words come from `UiLabelsProvider`
 * in the root layout. This module stays so the forms that import it keep
 * working unchanged.
 */
export { DateInput } from '@clinic/ui';
