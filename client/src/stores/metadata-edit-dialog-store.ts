"use client";

import { useSyncExternalStore } from "react";

export type MetadataDialogSection =
  | "edit-metadata"
  | "assign-channels"
  | "durability-schedule";

export interface MetadataEditDialogScope {
  programId: string;
  version: string;
}

type MetadataEditDialogState = MetadataEditDialogScope & {
  isOpen: boolean;
  pendingScope: MetadataEditDialogScope | null;
  pendingSection: MetadataDialogSection | null;
};

const CLOSED_STATE: MetadataEditDialogState = {
  isOpen: false,
  programId: "",
  version: "",
  pendingScope: null,
  pendingSection: null,
};

const listeners = new Set<() => void>();

let state: MetadataEditDialogState = { ...CLOSED_STATE };

function emit() {
  listeners.forEach((listener) => listener());
}

function setState(next: Partial<MetadataEditDialogState>) {
  state = { ...state, ...next };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function getMetadataEditDialogSnapshot(): MetadataEditDialogState {
  return getSnapshot();
}

export function useMetadataEditDialogStore<T = MetadataEditDialogState>(
  selector: (value: MetadataEditDialogState) => T = (value) => value as T,
): T {
  return useSyncExternalStore(subscribe, () => selector(getSnapshot()), () => selector(getSnapshot()));
}

export function openMetadataEditDialog(scope: MetadataEditDialogScope) {
  if (state.isOpen) {
    setState({ pendingScope: scope });
    return;
  }
  setState({
    isOpen: true,
    programId: scope.programId,
    version: scope.version,
    pendingScope: null,
    pendingSection: null,
  });
}

export function requestMetadataEditDialogSection(section: MetadataDialogSection) {
  setState({ pendingSection: section });
}

export function clearPendingMetadataEditDialogSection() {
  setState({ pendingSection: null });
}

export function closeMetadataEditDialog() {
  setState({ ...CLOSED_STATE });
}

export function setMetadataEditDialogOpen(isOpen: boolean) {
  if (!isOpen) {
    return;
  }
  setState({ isOpen });
}

export function clearPendingMetadataEditDialogScope() {
  setState({ pendingScope: null });
}

export function applyPendingMetadataEditDialogScope() {
  if (!state.pendingScope) {
    return;
  }
  setState({
    programId: state.pendingScope.programId,
    version: state.pendingScope.version,
    pendingScope: null,
  });
}
