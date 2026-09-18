import type { ReactNode } from 'react';
import { requireAbility } from '@/lib/session';

/** The clinic's payment provider is a clinic setting, and the settings are the owner's (18.9). */
export default async function Layout({ children }: { children: ReactNode }) {
  await requireAbility('settings');
  return children;
}
