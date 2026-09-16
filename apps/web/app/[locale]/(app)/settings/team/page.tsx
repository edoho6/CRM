import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageBody } from '@clinic/ui';
import type { ClinicInvitation, Membership, Profile } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { serverNow } from '@/lib/server-now';
import { SettingsNav } from '@/features/settings/settings-nav';
import { TeamPanel, type TeamMember } from '@/features/settings/team-panel';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('settings.team', 'title');

/**
 * The clinic's people. Members come from the memberships table (the
 * colleagues policy shows every member their clinic's rows), names from
 * profiles; open invitations are read only by an owner, because the
 * policy on that table gives nobody else a row.
 */
export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const scope = await getClinicScope();
  if (!scope) return null;
  const t = await getTranslations('settings.team');
  const isOwner = scope.context.membership.role === 'owner';

  const { data: memberships } = await scope.supabase
    .from('memberships')
    .select('*')
    .eq('clinic_id', scope.context.clinic.id)
    .order('created_at', { ascending: true })
    .returns<Membership[]>();
  const rows = memberships ?? [];

  const [{ data: profiles }, invitationsResult] = await Promise.all([
    scope.supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', rows.map((row) => row.user_id))
      .returns<Pick<Profile, 'id' | 'full_name'>[]>(),
    isOwner
      ? scope.supabase
          .from('clinic_invitations')
          .select('*')
          .eq('clinic_id', scope.context.clinic.id)
          .is('accepted_at', null)
          .order('created_at', { ascending: false })
          .returns<ClinicInvitation[]>()
      : Promise.resolve({ data: [] as ClinicInvitation[] }),
  ]);
  const nameOf = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name?.trim() || '']));

  const members: TeamMember[] = rows.map((row) => ({
    membershipId: row.id,
    userId: row.user_id,
    name: nameOf.get(row.user_id) || t('unnamedMember'),
    role: row.role,
    isActive: row.is_active,
    joinedAt: row.created_at,
  }));

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} below={<SettingsNav />} />
      <PageBody width="narrow">
        <TeamPanel
          members={members}
          invitations={invitationsResult.data ?? []}
          isOwner={isOwner}
          selfUserId={scope.context.membership.user_id}
          renderedAt={serverNow()}
        />
      </PageBody>
    </>
  );
}
