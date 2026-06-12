/**
 * Binary decoder for plot data.
 *
 * Decodes Float32Array binary format from /api/v1/dashboard/plots/data/binary
 * ~8x smaller payload and ~10x faster parsing than JSON.
 *
 * Binary format:
 * - Header: num_curves (uint32)
 * - Per curve:
 *   - event_id_len (uint16), event_id (bytes)
 *   - plot_key_len (uint16), plot_key (bytes)
 *   - num_points (uint32)
 *   - x_values (float32[num_points])
 *   - y_values (float32[num_points])
 */

import type { Point } from '@/components/charts/types';
import {
  decodeBinaryPlotDataCore,
  groupCurvesByPlotKeyCore,
  type BinaryCurveDataCore,
} from './binary-decode-core';

export type BinaryCurveData = BinaryCurveDataCore;

const curvePointsCache = new WeakMap<BinaryCurveData, Point[]>();

/**
 * Decode binary plot data from ArrayBuffer.
 *
 * @param buffer - Raw binary data from server
 * @returns Array of curve data with both Point[] and raw Float32Arrays
 */
export function decodeBinaryPlotData(buffer: ArrayBuffer): BinaryCurveData[] {
  return decodeBinaryPlotDataCore(buffer);
}

/**
 * Group decoded curves by plot key.
 *
 * @param curves - Decoded curve data
 * @returns Map of plotKey -> curves for that plot
 */
export function groupCurvesByPlotKey(
  curves: BinaryCurveData[],
): Map<string, BinaryCurveData[]> {
  return groupCurvesByPlotKeyCore(curves);
}

/**
 * Lazily materialize Point[] for consumers that require object points.
 */
export function getCurvePoints(curve: BinaryCurveData): Point[] {
  const cached = curvePointsCache.get(curve);
  if (cached) return cached;

  const len = Math.min(curve.xArray.length, curve.yArray.length);
  const points = new Array<Point>(len);
  for (let i = 0; i < len; i++) {
    points[i] = { x: curve.xArray[i], y: curve.yArray[i] };
  }
  curvePointsCache.set(curve, points);
  return points;
}
