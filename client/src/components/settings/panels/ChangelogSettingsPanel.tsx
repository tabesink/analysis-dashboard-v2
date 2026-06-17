'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ChangelogContent } from '@/components/changelog/ChangelogContent';
import { DialogContentCard } from '@/components/shared/dialog-layout';

type ChangelogResponse = {
  markdown: string | null;
  sourcePath?: string;
  error?: string;
};

const changelogPanelCardClassName = 'min-h-0 flex-1 border-0 bg-transparent shadow-none';

export function ChangelogSettingsPanel() {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [sourcePath, setSourcePath] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void fetch('/api/changelog')
      .then(async (response) => {
        const data = (await response.json()) as ChangelogResponse;
        if (cancelled) {
          return;
        }
        setMarkdown(data.markdown);
        setSourcePath(data.sourcePath);
      })
      .catch(() => {
        if (!cancelled) {
          setMarkdown(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <DialogContentCard
        className={changelogPanelCardClassName}
        bodyClassName="flex min-h-0 flex-1 flex-col p-0"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading changelog...
        </div>
      </DialogContentCard>
    );
  }

  if (!markdown) {
    return (
      <DialogContentCard className={changelogPanelCardClassName} bodyClassName="p-0">
        <div className="text-sm text-muted-foreground">
          Unable to load changelog content. Expected `Dashboard/CHANGELOG.md` in
          development or `/app/CHANGELOG.md` in the production container.
          {sourcePath ? ` Last attempted path: ${sourcePath}.` : ''}
        </div>
      </DialogContentCard>
    );
  }

  return (
    <DialogContentCard
      className={changelogPanelCardClassName}
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-y-auto p-0"
    >
      <ChangelogContent markdown={markdown} />
    </DialogContentCard>
  );
}
