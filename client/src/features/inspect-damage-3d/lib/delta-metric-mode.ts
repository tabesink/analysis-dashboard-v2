export type DeltaMetricMode = 'absolute' | 'percent' | 'ratio';

type DeltaMetricInput = {
  referenceDamage: number;
  targetDamage: number;
  signedDelta: number;
  lowReference: boolean;
};

export function computeDeltaMetricValue(
  input: DeltaMetricInput,
  metricMode: DeltaMetricMode,
): number | null {
  if (metricMode === 'absolute') return input.signedDelta;
  if (input.lowReference) return null;
  if (metricMode === 'percent') {
    return (100 * (input.targetDamage - input.referenceDamage)) / input.referenceDamage;
  }
  return input.targetDamage / input.referenceDamage;
}

export function computeDeltaMetricDomain(
  metricValues: Array<number | null>,
  metricMode: DeltaMetricMode,
): [number, number] {
  const renderableValues = metricValues.filter((value): value is number => value !== null);
  if (metricMode === 'ratio') {
    const maxRatio = renderableValues.length > 0 ? Math.max(1, ...renderableValues) : 1;
    return [0, Math.max(2, maxRatio)];
  }
  const maxAbs = renderableValues.length > 0 ? Math.max(0, ...renderableValues.map((value) => Math.abs(value))) : 1;
  return [-maxAbs, maxAbs];
}

export function getDeltaMetricLabel(metricMode: DeltaMetricMode): string {
  if (metricMode === 'percent') return 'Percent delta';
  if (metricMode === 'ratio') return 'Ratio';
  return 'Signed delta';
}
