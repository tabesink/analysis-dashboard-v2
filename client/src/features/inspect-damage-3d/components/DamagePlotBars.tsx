'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { DamagePlotBar } from '../lib/damage-plot-types';

const BAR_EDGE_COLOR = '#000000';

type DamagePlotBarsProps = {
  bars: DamagePlotBar[];
};

export function DamagePlotBars({ bars }: DamagePlotBarsProps) {
  const edgesGeometry = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), []);

  return (
    <group>
      {bars.map((bar) => (
        <group
          key={`${bar.eventId}:${bar.channelKey}`}
          position={bar.position}
          scale={bar.scale}
        >
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color={bar.color} />
          </mesh>
          <lineSegments geometry={edgesGeometry}>
            <lineBasicMaterial color={BAR_EDGE_COLOR} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}
