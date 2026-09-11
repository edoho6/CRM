import { z } from 'zod';
import { SHOP_STORE_STATUSES } from '../enums';
import { optionalText, uuidField } from './common';

/**
 * Price comparison — the two things a platform admin may change from the app.
 *
 * Everything else about the shops is written by the fetch job, not by a form:
 * there is no schema for a product or a price because no one types one in.
 */

export const shopStoreStatusSchema = z.object({
  storeId: uuidField,
  status: z.enum(SHOP_STORE_STATUSES),
  note: optionalText(300),
});
export type ShopStoreStatusInput = z.input<typeof shopStoreStatusSchema>;

export const shopRefreshSchema = z.object({
  storeId: uuidField,
});
export type ShopRefreshInput = z.input<typeof shopRefreshSchema>;
