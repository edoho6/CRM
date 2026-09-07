import { z } from 'zod';
import { LOCALES, SEXES, TREATMENT_STATUSES } from '../enums';
import { optionalDate, optionalEmail, optionalText, requiredText } from './common';

/** Payload for creating/updating a patient. Used by the form and the Server Action. */
export const patientFormSchema = z.object({
  first_name: requiredText(80),
  last_name: requiredText(80),
  date_of_birth: optionalDate,
  sex: z.enum(SEXES).default('unspecified'),
  national_id: optionalText(20),
  phone: optionalText(30),
  email: optionalEmail,
  address: optionalText(300),
  city: optionalText(80),
  emergency_contact_name: optionalText(120),
  emergency_contact_phone: optionalText(30),
  occupation: optionalText(120),
  referral_source: optionalText(120),
  preferred_locale: z.enum(LOCALES).default('he'),
  notes: optionalText(4000),
  /**
   * The only status. `is_active` used to be a second, independent field asking
   * the same question, and is now derived from this by a trigger — so it is
   * deliberately not in this payload: sending it would let a form overwrite a
   * recorded outcome with a checkbox.
   */
  treatment_status: z.enum(TREATMENT_STATUSES).default('active'),
});

export type PatientFormValues = z.input<typeof patientFormSchema>;
export type PatientFormData = z.output<typeof patientFormSchema>;

/** Sensitive clinical background, stored separately from contact details. */
export const patientMedicalHistorySchema = z.object({
  allergies: optionalText(2000),
  medications: optionalText(2000),
  chronic_conditions: optionalText(2000),
  surgeries: optionalText(2000),
  family_history: optionalText(2000),
  lifestyle_notes: optionalText(2000),
  pregnancy_status: optionalText(200),
});

export type PatientMedicalHistoryValues = z.input<typeof patientMedicalHistorySchema>;
export type PatientMedicalHistoryData = z.output<typeof patientMedicalHistorySchema>;
