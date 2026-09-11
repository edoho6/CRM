// One error type for the whole job, carrying a short code and nothing else.
// The code is what shop_stores.last_error and shop_fetch_runs.error keep, so
// it must say what happened ("http_503", "robots_disallow", "timeout") in a
// word or two — never a page's content, never a URL with a query string.

export class JobError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'JobError';
    this.code = code;
  }
}

export function errorCode(error: unknown): string {
  if (error instanceof JobError) return error.code;
  if (error instanceof Error && error.name === 'TimeoutError') return 'timeout';
  if (error instanceof Error && /json/i.test(error.message)) return 'bad_json';
  return 'error';
}
