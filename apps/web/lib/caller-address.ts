/**
 * The caller's address, for rate limits on pages nobody signs in to.
 *
 * The first entry of `x-forwarded-for` is whatever the client wrote there
 * unless a proxy in front replaced it, so it is the last thing asked, not the
 * first. The platform's own headers come first: Vercel sets
 * `x-vercel-forwarded-for` and `x-real-ip` itself and does not pass through a
 * client's copy. Behind any other proxy, the nearest hop — the *last* entry of
 * `x-forwarded-for` — is the one a proxy added, and the only one a client
 * cannot choose.
 *
 * A limit keyed on this is one layer of several: the database limits the same
 * pages per phone number and per clinic, because a function open to anonymous
 * callers cannot trust an address handed to it.
 */
export function callerAddress(headers: Pick<Headers, 'get'>): string {
  const first = (value: string | null) => value?.split(',')[0]?.trim() || null;
  const last = (value: string | null) => {
    const parts =
      value
        ?.split(',')
        .map((part) => part.trim())
        .filter(Boolean) ?? [];
    return parts.length > 0 ? parts[parts.length - 1]! : null;
  };
  return (
    first(headers.get('x-vercel-forwarded-for')) ??
    first(headers.get('x-real-ip')) ??
    last(headers.get('x-forwarded-for')) ??
    'unknown'
  );
}
