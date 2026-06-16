"use client";

import { useSyncExternalStore } from "react";

export type SettingsRoute = "general" | "account" | "knowledge-graph" | "provider";

type SettingsDialogState = {
  isOpen: boolean;
  route: SettingsRoute;
};

const listeners = new Set<() => void>();

let state: SettingsDialogState = {
  isOpen: false,
  route: "general",
};

function emit() {
  listeners.forEach((listener) => listener());
}

function setState(next: Partial<SettingsDialogState>) {
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

export function useSettingsDialogStore<T = SettingsDialogState>(
  selector: (value: SettingsDialogState) => T = (value) => value as T,
): T {
  return useSyncExternalStore(subscribe, () => selector(getSnapshot()), () => selector(getSnapshot()));
}

export function openSettingsDialog(route: SettingsRoute = "general") {
  setState({ isOpen: true, route });
}

export function closeSettingsDialog() {
  setState({ isOpen: false });
}

export function setSettingsDialogOpen(isOpen: boolean) {
  setState({ isOpen });
}

export function setSettingsDialogRoute(route: SettingsRoute) {
  setState({ route });
}
