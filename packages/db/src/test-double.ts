/**
 * A Supabase client that lives in memory, for testing server actions.
 *
 * Why this exists: forty-six `'use server'` modules — every write the system
 * performs, including dispensing, invoicing and consent — had no unit test of
 * any kind, and the reason was mechanical rather than philosophical. An action
 * reaches the database through `scope.supabase`, a PostgREST query builder, and
 * there was nothing to hand it. The only way to exercise one was `pnpm smoke`,
 * which needs a populated clinic, a browser and a person to start it.
 *
 * What this is and is not:
 *
 *   · It is a store of rows with the query builder's shape on top, so an action
 *     can insert, read back what it inserted, and be asserted against. A test
 *     checks the rows that ended up in the table, not a script of canned
 *     replies — which means it catches a write that forgot `clinic_id`.
 *
 *   · It is **not** Postgres, and most importantly it does not enforce Row
 *     Level Security. Nothing here proves isolation between clinics; that is
 *     what `supabase/tests/tenant_isolation.sql` is for, against a real
 *     database. Tests written with this double answer "does this action do what
 *     it says", never "is this action safe".
 *
 *   · Filters are applied to the rows in memory, `select` returns whole rows
 *     rather than the named columns, and ordering is a plain comparison. Where
 *     the real thing would be cleverer, a test that depends on the difference is
 *     a test that belongs in SQL.
 */

type Row = Record<string, unknown>;

type Operation = 'select' | 'insert' | 'update' | 'upsert' | 'delete' | 'rpc' | 'auth';

interface Filter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is';
  value: unknown;
}

/** One thing an action asked the database to do, in the order it asked. */
export interface RecordedCall {
  operation: Operation;
  /** Table name, or the function name for an `rpc` call. */
  target: string;
  /** The rows handed to insert/update/upsert, or the arguments of an rpc. */
  payload?: unknown;
  filters: Filter[];
}

export interface FailureRule {
  /** Table or function name the failure applies to. */
  target: string;
  /** Leave out to fail every operation on that target. */
  operation?: Operation;
  /** What `error.message` should say; the code is `TEST`. */
  message?: string;
}

export interface SupabaseDoubleOptions {
  /** Starting rows, by table name. Everything not named here starts empty. */
  tables?: Record<string, Row[]>;
  /**
   * Handlers for `rpc(name, args)`. A handler returns the `data` the function
   * would return, or throws to make the call come back as an error.
   */
  rpc?: Record<string, (args: Record<string, unknown>) => unknown>;
  /**
   * Handlers for `auth.*`, for the sign-in paths. Each returns what the real
   * method resolves to — `{ data, error }` for the sign-ins, `{ error }` for
   * `signOut`. Anything not named here answers as a plain success.
   *
   * These are recorded in `calls` alongside the queries, which is the point:
   * the order of "sign in, ask the gate, claim the file, or sign out again" is
   * the thing worth asserting, and it is not visible in the rows.
   */
  auth?: Record<string, (args?: unknown) => unknown>;
  /** Operations that should come back as an error rather than succeeding. */
  failures?: FailureRule[];
}

export interface SupabaseDouble {
  /** Pass this where a `SupabaseClient` is expected. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the builder is shaped like the client, not typed as it
  client: any;
  /** The rows as they stand now, by table. */
  tables: Record<string, Row[]>;
  /** Every call an action made, in order. */
  calls: RecordedCall[];
  /** The rows of one table, or an empty array if it was never touched. */
  rows(table: string): Row[];
  /** The calls made against one table or function. */
  callsTo(target: string): RecordedCall[];
}

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((filter) => {
    const actual = row[filter.column];
    switch (filter.operator) {
      case 'eq':
        return actual === filter.value;
      case 'neq':
        return actual !== filter.value;
      case 'gt':
        return (actual as number) > (filter.value as number);
      case 'gte':
        return (actual as number) >= (filter.value as number);
      case 'lt':
        return (actual as number) < (filter.value as number);
      case 'lte':
        return (actual as number) <= (filter.value as number);
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(actual);
      case 'is':
        return actual === filter.value || (filter.value === null && actual == null);
      default:
        return true;
    }
  });
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

/**
 * Builds the double.
 *
 * ```ts
 * const db = createSupabaseDouble({ tables: { invoices: [{ id: 'inv-1', total: 100 }] } });
 * vi.mocked(getClinicScope).mockResolvedValue({ supabase: db.client, context });
 * await cancelInvoice('inv-1');
 * expect(db.rows('invoices')[0].status).toBe('cancelled');
 * ```
 */
export function createSupabaseDouble(options: SupabaseDoubleOptions = {}): SupabaseDouble {
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(options.tables ?? {})) {
    tables[name] = rows.map((row) => ({ ...row }));
  }

  const calls: RecordedCall[] = [];
  const failures = options.failures ?? [];
  let generated = 0;

  function failureFor(target: string, operation: Operation) {
    const rule = failures.find(
      (candidate) =>
        candidate.target === target &&
        (candidate.operation === undefined || candidate.operation === operation),
    );
    if (!rule) return null;
    return {
      code: 'TEST',
      message: rule.message ?? `${operation} on ${target} failed`,
      details: '',
      hint: '',
    };
  }

  function table(name: string): Row[] {
    tables[name] ??= [];
    return tables[name];
  }

  function withId(row: Row): Row {
    if (row.id !== undefined) return { ...row };
    generated += 1;
    return { ...row, id: `generated-${generated}` };
  }

  function builder(name: string) {
    let operation: Operation = 'select';
    const filters: Filter[] = [];
    let payload: unknown;
    let conflictColumn: string | null = null;
    let orderBy: { column: string; ascending: boolean }[] = [];
    let limit: number | null = null;
    let single: 'one' | 'maybe' | null = null;

    function addFilter(operator: Filter['operator'], column: string, value: unknown) {
      filters.push({ column, operator, value });
      return chain;
    }

    /**
     * Runs the query that has been described so far.
     *
     * Everything funnels through here — awaiting the builder, `.single()` and
     * `.maybeSingle()` all end up in the same place, because PostgREST lets a
     * caller stop at any point in the chain and that is exactly the freedom the
     * actions use.
     */
    function run(): { data: unknown; error: unknown } {
      calls.push({ operation, target: name, payload, filters: [...filters] });

      const error = failureFor(name, operation);
      if (error) return { data: null, error };

      const rows = table(name);
      let result: Row[];

      switch (operation) {
        case 'insert': {
          const incoming = (Array.isArray(payload) ? payload : [payload]) as Row[];
          result = incoming.map(withId);
          rows.push(...result);
          break;
        }
        case 'upsert': {
          const incoming = (Array.isArray(payload) ? payload : [payload]) as Row[];
          result = [];
          for (const candidate of incoming) {
            const key = conflictColumn ?? 'id';
            const existing = rows.find((row) => row[key] === candidate[key]);
            if (existing) {
              Object.assign(existing, candidate);
              result.push(existing);
            } else {
              const created = withId(candidate);
              rows.push(created);
              result.push(created);
            }
          }
          break;
        }
        case 'update': {
          result = rows.filter((row) => matches(row, filters));
          for (const row of result) Object.assign(row, payload as Row);
          break;
        }
        case 'delete': {
          result = rows.filter((row) => matches(row, filters));
          for (const row of result) rows.splice(rows.indexOf(row), 1);
          break;
        }
        default: {
          result = rows.filter((row) => matches(row, filters));
          for (const { column, ascending } of [...orderBy].reverse()) {
            result.sort((a, b) => (ascending ? 1 : -1) * compare(a[column], b[column]));
          }
          if (limit !== null) result = result.slice(0, limit);
        }
      }

      const copies = result.map((row) => ({ ...row }));

      if (single === 'one') {
        if (copies.length !== 1) {
          return {
            data: null,
            error: { code: 'PGRST116', message: 'expected exactly one row', details: '', hint: '' },
          };
        }
        return { data: copies[0], error: null };
      }
      if (single === 'maybe') return { data: copies[0] ?? null, error: null };
      return { data: copies, error: null };
    }

    const chain = {
      select: (_columns?: string, _options?: unknown) => chain,
      insert: (rows: Row | Row[]) => {
        operation = 'insert';
        payload = rows;
        return chain;
      },
      update: (row: Row) => {
        operation = 'update';
        payload = row;
        return chain;
      },
      upsert: (row: Row | Row[], options?: { onConflict?: string }) => {
        operation = 'upsert';
        payload = row;
        conflictColumn = options?.onConflict ?? null;
        return chain;
      },
      delete: () => {
        operation = 'delete';
        return chain;
      },
      eq: (column: string, value: unknown) => addFilter('eq', column, value),
      neq: (column: string, value: unknown) => addFilter('neq', column, value),
      gt: (column: string, value: unknown) => addFilter('gt', column, value),
      gte: (column: string, value: unknown) => addFilter('gte', column, value),
      lt: (column: string, value: unknown) => addFilter('lt', column, value),
      lte: (column: string, value: unknown) => addFilter('lte', column, value),
      in: (column: string, value: unknown[]) => addFilter('in', column, value),
      is: (column: string, value: unknown) => addFilter('is', column, value),
      order: (column: string, options?: { ascending?: boolean }) => {
        orderBy = [...orderBy, { column, ascending: options?.ascending !== false }];
        return chain;
      },
      limit: (count: number) => {
        limit = count;
        return chain;
      },
      range: (from: number, to: number) => {
        limit = to - from + 1;
        return chain;
      },
      returns: () => chain,
      maybeSingle: () => {
        single = 'maybe';
        return chain;
      },
      single: () => {
        single = 'one';
        return chain;
      },
      // Thenable rather than a promise: the chain has to stay chainable until
      // something awaits it, which is the whole shape of the real builder.
      then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => resolve(run()),
    };

    return chain;
  }

  // `auth.foo(args)` records the call and answers from the handler, so a test
  // can read the whole sign-in as one ordered list.
  const auth = new Proxy(
    {},
    {
      get(_target, property: string) {
        return async (args?: unknown) => {
          calls.push({ operation: 'auth', target: property, payload: args, filters: [] });
          const handler = options.auth?.[property];
          return handler ? handler(args) : { data: null, error: null };
        };
      },
    },
  );

  const client = {
    auth,
    from: (name: string) => builder(name),
    rpc: (name: string, args: Record<string, unknown> = {}) => ({
      then(resolve: (value: { data: unknown; error: unknown }) => unknown) {
        calls.push({ operation: 'rpc', target: name, payload: args, filters: [] });

        const error = failureFor(name, 'rpc');
        if (error) return resolve({ data: null, error });

        const handler = options.rpc?.[name];
        if (!handler) {
          return resolve({
            data: null,
            error: {
              code: '42883',
              message: `no handler for rpc ${name} in this test`,
              details: '',
              hint: '',
            },
          });
        }
        try {
          return resolve({ data: handler(args), error: null });
        } catch (thrown) {
          return resolve({
            data: null,
            error: { code: 'TEST', message: (thrown as Error).message, details: '', hint: '' },
          });
        }
      },
    }),
  };

  return {
    client,
    tables,
    calls,
    rows: (name: string) => tables[name] ?? [],
    callsTo: (target: string) => calls.filter((call) => call.target === target),
  };
}
