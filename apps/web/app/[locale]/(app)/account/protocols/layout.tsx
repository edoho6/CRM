import type { ReactNode } from 'react';
import { requireAbility } from '@/lib/session';

/** Treatment protocols are clinical content: closed to a role without clinical records. */
export default async function Layout({ children }: { children: ReactNode }) {
  await requireAbility('clinicalRecords');
  return children;
}
