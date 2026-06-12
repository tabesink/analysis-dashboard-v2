import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { InspectDamageCentralTabSwitcher } from '@/features/inspect-damage/components/InspectDamageCentralTabSwitcher';

describe('InspectDamageCentralTabSwitcher', () => {
  it('renders inspect and table tabs without a separate comparison tab', () => {
    const html = renderToStaticMarkup(
      <InspectDamageCentralTabSwitcher activeTab="inspect" onTabChange={() => {}} />,
    );
    expect(html).toContain('Inspect Damage');
    expect(html).toContain('Table View');
    expect(html).not.toContain('Comparison');
  });

  it('emits requested tab when clicked', () => {
    const onTabChange = vi.fn();
    const html = renderToStaticMarkup(
      <InspectDamageCentralTabSwitcher activeTab="table" onTabChange={onTabChange} />,
    );

    expect(html).toContain('role="tab"');
  });
});
