'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ChangelogContent } from '@/components/changelog/ChangelogContent';

type ChangelogResponse = {
  markdown: string | null;
  sourcePath?: string;
  error?: string;
};

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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading changelog...
      </div>
    );
  }

  if (!markdown) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Unable to load changelog content. Expected `Dashboard/CHANGELOG.md` in
        development or `/app/CHANGELOG.md` in the production container.
        {sourcePath ? ` Last attempted path: ${sourcePath}.` : ''}
      </div>
    );
  }

  return <ChangelogContent markdown={markdown} />;
}
