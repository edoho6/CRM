// One adapter per platform. A platform with no adapter ("unsupported") makes
// the run end with `no_adapter`, which the admin screen shows as such.

import type { Adapter, StorePlatform } from '../types.ts';
import { htmlCashcow } from './html-cashcow.ts';
import { htmlKala } from './html-kala.ts';
import { htmlMagento1 } from './html-magento1.ts';
import { shopify } from './shopify.ts';
import { woocommerce } from './woocommerce.ts';

export const ADAPTERS: Partial<Record<StorePlatform, Adapter>> = {
  woocommerce,
  shopify,
  html_cashcow: htmlCashcow,
  html_kala: htmlKala,
  html_magento1: htmlMagento1,
};
