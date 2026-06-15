'use client';

import { Html } from '@react-three/drei';
import type { DamagePlotLayout } from '../lib/damage-plot-types';

type DamagePlotAxesProps = {
  layout: DamagePlotLayout;
};

const AXIS_COLOR = '#6b7280';
const DEFAULT_BAR_WIDTH = 0.8;
const AXIS_LABEL_CLASS =
  'pointer-events-none select-none whitespace-nowrap px-1.5 py-0.5 text-[10px] font-medium leading-none text-gray-500';

function StaticAxisLabel({
  children,
  position,
}: {
  children: string;
  position: [number, number, number];
}) {
  return (
    <Html position={position} center style={{ pointerEvents: 'none', color: AXIS_COLOR }}>
      <span className={AXIS_LABEL_CLASS}>{children}</span>
    </Html>
  );
}

export function DamagePlotAxes({ layout }: DamagePlotAxesProps) {
  const { bounds, cellSpacing, channelLabels, bars } = layout;
  const barWidth = bars[0]?.scale[0] ?? DEFAULT_BAR_WIDTH;
  const eventLabelX = -(barWidth * 2 + 0.55);

  return (
    <group>
      {channelLabels.map((label, index) => (
        <StaticAxisLabel key={label} position={[index * cellSpacing, 0.05, -0.8]}>
          {label}
        </StaticAxisLabel>
      ))}

      <StaticAxisLabel position={[bounds.width / 2, 0.15, -1.7]}>
        Channel
      </StaticAxisLabel>
      <StaticAxisLabel position={[eventLabelX - 0.35, 0.15, bounds.depth / 2]}>
        Event
      </StaticAxisLabel>
      <StaticAxisLabel position={[-1.2, bounds.height, -1.2]}>
        Damage
      </StaticAxisLabel>
    </group>
  );
}
