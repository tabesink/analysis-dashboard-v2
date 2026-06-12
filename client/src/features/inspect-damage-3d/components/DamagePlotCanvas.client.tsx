'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import type { DamagePlotLayout } from '../lib/damage-plot-types';
import { DamagePlotAxes } from './DamagePlotAxes';
import { DamagePlotBars } from './DamagePlotBars';

type DamagePlotCanvasProps = {
  layout: DamagePlotLayout;
};

export default function DamagePlotCanvas({ layout }: DamagePlotCanvasProps) {
  const { cameraPosition, lookAtTarget } = useMemo(() => {
    const labelMargin = 1.8;
    const spanX = layout.bounds.width + labelMargin;
    const spanZ = layout.bounds.depth + labelMargin;
    const spanY = layout.bounds.height + 0.5;
    const maxSpan = Math.max(spanX, spanZ, spanY);
    const distance = maxSpan * 1.35;
    const target: [number, number, number] = [
      (layout.bounds.width - layout.cellSpacing / 2) / 2,
      layout.bounds.height / 2,
      (layout.bounds.depth - layout.cellSpacing / 2) / 2,
    ];

    return {
      lookAtTarget: target,
      cameraPosition: [
        target[0] + distance * 0.85,
        target[1] + distance * 0.65,
        target[2] + distance * 0.85,
      ] as [number, number, number],
    };
  }, [layout]);

  return (
    <div className="h-full w-full">
      <Canvas
        shadows={false}
        gl={{ antialias: true, alpha: false }}
        camera={{ position: cameraPosition, fov: 45 }}
        className="h-full w-full"
        style={{ width: '100%', height: '100%', background: '#ffffff' }}
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            WebGL is not available.
          </div>
        }
      >
      <color attach="background" args={['#ffffff']} />
      <PerspectiveCamera makeDefault position={cameraPosition} fov={45} />
      <OrbitControls
        makeDefault
        target={lookAtTarget}
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableZoom
        enableRotate
      />
      <ambientLight intensity={1.2} />
      <directionalLight position={[20, 30, 20]} intensity={1.5} />
      <DamagePlotBars bars={layout.bars} />
      <Suspense fallback={null}>
        <DamagePlotAxes layout={layout} />
      </Suspense>
    </Canvas>
    </div>
  );
}
