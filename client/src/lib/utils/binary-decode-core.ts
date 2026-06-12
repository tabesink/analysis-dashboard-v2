/**
 * Shared binary plot decode logic for main thread and Web Worker.
 * No DOM or worker-specific APIs beyond TextDecoder (available in workers).
 */

export interface BinaryCurveDataCore {
  eventId: string;
  plotKey: string;
  xArray: Float32Array;
  yArray: Float32Array;
}

const sharedTextDecoder = new TextDecoder();

export function readFloat32Array(
  view: DataView,
  buffer: ArrayBuffer,
  offset: number,
  length: number,
): { values: Float32Array; nextOffset: number } {
  const byteLength = length * 4;
  const nextOffset = offset + byteLength;

  if (offset % 4 === 0) {
    return {
      values: new Float32Array(buffer, offset, length),
      nextOffset,
    };
  }

  const values = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    values[i] = view.getFloat32(offset + i * 4, true);
  }
  return { values, nextOffset };
}

export function decodeBinaryPlotDataCore(buffer: ArrayBuffer): BinaryCurveDataCore[] {
  const view = new DataView(buffer);
  let offset = 0;
  const numCurves = view.getUint32(offset, true);
  offset += 4;

  const curves: BinaryCurveDataCore[] = [];
  for (let i = 0; i < numCurves; i++) {
    const eventIdLen = view.getUint16(offset, true);
    offset += 2;
    const eventId = sharedTextDecoder.decode(
      new Uint8Array(buffer, offset, eventIdLen),
    );
    offset += eventIdLen;

    const plotKeyLen = view.getUint16(offset, true);
    offset += 2;
    const plotKey = sharedTextDecoder.decode(
      new Uint8Array(buffer, offset, plotKeyLen),
    );
    offset += plotKeyLen;

    const numPoints = view.getUint32(offset, true);
    offset += 4;

    const xResult = readFloat32Array(view, buffer, offset, numPoints);
    offset = xResult.nextOffset;
    const yResult = readFloat32Array(view, buffer, offset, numPoints);
    offset = yResult.nextOffset;

    curves.push({
      eventId,
      plotKey,
      xArray: xResult.values,
      yArray: yResult.values,
    });
  }

  return curves;
}

export function groupCurvesByPlotKeyCore(
  curves: BinaryCurveDataCore[],
): Map<string, BinaryCurveDataCore[]> {
  const grouped = new Map<string, BinaryCurveDataCore[]>();
  for (const curve of curves) {
    const existing = grouped.get(curve.plotKey);
    if (existing) {
      existing.push(curve);
    } else {
      grouped.set(curve.plotKey, [curve]);
    }
  }
  return grouped;
}

export function curvesToGroupedRecord(
  curves: BinaryCurveDataCore[],
): Record<string, BinaryCurveDataCore[]> {
  const grouped = groupCurvesByPlotKeyCore(curves);
  const record: Record<string, BinaryCurveDataCore[]> = {};
  for (const [plotKey, plotCurves] of grouped.entries()) {
    record[plotKey] = plotCurves;
  }
  return record;
}
