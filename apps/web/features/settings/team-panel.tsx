'use client';

import { useEffect, useState, useTransition } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Check, Copy, Link2, UserPlus, X } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dash,
  Field,
  FieldGrid,
  Input,
  Select,
  Table,
  TableWrapper,
  Td,
  Th,
  Tr,
  useToast,
} from '@clinic/ui';
import { INVITABLE_ROLES, MEMBERSHIP_ROLES, type InvitableRole, type MembershipRole } from '@clinic/domain';
import type { ClinicInvitation } from '@clinic/db/types';
import { useRouter } from '@clinic/i18n/navigation';
import { describeActionError } from '@/lib/action-error';
import { createInvitation, revokeInvitation, setMemberActive, setMemberRole } from './team-actions';

export interface TeamMember {
  membershipId: string;
  userId: string;
  name: string;
  role: MembershipRole;
  isActive: boolean;
  joinedAt: string;
}

/**
 * Who works here, and who is on the way.
 *
 * An owner changes roles and switches people off or on, and makes
 * invitation links — a link, not an email: the owner sends it the way they
 * talk to the person, and the app has nothing to deliver. Everyone else
 * sees the list and nothing to press. The two things an owner cannot do to
 * their own row are refused by the database and explained here.
 */
export function TeamPanel({
  members,
  invitations,
  isOwner,
  selfUserId,
}: {
  members: TeamMember[];
  invitations: ClinicInvitation[];
  isOwner: boolean;
  selfUserId: string;
}) {
  const t = useTranslations('settings.team');
  const tc = useTranslations('common');
  const tAll = useTranslations();
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [role, setRole] = useState<InvitableRole>('practitioner');
  const [inviteeName, setInviteeName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const linkFor = (token: string) => (origin ? `${origin}/${locale}/join/${token}` : '');
  const fail = (key: string | undefined) => toast({ tone: 'danger', title: describeActionError(tAll, key) });

  function invite(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createInvitation({ role, inviteeName });
      if (!result.ok) {
        setError(describeActionError(tAll, result.error.key));
        return;
      }
      setFresh(result.data.token);
      setInviteeName('');
      toast({ tone: 'success', title: t('created') });
      router.refresh();
    });
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      toast({ tone: 'success', title: t('copied') });
    } catch {
      toast({ tone: 'danger', title: t('copyFailed') });
    }
  }

  function revoke(id: string) {
    setBusy(id);
    startTransition(async () => {
      const result = await revokeInvitation(id);
      setBusy(null);
      if (!result.ok) {
        fail(result.error.key);
        return;
      }
      toast({ tone: 'success', title: t('revoked') });
      router.refresh();
    });
  }

  function changeRole(member: TeamMember, next: MembershipRole) {
    setBusy(member.membershipId);
    startTransition(async () => {
      const result = await setMemberRole({ membershipId: member.membershipId, role: next });
      setBusy(null);
      if (!result.ok) {
        fail(result.error.key);
        return;
      }
      toast({ tone: 'success', title: t('saved') });
      router.refresh();
    });
  }

  function toggleActive(member: TeamMember) {
    setBusy(member.membershipId);
    startTransition(async () => {
      const result = await setMemberActive({ membershipId: member.membershipId, active: !member.isActive });
      setBusy(null);
      if (!result.ok) {
        fail(result.error.key);
        return;
      }
      toast({ tone: 'success', title: t('saved') });
      router.refresh();
    });
  }

  const open = invitations.filter((i) => !i.accepted_at && !i.revoked_at && Date.parse(i.expires_at) > Date.now());

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{t('members')}</CardTitle>
          <span className="text-xs text-ink-500">{members.length}</span>
        </CardHeader>
        <CardBody className="space-y-3 p-0">
          <TableWrapper inset responsive>
            <Table>
              <thead>
                <tr>
                  <Th>{tc('name')}</Th>
                  <Th>{t('role')}</Th>
                  <Th>{tc('status')}</Th>
                  <Th>{t('joined')}</Th>
                  {isOwner ? <Th>{tc('actions')}</Th> : null}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const self = member.userId === selfUserId;
                  const rowBusy = isPending && busy === member.membershipId;
                  return (
                    <Tr key={member.membershipId}>
                      <Td data-card-title>
                        <span className="font-medium text-ink-900">{member.name}</span>
                        {self ? <span className="ms-1.5 text-xs text-ink-500">{t('you')}</span> : null}
                      </Td>
                      <Td>
                        {isOwner && !self ? (
                          <Select
                            compact
                            aria-label={t('roleOf', { name: member.name })}
                            value={member.role}
                            disabled={rowBusy}
                            onChange={(event) => changeRole(member, event.target.value as MembershipRole)}
                          >
                            {MEMBERSHIP_ROLES.map((value) => (
                              <option key={value} value={value}>
                                {t(`roles.${value}`)}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          t(`roles.${member.role}`)
                        )}
                      </Td>
                      <Td>
                        {member.isActive ? (
                          <Badge tone="success">{tc('active')}</Badge>
                        ) : (
                          <Badge tone="muted">{tc('inactive')}</Badge>
                        )}
                      </Td>
                      <Td>{format.dateTime(new Date(member.joinedAt), { dateStyle: 'short' })}</Td>
                      {isOwner ? (
                        <Td>
                          {self ? (
                            <Dash />
                          ) : (
                            <Button size="sm" variant="secondary" disabled={rowBusy} onClick={() => toggleActive(member)}>
                              {member.isActive ? t('deactivate') : t('activate')}
                            </Button>
                          )}
                        </Td>
                      ) : null}
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrapper>
          <p className="px-4 pb-4 text-xs text-ink-600">{t('roleHint')}</p>
        </CardBody>
      </Card>

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <UserPlus className="me-1.5 inline h-4 w-4" aria-hidden />
              {t('inviteTitle')}
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-ink-600">{t('inviteIntro')}</p>
            <form onSubmit={invite} className="space-y-3">
              {error ? <Alert tone="danger">{error}</Alert> : null}
              <FieldGrid>
                <Field label={t('inviteRole')} htmlFor="invite-role">
                  <Select id="invite-role" value={role} onChange={(event) => setRole(event.target.value as InvitableRole)} disabled={isPending}>
                    {INVITABLE_ROLES.map((value) => (
                      <option key={value} value={value}>
                        {t(`roles.${value}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('inviteName')} htmlFor="invite-name" hint={t('inviteNameHint')}>
                  <Input id="invite-name" value={inviteeName} onChange={(event) => setInviteeName(event.target.value)} maxLength={80} disabled={isPending} />
                </Field>
              </FieldGrid>
              <Button type="submit" disabled={isPending}>
                <Link2 className="h-4 w-4" aria-hidden />
                {t('create')}
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : (
        <p className="text-sm text-ink-600">{t('onlyOwners')}</p>
      )}

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('pending')}</CardTitle>
            <span className="text-xs text-ink-500">{open.length}</span>
          </CardHeader>
          <CardBody className="space-y-3">
            {open.length === 0 ? (
              <p className="text-sm text-ink-600">{t('none')}</p>
            ) : (
              <ul className="space-y-3">
                {open.map((invitation) => {
                  const link = linkFor(invitation.token);
                  const isFresh = invitation.token === fresh;
                  return (
                    <li
                      key={invitation.id}
                      className={`rounded-lg border p-3 ${isFresh ? 'border-jade-300 bg-jade-50' : 'border-ink-200 bg-white'}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-ink-900">
                          {invitation.invitee_name || t('unnamed')}
                          <span className="ms-2 font-normal text-ink-600">{t(`roles.${invitation.role}`)}</span>
                        </span>
                        <span className="text-xs text-ink-600">
                          {t('expires', { date: format.dateTime(new Date(invitation.expires_at), { dateStyle: 'short' }) })}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Input
                          aria-label={t('link')}
                          readOnly
                          value={link}
                          dir="ltr"
                          className="min-w-0 flex-1 text-xs"
                          onFocus={(event) => event.currentTarget.select()}
                        />
                        <Button type="button" size="sm" variant="secondary" onClick={() => copy(invitation.token)} disabled={!link}>
                          {isFresh ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                          {t('copy')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isPending && busy === invitation.id}
                          onClick={() => revoke(invitation.id)}
                          aria-label={t('revokeOf', { name: invitation.invitee_name || t('unnamed') })}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                          {t('revoke')}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
