'use client';

import { DerivedDataOperationModal } from '@/features/edit-metadata/DerivedDataOperationModal';
import {
  openMetadataEditDialog,
  requestMetadataEditDialogSection,
} from '@/stores/metadata-edit-dialog-store';
import {
  closeChannelReprocessSummary,
  dismissChannelReprocessModal,
  type ChannelReprocessScope,
  useChannelReprocessStore,
} from '@/stores/channel-reprocess-store';
import {
  closeDamageCalculationSummary,
  dismissDamageCalculationModal,
  type DamageCalculationScope,
  useDamageCalculationStore,
} from '@/stores/damage-calculation-store';

function parseScopeKey(key: string): ChannelReprocessScope {
  const separatorIndex = key.indexOf('::');
  return {
    programId: key.slice(0, separatorIndex),
    version: key.slice(separatorIndex + 2),
  };
}

export function DatabaseDerivedDataOperationModals() {
  const channelReprocessScopes = useChannelReprocessStore((state) => state.scopes);
  const damageCalculationScopes = useDamageCalculationStore((state) => state.scopes);

  return (
    <>
      {Object.entries(channelReprocessScopes).map(([key, scopeState]) => {
        const scope = parseScopeKey(key);
        return (
          <DerivedDataOperationModal
            key={`channel-reprocess-${key}`}
            open={scopeState.modalOpen}
            onOpenChange={(open) => {
              if (!open && scopeState.wizardStep === 'progress') {
                dismissChannelReprocessModal(scope);
                return;
              }
              if (!open && scopeState.wizardStep === 'summary') {
                closeChannelReprocessSummary(scope);
              }
            }}
            taskKind="channel_reprocess"
            wizardStep={scopeState.wizardStep}
            progress={scopeState.progress}
            progressPhase={scopeState.progressPhase}
            progressMessage={scopeState.progressMessage}
            completionResult={scopeState.completionResult}
            onDismissProgress={() => dismissChannelReprocessModal(scope)}
            onCloseSummary={() => closeChannelReprocessSummary(scope)}
          />
        );
      })}

      {Object.entries(damageCalculationScopes)
        .filter(([, scopeState]) => scopeState.taskId)
        .map(([key, scopeState]) => {
          const scope = parseScopeKey(key) as DamageCalculationScope;
          return (
            <DerivedDataOperationModal
              key={`damage-calculation-${key}`}
              open={scopeState.modalOpen}
              onOpenChange={(open) => {
                if (!open && scopeState.wizardStep === 'progress') {
                  dismissDamageCalculationModal(scope);
                  return;
                }
                if (!open && scopeState.wizardStep === 'summary') {
                  closeDamageCalculationSummary(scope);
                }
              }}
              taskKind="damage_calculation"
              wizardStep={scopeState.wizardStep}
              progress={scopeState.progress}
              progressPhase={scopeState.progressPhase}
              progressMessage={scopeState.progressMessage}
              completionResult={scopeState.completionResult}
              onDismissProgress={() => dismissDamageCalculationModal(scope)}
              onCloseSummary={() => closeDamageCalculationSummary(scope)}
              onPrimaryAction={() => {
                openMetadataEditDialog(scope);
                requestMetadataEditDialogSection('durability-schedule');
                dismissDamageCalculationModal(scope);
              }}
            />
          );
        })}
    </>
  );
}
