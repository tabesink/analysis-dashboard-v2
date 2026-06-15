import type { DamagePlotScaleMode } from './damage-plot-overlay-types';

export function applyDamageScale(value: number, mode: DamagePlotScaleMode): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  if (mode === 'log') {
    return Math.log10(1 + value);
  }

  return value;
}
