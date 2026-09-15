/**
 * Comparing a secret without telling the caller how close they got.
 *
 * `a === b` on strings stops at the first byte that differs, so the time it
 * takes is the length of the matching prefix. Over enough tries that leaks the
 * secret one character at a time. The difference is small and the network noise
 * is large, which is the usual argument for not bothering — but the fix is four
 * lines and the argument has been wrong before.
 *
 * Length is deliberately compared first and in the open: the length of a secret
 * is not the secret, and comparing unequal lengths byte by byte would need a
 * fixed-size buffer to be honest about.
 */
export function secretEquals(
  given: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!given || !expected) return false;
  if (given.length !== expected.length) return false;

  let difference = 0;
  for (let i = 0; i < given.length; i++) {
    difference |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return difference === 0;
}
