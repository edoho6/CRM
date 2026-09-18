import { describe, expect, it } from 'vitest';
import { callerAddress } from './caller-address';

const headers = (values: Record<string, string>) => new Headers(values);

describe('callerAddress', () => {
  it('prefers the platform header over anything the client wrote', () => {
    expect(
      callerAddress(
        headers({ 'x-vercel-forwarded-for': '203.0.113.7', 'x-forwarded-for': '1.1.1.1' }),
      ),
    ).toBe('203.0.113.7');
  });

  it('takes x-real-ip next', () => {
    expect(
      callerAddress(headers({ 'x-real-ip': '198.51.100.2', 'x-forwarded-for': '1.1.1.1' })),
    ).toBe('198.51.100.2');
  });

  it('takes the hop the nearest proxy added, not the one the client chose', () => {
    expect(callerAddress(headers({ 'x-forwarded-for': '6.6.6.6, 198.51.100.9' }))).toBe(
      '198.51.100.9',
    );
  });

  it('says unknown when nothing is there', () => {
    expect(callerAddress(headers({}))).toBe('unknown');
  });
});
