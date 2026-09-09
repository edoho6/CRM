/**
 * The key a prescription line is matched by, across visits and languages.
 *
 * The pinyin when the catalogue has it, otherwise whatever name was typed —
 * lower-cased and trimmed so "Huang Qi" and "huang qi " are one herb.
 *
 * A plain module on purpose. It is called on the server (the treatment page
 * shapes earlier visits with it) and in the browser (the dispensing panel
 * keys the live prescription with it); exported from a `'use client'` file
 * it reaches the server as a client reference and cannot be called there.
 */
export function prescriptionKey(pinyin: string | null | undefined, fallback: string): string {
  return (pinyin?.trim() || fallback).trim().toLowerCase();
}
