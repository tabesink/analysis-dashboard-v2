import { describe, expect, it } from 'vitest';
import type { Curve } from '@/components/charts/types';
import { calculateAxisLimits, calculateRawAxisLimits, createScale } from './scales';

function makeCurve(overrides: Partial<Curve>): Curve {
  return {
    eventId: 'E-1',
    points: [],
    ...overrides,
  };
}

describe('chart scales utilities', () => {
  it('returns null raw limits when no points exist', () => {
    expect(calculateRawAxisLimits([])).toBeNull();
  });

  it('scans limits from typed arrays and point arrays', () => {
    const curves: Curve[] = [
      makeCurve({
        xArray: new Float32Array([10, 20, 30]),
        yArray: new Float32Array([-5, 2, 8]),
      }),
      makeCurve({
        points: [
          { x: -2, y: 100 },
          { x: 5, y: -20 },
        ],
      }),
    ];

    expect(calculateRawAxisLimits(curves)).toEqual({
      xMin: -2,
      xMax: 30,
      yMin: -20,
      yMax: 100,
    });
  });

  it('rounds to nice limits and includes origin in visible domain', () => {
    const curves: Curve[] = [
      makeCurve({
        points: [
          { x: 12, y: -4 },
          { x: 28, y: 7 },
        ],
      }),
    ];

    expect(calculateAxisLimits(curves)).toEqual({
      xMin: 0,
      xMax: 30,
      yMin: -5,
      yMax: 10,
    });
  });

  it('uses default symmetric range when no data exists', () => {
    expect(calculateAxisLimits([])).toEqual({
      xMin: -1000,
      xMax: 1000,
      yMin: -1000,
      yMax: 1000,
    });
  });

  it('creates linear scale mappings', () => {
    const scale = createScale(0, 100, 50, 350);
    expect(scale(0)).toBe(50);
    expect(scale(50)).toBe(200);
    expect(scale(100)).toBe(350);
  });
});
