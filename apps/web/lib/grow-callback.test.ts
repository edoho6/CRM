import { describe, expect, it } from 'vitest';
import {
  callbackSaysPaid,
  readGrowCallback,
  readTransactionInfo,
  sameAmount,
} from '@grow/callback';

describe('readGrowCallback', () => {
  it('reads the nested form keys Grow actually posts', () => {
    const callback = readGrowCallback({
      status: '1',
      'data[processId]': '12345',
      'data[processToken]': 'tok',
      'data[transactionId]': '999',
      'data[statusCode]': '2',
      'data[sum]': '240.00',
    });
    expect(callback).toEqual({
      processId: '12345',
      processToken: 'tok',
      transactionId: '999',
      transactionToken: null,
      statusCode: '2',
      sum: 240,
    });
    expect(callbackSaysPaid(callback)).toBe(true);
  });

  it('reads a nested JSON body the same way', () => {
    const callback = readGrowCallback({
      status: 1,
      data: { processId: 7, processToken: 't', statusCode: 2, sum: 10 },
    });
    expect(callback.processId).toBe('7');
    expect(callbackSaysPaid(callback)).toBe(true);
  });

  it('never treats a missing status code as paid — the old default did', () => {
    const callback = readGrowCallback({
      'data[processId]': '1',
      'data[processToken]': 't',
      status: '1',
    });
    expect(callbackSaysPaid(callback)).toBe(false);
  });

  it('does not take the request status for the payment status', () => {
    expect(callbackSaysPaid(readGrowCallback({ status: '2', 'data[statusCode]': '0' }))).toBe(
      false,
    );
  });

  it('refuses absurd values', () => {
    const callback = readGrowCallback({ 'data[processId]': 'x'.repeat(500), 'data[sum]': '-5' });
    expect(callback.processId).toBeNull();
    expect(callback.sum).toBeNull();
  });
});

describe('readTransactionInfo', () => {
  it('is paid only when the request worked and the transaction code is 2', () => {
    expect(readTransactionInfo({ status: 1, data: { statusCode: '2', sum: '240' } })).toEqual({
      paid: true,
      sum: 240,
    });
    expect(readTransactionInfo({ status: 1, data: [{ statusCode: 2, sum: 240 }] })).toEqual({
      paid: true,
      sum: 240,
    });
    expect(readTransactionInfo({ status: 1, data: { statusCode: '0', sum: '240' } })?.paid).toBe(
      false,
    );
  });

  it('gives nothing to settle on when the answer cannot be read', () => {
    expect(readTransactionInfo({ status: 0, err: { message: 'x' } })).toBeNull();
    expect(readTransactionInfo({ status: 1, data: {} })).toBeNull();
    expect(readTransactionInfo(null)).toBeNull();
    expect(readTransactionInfo('<html>')).toBeNull();
  });
});

describe('sameAmount', () => {
  it('compares to the agora, not as floats', () => {
    expect(sameAmount(0.1 + 0.2, 0.3)).toBe(true);
    expect(sameAmount(240, 239.99)).toBe(false);
    expect(sameAmount(null, 240)).toBe(false);
  });
});
