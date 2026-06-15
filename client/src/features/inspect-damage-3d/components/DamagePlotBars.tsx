'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { DamagePlotBar } from '../lib/damage-plot-types';

const BAR_EDGE_COLOR = '#111827';
const MUTED_BAR_EDGE_COLOR = '#6b7280';
const MUTED_BAR_OPACITY = 0.18;
const EDGE_SCALE = 1.003;

const BOX_EDGE_INDEXES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
] as const;

type DamagePlotBarsProps = {
  bars: DamagePlotBar[];
  selectedEventIds: ReadonlySet<string>;
};

type DamageBarInstancesProps = {
  bars: DamagePlotBar[];
  opacity: number;
  selected: boolean;
};

function DamageBarInstances({ bars, opacity, selected }: DamageBarInstancesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let index = 0; index < bars.length; index += 1) {
      const bar = bars[index];
      matrix.compose(
        new THREE.Vector3(...bar.position),
        new THREE.Quaternion(),
        new THREE.Vector3(...bar.scale),
      );
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, color.set(bar.color));
    }

    mesh.count = bars.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [bars]);

  if (bars.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, bars.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="#ffffff"
        emissive={selected ? '#ffffff' : '#000000'}
        emissiveIntensity={selected ? 0.08 : 0}
        roughness={0.55}
        metalness={0.05}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </instancedMesh>
  );
}

function buildEdgesGeometry(bars: readonly DamagePlotBar[]): THREE.BufferGeometry {
  const positions = new Float32Array(bars.length * BOX_EDGE_INDEXES.length * 2 * 3);
  let offset = 0;

  for (const bar of bars) {
    const [x, y, z] = bar.position;
    const [width, height, depth] = bar.scale;
    const halfWidth = (width * EDGE_SCALE) / 2;
    const halfHeight = (height * EDGE_SCALE) / 2;
    const halfDepth = (depth * EDGE_SCALE) / 2;
    const vertices: [number, number, number][] = [
      [x - halfWidth, y - halfHeight, z - halfDepth],
      [x + halfWidth, y - halfHeight, z - halfDepth],
      [x + halfWidth, y + halfHeight, z - halfDepth],
      [x - halfWidth, y + halfHeight, z - halfDepth],
      [x - halfWidth, y - halfHeight, z + halfDepth],
      [x + halfWidth, y - halfHeight, z + halfDepth],
      [x + halfWidth, y + halfHeight, z + halfDepth],
      [x - halfWidth, y + halfHeight, z + halfDepth],
    ];

    for (const [startIndex, endIndex] of BOX_EDGE_INDEXES) {
      const start = vertices[startIndex];
      const end = vertices[endIndex];
      positions[offset++] = start[0];
      positions[offset++] = start[1];
      positions[offset++] = start[2];
      positions[offset++] = end[0];
      positions[offset++] = end[1];
      positions[offset++] = end[2];
    }
  }

  return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3));
}

function DamageBarEdges({
  bars,
  color,
  opacity,
}: {
  bars: DamagePlotBar[];
  color: string;
  opacity: number;
}) {
  const geometry = useMemo(() => buildEdgesGeometry(bars), [bars]);

  if (bars.length === 0) return null;

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </lineSegments>
  );
}

export function DamagePlotBars({ bars, selectedEventIds }: DamagePlotBarsProps) {
  const hasSelection = selectedEventIds.size > 0;
  const { activeBars, mutedBars } = useMemo(() => {
    if (!hasSelection) {
      return { activeBars: bars, mutedBars: [] };
    }

    const active: DamagePlotBar[] = [];
    const muted: DamagePlotBar[] = [];
    for (const bar of bars) {
      if (selectedEventIds.has(bar.eventId)) {
        active.push(bar);
      } else {
        muted.push(bar);
      }
    }
    return { activeBars: active, mutedBars: muted };
  }, [bars, hasSelection, selectedEventIds]);

  return (
    <group>
      <DamageBarInstances bars={activeBars} opacity={1} selected={hasSelection} />
      <DamageBarInstances bars={mutedBars} opacity={MUTED_BAR_OPACITY} selected={false} />
      <DamageBarEdges bars={activeBars} color={BAR_EDGE_COLOR} opacity={1} />
      <DamageBarEdges bars={mutedBars} color={MUTED_BAR_EDGE_COLOR} opacity={0.35} />
    </group>
  );
}
