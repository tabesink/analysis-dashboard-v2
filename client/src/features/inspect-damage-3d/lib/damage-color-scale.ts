/** Discrete FEA-style jet bands (low → high), aligned to stress contour legends. */
export const DAMAGE_COLOR_BANDS = [
  [0, 0, 139],
  [0, 102, 204],
  [0, 204, 204],
  [0, 204, 0],
  [153, 204, 0],
  [255, 204, 0],
  [255, 102, 0],
  [255, 0, 0],
] as const;

export type RgbTriplet = readonly [number, number, number];

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function normalizeValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return 0;
  if (max <= min) return 0;
  return clamp01((value - min) / (max - min));
}

export function rgbTripletToString([r, g, b]: RgbTriplet): string {
  return `rgb(${r}, ${g}, ${b})`;
}

export function getDamageColorBandIndex(value: number, min: number, max: number): number {
  const t = normalizeValue(value, min, max);
  return Math.min(
    DAMAGE_COLOR_BANDS.length - 1,
    Math.floor(t * DAMAGE_COLOR_BANDS.length),
  );
}

export function getDamageColor(value: number, min: number, max: number): string {
  const index = getDamageColorBandIndex(value, min, max);
  return rgbTripletToString(DAMAGE_COLOR_BANDS[index]!);
}

function getDamageColorBandColors(): string[] {
  return DAMAGE_COLOR_BANDS.map(rgbTripletToString);
}
