'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { FileUp } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Select,
  Spinner,
  Table,
  TableWrapper,
  Td,
  Th,
} from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import { IMPORT_ROW_TONES } from '@clinic/domain';
import {
  IMPORT_FIELDS,
  IMPORT_MAX_ROWS,
  decodeCsvBytes,
  guessMapping,
  parseCsv,
  type ImportField,
} from './csv-import';
import { importPatients, type ImportOutcome } from './actions';

/**
 * Three steps on one page: the file, which column is which, and what the
 * import will do — then the import itself.
 *
 * Nothing is written until the last button. The check runs on the server
 * against the files the clinic has now, and names each row that is already on
 * file or repeats an earlier one, so the person sees before they press it that
 * the export from the old system will not become a second copy of every patient.
 */
export function ImportFlow() {
  const t = useTranslations('patients.import');
  const tf = useTranslations('patients.fields');
  const tc = useTranslations('common');
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<(ImportField | null)[]>([]);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [problem, setProblem] = useState<'empty' | 'too_many' | 'failed' | 'no_name_column' | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const headers = table?.[0] ?? [];
  const rows = useMemo(
    () => (table ?? []).slice(1).map((cells, index) => ({ cells, line: index + 2 })),
    [table],
  );

  async function readFile(file: File) {
    setOutcome(null);
    setDone(null);
    setProblem(null);
    const parsed = parseCsv(decodeCsvBytes(new Uint8Array(await file.arrayBuffer())));
    if (parsed.length < 2) {
      setProblem('empty');
      setTable(null);
      return;
    }
    if (parsed.length - 1 > IMPORT_MAX_ROWS) {
      setProblem('too_many');
      setTable(null);
      return;
    }
    setFileName(file.name);
    setTable(parsed);
    setMapping(guessMapping(parsed[0]!));
  }

  function setColumn(index: number, value: string) {
    setOutcome(null);
    setMapping((current) => {
      const next = [...current];
      const field = value === '' ? null : (value as ImportField);
      // A field fills from one column: choosing it here clears it elsewhere.
      if (field) for (let i = 0; i < next.length; i += 1) if (next[i] === field) next[i] = null;
      next[index] = field;
      return next;
    });
  }

  function run(dryRun: boolean) {
    if (!mapping.includes('first_name') && !mapping.includes('full_name')) {
      setProblem('no_name_column');
      return;
    }
    setProblem(null);
    startTransition(async () => {
      const result = await importPatients({ mapping, rows, dryRun });
      if (!result.ok) {
        setProblem('failed');
        return;
      }
      setOutcome(result.data);
      if (!dryRun) setDone(result.data.created);
    });
  }

  const counts = outcome
    ? {
        new: outcome.plan.filter((r) => r.status === 'new').length,
        onFile: outcome.plan.filter((r) => r.status === 'on_file').length,
        twice: outcome.plan.filter((r) => r.status === 'twice_in_file').length,
        noName: outcome.plan.filter((r) => r.status === 'no_name').length,
      }
    : null;

  if (done !== null) {
    return (
      <Card>
        <CardBody className="space-y-4">
          <Alert tone="success">{t('done', { count: done })}</Alert>
          <div className="flex justify-end">
            <Button asChild>
              <Link href="/patients">{t('toPatients')}</Link>
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{t('fileTitle')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-ink-600">{t('fileIntro', { max: IMPORT_MAX_ROWS })}</p>
          {problem === 'empty' ? <Alert tone="danger">{t('empty')}</Alert> : null}
          {problem === 'too_many' ? (
            <Alert tone="danger">{t('tooMany', { max: IMPORT_MAX_ROWS })}</Alert>
          ) : null}
          {/* The browser's own file button speaks the browser's language ("Choose File" on a
              Hebrew page), so the input is hidden and a label of ours opens it. The input
              stays in the tab order, and its focus draws the ring on the label beside it. */}
          <div className="space-y-1">
            <input
              id="import_file"
              type="file"
              accept=".csv,text/csv"
              className="peer sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
              }}
            />
            <label
              htmlFor="import_file"
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 text-sm font-medium text-ink-800 hover:bg-ink-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus"
            >
              <FileUp className="h-4 w-4" aria-hidden />
              {fileName ? t('chooseAnother') : t('choose')}
            </label>
            <p className="text-xs text-ink-500" dir="auto">
              {fileName ? t('rowsRead', { count: rows.length, name: fileName }) : t('fileHint')}
            </p>
          </div>
        </CardBody>
      </Card>

      {table ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('columnsTitle')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-ink-600">{t('columnsIntro')}</p>
            {problem === 'no_name_column' ? <Alert tone="danger">{t('noNameColumn')}</Alert> : null}
            <ul className="space-y-2">
              {headers.map((header, index) => (
                <li key={index} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2">
                  <label htmlFor={`column_${index}`} className="min-w-0 text-sm">
                    <span className="font-medium text-ink-900" dir="auto">
                      {header || t('unnamedColumn', { n: index + 1 })}
                    </span>
                    <span className="block truncate text-xs text-ink-500" dir="auto">
                      {rows[0]?.cells[index] ?? ''}
                    </span>
                  </label>
                  <Select
                    id={`column_${index}`}
                    value={mapping[index] ?? ''}
                    onChange={(event) => setColumn(index, event.target.value)}
                  >
                    <option value="">{t('skipColumn')}</option>
                    {IMPORT_FIELDS.map((field) => (
                      <option key={field} value={field}>
                        {tf(FIELD_LABEL[field])}
                      </option>
                    ))}
                  </Select>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => run(true)}
              >
                {isPending && !outcome ? <Spinner /> : null}
                {t('check')}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {problem === 'failed' ? <Alert tone="danger">{tc('errorGeneric')}</Alert> : null}

      {outcome && counts ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('planTitle')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <ul className="flex flex-wrap gap-2 text-sm">
              <li>
                <Badge tone={IMPORT_ROW_TONES.new}>
                  {t('status.new')}: {counts.new}
                </Badge>
              </li>
              <li>
                <Badge tone={IMPORT_ROW_TONES.on_file}>
                  {t('status.on_file')}: {counts.onFile}
                </Badge>
              </li>
              <li>
                <Badge tone={IMPORT_ROW_TONES.twice_in_file}>
                  {t('status.twice_in_file')}: {counts.twice}
                </Badge>
              </li>
              <li>
                <Badge tone={IMPORT_ROW_TONES.no_name}>
                  {t('status.no_name')}: {counts.noName}
                </Badge>
              </li>
            </ul>
            <TableWrapper responsive inset>
              <Table>
                <thead>
                  <tr>
                    <Th>{t('line')}</Th>
                    <Th>{t('name')}</Th>
                    <Th>{t('result')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {outcome.plan
                    .filter((row) => row.status !== 'new' || row.problems.length > 0)
                    .slice(0, 200)
                    .map((row) => (
                      <tr key={row.line}>
                        <Td className="tabular-nums">{row.line}</Td>
                        <Td data-card-title dir="auto">
                          {row.name || '—'}
                        </Td>
                        <Td>
                          {t(`status.${row.status}`)}
                          {row.matchName ? ` (${row.matchName})` : ''}
                          {row.problems
                            .filter((p) => p !== 'no_name')
                            .map((p) => ` · ${t(`problem.${p}`)}`)}
                        </Td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            </TableWrapper>
            <p className="text-xs text-ink-500">{t('planNote')}</p>
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={isPending || counts.new === 0}
                onClick={() => run(false)}
              >
                {isPending ? <Spinner /> : <FileUp className="h-4 w-4" aria-hidden />}
                {t('import', { count: counts.new })}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

const FIELD_LABEL: Record<ImportField, string> = {
  first_name: 'firstName',
  last_name: 'lastName',
  full_name: 'fullName',
  phone: 'phone',
  email: 'email',
  national_id: 'nationalId',
  date_of_birth: 'dateOfBirth',
  sex: 'sex',
  address: 'address',
  city: 'city',
  occupation: 'occupation',
  referral_source: 'referralSource',
  notes: 'notes',
};
