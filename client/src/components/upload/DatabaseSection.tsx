'use client';

import { Loader2, Download, ChevronRight, Database, Plug } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

function DatabaseRowDivider() {
  return <div className="mx-3 mt-1 h-px bg-border" aria-hidden="true" />;
}

function DatabaseActionRow({
  children,
  showDivider = true,
}: {
  children: ReactNode;
  showDivider?: boolean;
}) {
  return (
    <div>
      {children}
      {showDivider ? <DatabaseRowDivider /> : null}
    </div>
  );
}

export interface DatabaseSectionProps {
  isAdmin: boolean;
  isCreatingDatabase: boolean;
  isConnectingDatabase: boolean;
  isExporting: boolean;
  /** Shown under Export when a background export task is running */
  exportProgress?: string;
  onCreateDatabase: () => void;
  onConnectDatabase: () => void;
  onExportDatabase: () => void;
}

export function DatabaseSection({
  isAdmin,
  isCreatingDatabase,
  isConnectingDatabase,
  isExporting,
  exportProgress,
  onCreateDatabase,
  onConnectDatabase,
  onExportDatabase,
}: DatabaseSectionProps) {
  return (
    <div>
        {isAdmin ? (
          <DatabaseActionRow>
            <Button
              variant="ghost"
              onClick={onCreateDatabase}
              disabled={isCreatingDatabase}
              className="w-full group flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-all disabled:opacity-50 h-auto justify-start"
            >
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                {isCreatingDatabase ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <Database className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <span className="text-sm font-medium block">Create Managed Database</span>
                <span className="text-xs text-muted-foreground block truncate">
                  Creates dashboard-&lt;name&gt;-&lt;timestamp&gt;.db without switching
                </span>
              </div>
              <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
            </Button>
          </DatabaseActionRow>
        ) : null}

        <DatabaseActionRow>
          <Button
            variant="ghost"
            onClick={onConnectDatabase}
            disabled={isConnectingDatabase}
            className="w-full group flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-all disabled:opacity-50 h-auto justify-start"
          >
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              {isConnectingDatabase ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <Plug className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <span className="text-sm font-medium block">Switch Active Database</span>
              <span className="text-xs text-muted-foreground block truncate">
                Select and load an existing dashboard*.db
              </span>
            </div>
            <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
          </Button>
        </DatabaseActionRow>

        {isAdmin ? (
          <DatabaseActionRow>
            <Button
              variant="ghost"
              onClick={onExportDatabase}
              disabled={isExporting}
              className="w-full group flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-all disabled:opacity-50 h-auto justify-start"
            >
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                {isExporting ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <Download className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <span className="text-sm font-medium block">Export Active Database</span>
                <span className="text-xs text-muted-foreground block truncate">
                  {exportProgress || 'Events, measurements, and artifacts (.zip)'}
                </span>
              </div>
              <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
            </Button>
          </DatabaseActionRow>
        ) : null}
    </div>
  );
}
