import type { ReactNode } from 'react';
import { requireAbility } from '@/lib/session';

/** The section is closed at the door to a role without `messages` (packages/domain/src/permissions.ts). */
export default async function Layout({ children }: { children: ReactNode }) {
  await requireAbility('messages');
  return children;
}
