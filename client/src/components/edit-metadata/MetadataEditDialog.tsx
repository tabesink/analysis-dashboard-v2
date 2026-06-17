"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CalendarClock, FileAxis3D, FilePenLine, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChannelReprocessBanner } from "@/components/edit-metadata/ChannelReprocessBanner";
import { DamageCalculationBanner } from "@/components/edit-metadata/DamageCalculationBanner";
import { AssignChannelsPanel } from "@/components/edit-metadata/AssignChannelsPanel";
import { DurabilitySchedulePanel } from "@/components/edit-metadata/DurabilitySchedulePanel";
import { EditMetadataPanel } from "@/components/edit-metadata/EditMetadataPanel";
import { DialogPageHeader } from "@/components/shared/dialog-layout";
import {
  isMetadataDialogDirty,
  resolveMetadataDialogCloseRequest,
} from "@/features/edit-metadata/lib/metadata-dialog-close";
import {
  buildMetadataDiscardPromptCopy,
  type MetadataDiscardPromptReason,
} from "@/features/edit-metadata/lib/metadata-discard-prompt";
import {
  isMetadataDialogSectionActive,
  metadataDialogSectionLabel,
  metadataDialogSectionNavClassName,
  type MetadataDialogSection,
} from "@/features/edit-metadata/lib/metadata-dialog-sections";
import {
  reopenChannelReprocessModal,
  useChannelReprocessStore,
} from "@/stores/channel-reprocess-store";
import {
  reopenDamageCalculationModal,
  useDamageCalculationStore,
} from "@/stores/damage-calculation-store";
import { selectCanWrite, useAuthStore } from "@/stores/auth-store";
import {
  applyPendingMetadataEditDialogScope,
  clearPendingMetadataEditDialogScope,
  clearPendingMetadataEditDialogSection,
  closeMetadataEditDialog,
  useMetadataEditDialogStore,
} from "@/stores/metadata-edit-dialog-store";

export function MetadataEditDialog() {
  const isOpen = useMetadataEditDialogStore((state) => state.isOpen);
  const programId = useMetadataEditDialogStore((state) => state.programId);
  const version = useMetadataEditDialogStore((state) => state.version);
  const pendingScope = useMetadataEditDialogStore((state) => state.pendingScope);
  const pendingSection = useMetadataEditDialogStore((state) => state.pendingSection);
  const canWrite = useAuthStore(selectCanWrite);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [activeSection, setActiveSection] = useState<MetadataDialogSection>("edit-metadata");
  const [isMetadataDirty, setIsMetadataDirty] = useState(false);
  const [isChannelMapDirty, setIsChannelMapDirty] = useState(false);
  const [isScheduleDirty, setIsScheduleDirty] = useState(false);
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);
  const [discardPromptReason, setDiscardPromptReason] =
    useState<MetadataDiscardPromptReason>("close");
  const [statusDraftValue, setStatusDraftValue] = useState<string | null>(null);

  const isDirty = isMetadataDialogDirty(isMetadataDirty, isChannelMapDirty, isScheduleDirty);

  useEffect(() => {
    if (!isOpen) {
      setActiveSection("edit-metadata");
      setIsMetadataDirty(false);
      setIsChannelMapDirty(false);
      setIsScheduleDirty(false);
      setDiscardPromptOpen(false);
      setStatusDraftValue(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!pendingSection) {
      return;
    }
    setActiveSection(pendingSection);
    clearPendingMetadataEditDialogSection();
  }, [pendingSection]);

  useEffect(() => {
    if (!pendingScope || isDirty) {
      return;
    }
    applyPendingMetadataEditDialogScope();
  }, [pendingScope, isDirty]);

  useEffect(() => {
    if (!pendingScope || !isDirty) {
      return;
    }
    setDiscardPromptReason("scope-change");
    setDiscardPromptOpen(true);
  }, [pendingScope, isDirty]);

  const finalizeClose = useCallback(() => {
    setDiscardPromptOpen(false);
    clearPendingMetadataEditDialogScope();
    closeMetadataEditDialog();
  }, []);

  const requestClose = useCallback(() => {
    const decision = resolveMetadataDialogCloseRequest({
      isDirty,
      confirmedDiscard: false,
    });
    if (decision === "close") {
      finalizeClose();
      return;
    }
    setDiscardPromptReason("close");
    setDiscardPromptOpen(true);
  }, [finalizeClose, isDirty]);

  const handleDiscardConfirmed = useCallback(() => {
    if (discardPromptReason === "scope-change") {
      setDiscardPromptOpen(false);
      setIsMetadataDirty(false);
      setIsChannelMapDirty(false);
      setIsScheduleDirty(false);
      applyPendingMetadataEditDialogScope();
      return;
    }
    finalizeClose();
  }, [discardPromptReason, finalizeClose]);

  const handleDiscardCancelled = useCallback(() => {
    setDiscardPromptOpen(false);
    if (discardPromptReason === "scope-change") {
      clearPendingMetadataEditDialogScope();
    }
  }, [discardPromptReason]);

  const channelReprocessState = useChannelReprocessStore(
    (state) =>
      programId && version ? state.scopes[`${programId}::${version}`] ?? null : null,
  );
  const damageCalculationState = useDamageCalculationStore(
    (state) =>
      programId && version ? state.scopes[`${programId}::${version}`] ?? null : null,
  );

  if (!isOpen || !programId || !version) {
    return null;
  }

  const scope = { programId, version };
  const showChannelReprocessBanner =
    channelReprocessState?.status === "running" && !channelReprocessState.modalOpen;
  const showDamageCalculationBanner =
    damageCalculationState?.status === "running" && !damageCalculationState.modalOpen;
  const { title: discardTitle, description: discardDescription } =
    buildMetadataDiscardPromptCopy({
      reason: discardPromptReason,
      programId,
      version,
      pendingScope: pendingScope ?? undefined,
    });
  const scopeAlert =
    showChannelReprocessBanner || showDamageCalculationBanner ? (
      <>
        {showChannelReprocessBanner && channelReprocessState ? (
          <ChannelReprocessBanner
            progressMessage={channelReprocessState.progressMessage}
            onReopen={() => reopenChannelReprocessModal(scope)}
          />
        ) : null}
        {showDamageCalculationBanner && damageCalculationState ? (
          <DamageCalculationBanner
            progressMessage={damageCalculationState.progressMessage}
            onReopen={() => reopenDamageCalculationModal(scope)}
          />
        ) : null}
      </>
    ) : undefined;

  return (
    <>
      <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && requestClose()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-white/70 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 dark:bg-black/45" />
          <DialogPrimitive.Content
            data-testid="metadata-edit-dialog"
            className="fixed left-1/2 top-1/2 z-50 h-[min(720px,calc(100vh-96px))] w-[min(1470px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-background p-0 shadow-subtle outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            onEscapeKeyDown={(event) => {
              event.preventDefault();
              requestClose();
            }}
            onPointerDownOutside={(event) => {
              event.preventDefault();
              requestClose();
            }}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              closeButtonRef.current?.focus();
            }}
          >
            <DialogPrimitive.Title className="sr-only">
              Event Details for {programId} {version}
            </DialogPrimitive.Title>
            <div className="grid h-full min-h-0 grid-cols-[180px_1fr]">
              <aside className="border-r border-border bg-background px-3 py-4">
                <div className="mb-4 flex items-center gap-2 px-1">
                  <Button
                    ref={closeButtonRef}
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close metadata editor"
                    onClick={requestClose}
                    className="rounded-full text-foreground hover:bg-secondary"
                  >
                    <X className="size-4" />
                  </Button>
                  <p className="sr-only">Program version editor</p>
                </div>
                <nav className="space-y-1" aria-label="Metadata editor sections">
                  <button
                    type="button"
                    data-testid="metadata-dialog-nav-edit-metadata"
                    aria-label="Edit Metadata section"
                    aria-current={
                      isMetadataDialogSectionActive(activeSection, "edit-metadata")
                        ? "page"
                        : undefined
                    }
                    className={metadataDialogSectionNavClassName(
                      isMetadataDialogSectionActive(activeSection, "edit-metadata"),
                    )}
                    onClick={() => setActiveSection("edit-metadata")}
                  >
                    <FilePenLine className="size-4 shrink-0" />
                    <span className="truncate">Edit Metadata</span>
                  </button>
                  <button
                    type="button"
                    data-testid="metadata-dialog-nav-assign-channels"
                    aria-label="Assign Channels section"
                    aria-current={
                      isMetadataDialogSectionActive(activeSection, "assign-channels")
                        ? "page"
                        : undefined
                    }
                    className={metadataDialogSectionNavClassName(
                      isMetadataDialogSectionActive(activeSection, "assign-channels"),
                    )}
                    onClick={() => setActiveSection("assign-channels")}
                  >
                    <FileAxis3D className="size-4 shrink-0" />
                    <span className="truncate">Assign Channels</span>
                  </button>
                  <button
                    type="button"
                    data-testid="metadata-dialog-nav-durability-schedule"
                    aria-label="Assign Schedule section"
                    aria-current={
                      isMetadataDialogSectionActive(activeSection, "durability-schedule")
                        ? "page"
                        : undefined
                    }
                    className={metadataDialogSectionNavClassName(
                      isMetadataDialogSectionActive(activeSection, "durability-schedule"),
                    )}
                    onClick={() => setActiveSection("durability-schedule")}
                  >
                    <CalendarClock className="size-4 shrink-0" />
                    <span className="truncate">Assign Schedule</span>
                  </button>
                </nav>
              </aside>

              <section className="flex min-h-0 flex-col overflow-hidden px-6 py-4">
                <DialogPageHeader title={metadataDialogSectionLabel(activeSection)} />
                <div
                  data-testid="metadata-dialog-section-edit-metadata"
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                  hidden={!isMetadataDialogSectionActive(activeSection, "edit-metadata")}
                >
                  <EditMetadataPanel
                    scope={scope}
                    canWrite={canWrite}
                    scopeAlert={scopeAlert}
                    statusDraftValue={statusDraftValue}
                    onDirtyChange={setIsMetadataDirty}
                    onStatusDraftChange={setStatusDraftValue}
                  />
                </div>
                <div
                  data-testid="metadata-dialog-section-assign-channels"
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                  hidden={!isMetadataDialogSectionActive(activeSection, "assign-channels")}
                >
                  <AssignChannelsPanel
                    scope={scope}
                    canWrite={canWrite}
                    scopeAlert={scopeAlert}
                    onDirtyChange={setIsChannelMapDirty}
                  />
                </div>
                <div
                  data-testid="metadata-dialog-section-durability-schedule"
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                  hidden={!isMetadataDialogSectionActive(activeSection, "durability-schedule")}
                >
                  <DurabilitySchedulePanel
                    scope={scope}
                    canWrite={canWrite}
                    showUploadAffordance
                    scopeAlert={scopeAlert}
                    onDirtyChange={setIsScheduleDirty}
                  />
                </div>
              </section>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <AlertDialog
        open={discardPromptOpen}
        onOpenChange={(open) => !open && handleDiscardCancelled()}
        backdropClassName="z-[60] bg-black/60"
      >
        <AlertDialogContent
          className="z-[60]"
          data-testid="metadata-edit-discard-dialog"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{discardTitle}</AlertDialogTitle>
            <AlertDialogDescription>{discardDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardCancelled}>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDiscardConfirmed}>
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
