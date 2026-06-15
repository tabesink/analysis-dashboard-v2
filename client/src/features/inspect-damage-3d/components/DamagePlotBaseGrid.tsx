'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { DamagePlotLayout } from '../lib/damage-plot-types';

const BASE_PLANE_COLOR = '#ffffff';
const GRID_LINE_COLOR = '#e5e7eb';
const DEFAULT_BAR_WIDTH = 0.8;

type DamagePlotBaseGridProps = {
  layout: DamagePlotLayout;
};

function buildAxisSpan(count: number, spacing: number): number {
  if (count <= 1) return spacing;
  return (count - 1) * spacing;
}

export function DamagePlotBaseGrid({ layout }: DamagePlotBaseGridProps) {
  const { bounds, cellSpacing, channelLabels, eventLabels, bars } = layout;
  const channelCount = channelLabels.length;
  const eventCount = eventLabels.length;
  const barWidth = bars[0]?.scale[0] ?? DEFAULT_BAR_WIDTH;
  const lineExtension = barWidth * 2;
  const planeCenterX = bounds.width / 2 - cellSpacing / 2;
  const planeCenterZ = bounds.depth / 2 - cellSpacing / 2;

  const lineGeometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const xSpan = buildAxisSpan(channelCount, cellSpacing);
    const zSpan = buildAxisSpan(eventCount, cellSpacing);
    const y = 0.001;
    const xStart = -lineExtension;
    const xEnd = xSpan + lineExtension;
    const zStart = -lineExtension;
    const zEnd = zSpan + lineExtension;

    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const x = channelIndex * cellSpacing;
      points.push(new THREE.Vector3(x, y, zStart), new THREE.Vector3(x, y, zEnd));
    }

    for (let eventIndex = 0; eventIndex < eventCount; eventIndex += 1) {
      const z = eventIndex * cellSpacing;
      points.push(new THREE.Vector3(xStart, y, z), new THREE.Vector3(xEnd, y, z));
    }

    return new THREE.BufferGeometry().setFromPoints(points);
  }, [cellSpacing, channelCount, eventCount, lineExtension]);

  return (
    <group>
      <mesh position={[planeCenterX, 0, planeCenterZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[bounds.width, bounds.depth]} />
        <meshBasicMaterial color={BASE_PLANE_COLOR} />
      </mesh>
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color={GRID_LINE_COLOR} />
      </lineSegments>
    </group>
  );
}
