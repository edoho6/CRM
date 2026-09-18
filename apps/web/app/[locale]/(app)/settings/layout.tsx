import type { ReactNode } from 'react';
import { requireAbility } from '@/lib/session';

/** The section is closed at the door to a role without `settings` (packages/domain/src/permissions.ts). */
export default async function Layout({ children }: { children: ReactNode }) {
  await requireAbility('settings');
  return children;
}
