import { getTranslations } from 'next-intl/server';
import { Card, CardBody, CardHeader, CardTitle, TableWrapper, Td, Tr } from '@clinic/ui';
import { ABILITY_KEYS, CLINIC_ROLES, abilitiesFor } from '@clinic/domain';

/**
 * What each role reaches, on the screen where roles are handed out.
 *
 * The owner chooses a role from a list of four words, and until now nothing on
 * the page said what any of them meant. The table is drawn from the same map
 * the application and the policies follow, so it cannot drift into describing a
 * system that no longer exists.
 *
 * A tick and a dash, not colour alone: the column is also the accessible name
 * of each cell, so a screen reader hears "secretary, treatment records, no".
 */
export async function RoleAbilitiesTable() {
  const t = await getTranslations('settings.team.abilities');
  const tRoles = await getTranslations('settings.team.roles');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="mb-4 text-sm text-ink-600">{t('intro')}</p>
        <TableWrapper>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th scope="col" className="px-3 py-2 text-start font-semibold">
                  {t('ability')}
                </th>
                {CLINIC_ROLES.map((role) => (
                  <th key={role} scope="col" className="px-3 py-2 text-center font-semibold">
                    {tRoles(role)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ABILITY_KEYS.map((key) => (
                <Tr key={key}>
                  <Td data-card-title>{t(key)}</Td>
                  {CLINIC_ROLES.map((role) => {
                    const allowed = abilitiesFor(role)[key];
                    return (
                      <Td key={role} className="text-center">
                        <span className="sr-only">
                          {tRoles(role)}: {allowed ? t('yes') : t('no')}
                        </span>
                        <span aria-hidden className={allowed ? 'text-jade-700' : 'text-ink-400'}>
                          {allowed ? '✓' : '—'}
                        </span>
                      </Td>
                    );
                  })}
                </Tr>
              ))}
            </tbody>
          </table>
        </TableWrapper>
        <p className="mt-4 text-xs text-ink-500">{t('note')}</p>
      </CardBody>
    </Card>
  );
}
