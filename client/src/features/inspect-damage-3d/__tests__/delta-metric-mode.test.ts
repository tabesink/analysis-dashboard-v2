import { describe, expect, it } from 'vitest';
import {
  computeDeltaMetricDomain,
  computeDeltaMetricValue,
} from '../lib/delta-metric-mode';

describe('delta-metric-mode', () => {
  it('computes absolute metric as signed delta regardless of low-reference status', () => {
    expect(
      computeDeltaMetricValue(
        {
          referenceDamage: 0,
          targetDamage: 0,
          signedDelta: -4,
          lowReference: true,
        },
        'absolute',
      ),
    ).toBe(-4);
  });

  it('computes percent mode using 100 * (target - reference) / reference', () => {
    expect(
      computeDeltaMetricValue(
        {
          referenceDamage: 10,
          targetDamage: 30,
          signedDelta: 20,
          lowReference: false,
        },
        'percent',
      ),
    ).toBe(200);
  });

  it('computes ratio mode as target / reference', () => {
    expect(
      computeDeltaMetricValue(
        {
          referenceDamage: 10,
          targetDamage: 30,
          signedDelta: 20,
          lowReference: false,
        },
        'ratio',
      ),
    ).toBe(3);
  });

  it('suppresses percent/ratio values for low-reference rows', () => {
    const input = {
      referenceDamage: 0,
      targetDamage: 8,
      signedDelta: 8,
      lowReference: true,
    };
    expect(computeDeltaMetricValue(input, 'percent')).toBeNull();
    expect(computeDeltaMetricValue(input, 'ratio')).toBeNull();
  });

  it('returns symmetric domains for absolute and percent metrics', () => {
    expect(computeDeltaMetricDomain([-4, 20, null], 'absolute')).toEqual([-20, 20]);
    expect(computeDeltaMetricDomain([-50, 200, null], 'percent')).toEqual([-200, 200]);
  });

  it('returns a non-negative ratio domain with baseline headroom', () => {
    expect(computeDeltaMetricDomain([3, 0.8, null], 'ratio')).toEqual([0, 3]);
    expect(computeDeltaMetricDomain([null], 'ratio')).toEqual([0, 2]);
  });
});
