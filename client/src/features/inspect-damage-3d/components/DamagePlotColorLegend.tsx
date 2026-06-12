'use client';

import { DAMAGE_COLOR_BANDS, rgbTripletToString } from '../lib/damage-color-scale';

type DamagePlotColorLegendProps = {
  minDamage: number;
  maxDamage: number;
  scaleLabel?: string;
};

export function DamagePlotColorLegend({
  minDamage,
  maxDamage,
  scaleLabel = 'Damage',
}: DamagePlotColorLegendProps) {
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex w-5 shrink-0 flex-col-reverse overflow-hidden border border-black">
        {DAMAGE_COLOR_BANDS.map((band, index) => (
          <div
            key={index}
            className="min-h-3 flex-1 border-b border-black last:border-b-0"
            style={{ backgroundColor: rgbTripletToString(band) }}
          />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5 text-[10px] leading-none text-muted-foreground">
        <span>{maxDamage.toExponential(2)}</span>
        <span className="text-[11px] font-medium text-foreground">{scaleLabel}</span>
        <span>{minDamage.toExponential(2)}</span>
      </div>
    </div>
  );
}
