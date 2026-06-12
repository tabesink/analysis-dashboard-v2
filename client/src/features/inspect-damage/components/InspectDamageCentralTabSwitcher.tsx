'use client';

import { cn } from '@/lib/utils';

export type InspectDamageCentralTab = 'inspect' | 'table';

type InspectDamageCentralTabSwitcherProps = {
  activeTab: InspectDamageCentralTab;
  onTabChange: (tab: InspectDamageCentralTab) => void;
};

const TAB_LABELS: Record<InspectDamageCentralTab, string> = {
  inspect: 'Inspect Damage',
  table: 'Table View',
};

export function InspectDamageCentralTabSwitcher({
  activeTab,
  onTabChange,
}: InspectDamageCentralTabSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Inspect damage layout"
      className="inline-flex items-center rounded-md bg-muted/70 p-0.5"
    >
      {(Object.keys(TAB_LABELS) as InspectDamageCentralTab[]).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={activeTab === tab}
          onClick={() => onTabChange(tab)}
          className={cn(
            'text-sm font-medium rounded-sm px-2.5 py-0.5 transition-colors',
            activeTab === tab
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  );
}
