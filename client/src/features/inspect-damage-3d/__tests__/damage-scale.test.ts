import { describe, expect, it } from 'vitest';
import { applyDamageScale } from '../lib/damage-scale';

describe('applyDamageScale', () => {
  it('returns the input value for linear mode', () => {
    expect(applyDamageScale(12.5, 'linear')).toBe(12.5);
    expect(applyDamageScale(0, 'linear')).toBe(0);
  });

  it('applies log10(1 + value) for log mode', () => {
    expect(applyDamageScale(0, 'log')).toBe(0);
    expect(applyDamageScale(9, 'log')).toBe(1);
    expect(applyDamageScale(99, 'log')).toBe(2);
  });

  it('clamps negative and non-finite input values to zero', () => {
    expect(applyDamageScale(-5, 'linear')).toBe(0);
    expect(applyDamageScale(Number.NaN, 'linear')).toBe(0);
    expect(applyDamageScale(Number.POSITIVE_INFINITY, 'log')).toBe(0);
  });
});
