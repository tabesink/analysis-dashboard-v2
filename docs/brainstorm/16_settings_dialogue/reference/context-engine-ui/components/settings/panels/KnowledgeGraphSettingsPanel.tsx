"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { aiSettingsApi } from "@/lib/api/ai-settings";
import {
  knowledgeGraphAdminApi,
  type CreateKnowledgeGraphDomainPayload,
  type KnowledgeGraphDomain,
} from "@/lib/api/knowledge-graph-admin";
import { errorMessage as getErrorMessage } from "@/lib/utils";
import { selectIsAdmin, useAuthStore } from "@/stores/auth-store";
import type { AIModelProfile } from "@/types/ai-settings";

type DomainAction = "up" | "down" | "delete";
type ConfirmableAction = "delete";

const panelClassName = "rounded-lg border border-neutral-200 bg-white p-4";
const quietUnderlineInputClassName =
  "h-8 rounded-none border-0 border-b border-neutral-300 bg-neutral-50 px-2 text-sm text-neutral-900 shadow-none placeholder:text-neutral-400 focus-visible:border-neutral-500 focus-visible:ring-0";
const selectTriggerClassName =
  "h-9 w-full rounded-md border border-neutral-200 bg-white text-sm text-neutral-800 shadow-none [&_svg]:text-neutral-500";
const textButtonClassName = "h-8 rounded-md px-3 text-sm shadow-none";
const ghostButtonClassName =
  "h-8 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-none hover:bg-neutral-50";
const primaryButtonClassName =
  "h-8 rounded-md border border-neutral-950 bg-neutral-950 px-3 text-sm text-white shadow-none hover:bg-neutral-800";
const destructiveButtonClassName =
  "h-8 rounded-md border border-red-300 px-3 text-sm text-red-700 shadow-none hover:bg-red-50 hover:text-red-800";
const statusBadgeClassName = "rounded-md border border-neutral-200 bg-white text-[11px] font-medium text-neutral-700";
const fieldLabelClassName = "text-xs font-medium text-neutral-900";

function embeddingProfileLabel(profile: AIModelProfile): string {
  const dims = profile.dimensions ? ` · ${profile.dimensions} dims` : "";
  return `${profile.provider} · ${profile.model}${dims}`;
}

function HostPortRadioRow({
  checked,
  onSelect,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className="flex min-h-6 w-full items-center gap-2 text-left text-sm text-neutral-700"
    >
      <span
        className={`inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border ${
          checked ? "border-neutral-900" : "border-neutral-300"
        }`}
        aria-hidden
      >
        {checked ? <span className="size-1.5 rounded-full bg-neutral-900" /> : null}
      </span>
      <span>{children}</span>
    </button>
  );
}

export function KnowledgeGraphSettingsPanel() {
  const isAdmin = useAuthStore(selectIsAdmin);
  const [domains, setDomains] = React.useState<KnowledgeGraphDomain[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [actionBusyByDomain, setActionBusyByDomain] = React.useState<Record<string, DomainAction | null>>({});
  const [confirmAction, setConfirmAction] = React.useState<{ domainId: string; action: ConfirmableAction } | null>(null);
  const [createBusy, setCreateBusy] = React.useState(false);
  const [newDomainId, setNewDomainId] = React.useState("");
  const [newDisplayName, setNewDisplayName] = React.useState("");
  const [useCustomHostPort, setUseCustomHostPort] = React.useState(false);
  const [newHostPort, setNewHostPort] = React.useState("");
  const [embeddingProfiles, setEmbeddingProfiles] = React.useState<AIModelProfile[]>([]);
  const [selectedEmbeddingProfileId, setSelectedEmbeddingProfileId] = React.useState("");
  const selectedEmbeddingProfile = React.useMemo(
    () => embeddingProfiles.find((profile) => profile.id === selectedEmbeddingProfileId) ?? null,
    [embeddingProfiles, selectedEmbeddingProfileId],
  );

  const loadDomains = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await knowledgeGraphAdminApi.list();
      setDomains(list);
    } catch (nextError) {
      setError(getErrorMessage(nextError, "Failed to load knowledge graph domains"));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshDomains = React.useCallback(async () => {
    setError(null);
    setNotice(null);
    await loadDomains();
  }, [loadDomains]);

  React.useEffect(() => {
    if (!isAdmin) return;
    const task = window.setTimeout(() => {
      void refreshDomains();
    }, 0);
    return () => window.clearTimeout(task);
  }, [isAdmin, refreshDomains]);

  React.useEffect(() => {
    if (!isAdmin) return;
    const task = window.setTimeout(async () => {
      try {
        const settings = await aiSettingsApi.get();
        const enabledEmbeddings = settings.profiles.filter(
          (profile) => profile.kind === "embedding" && profile.is_enabled,
        );
        setEmbeddingProfiles(enabledEmbeddings);
        setSelectedEmbeddingProfileId(settings.defaults.embedding_profile_id);
      } catch {
        // Load/create flow handles surfaced API errors.
      }
    }, 0);
    return () => window.clearTimeout(task);
  }, [isAdmin]);

  const runAction = async (domainId: string, action: DomainAction) => {
    setActionBusyByDomain((prev) => ({ ...prev, [domainId]: action }));
    setError(null);
    setNotice(null);
    try {
      if (action === "up") await knowledgeGraphAdminApi.up(domainId);
      if (action === "down") await knowledgeGraphAdminApi.down(domainId);
      if (action === "delete") await knowledgeGraphAdminApi.remove(domainId);
      await refreshDomains();
    } catch (nextError) {
      setError(getErrorMessage(nextError, `Failed to ${action} domain`));
    } finally {
      setActionBusyByDomain((prev) => ({ ...prev, [domainId]: null }));
    }
  };

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const domainId = newDomainId.trim();
    const displayName = newDisplayName.trim();
    const hostPortRaw = useCustomHostPort ? newHostPort.trim() : "";
    const parsedHostPort = hostPortRaw ? Number.parseInt(hostPortRaw, 10) : undefined;
    if (!domainId) return;
    const invalidHostPort =
      hostPortRaw !== "" && (!Number.isInteger(parsedHostPort) || parsedHostPort === undefined || parsedHostPort < 1 || parsedHostPort > 65535);
    if (invalidHostPort) {
      setError("Host port must be an integer between 1 and 65535");
      return;
    }
    if (!selectedEmbeddingProfileId) {
      setError("Select an embedding model before creating a domain");
      return;
    }
    setCreateBusy(true);
    setError(null);
    setNotice(null);
    const payload: CreateKnowledgeGraphDomainPayload = {
      domain_id: domainId,
      display_name: displayName || undefined,
      host_port: parsedHostPort,
      embedding_profile_id: selectedEmbeddingProfileId,
    };
    try {
      await knowledgeGraphAdminApi.create(payload);
      setNewDomainId("");
      setNewDisplayName("");
      setUseCustomHostPort(false);
      setNewHostPort("");
      setNotice(`Domain ${domainId} created. Click Start when ready.`);
      await refreshDomains();
    } catch (nextError) {
      setError(getErrorMessage(nextError, "Failed to create domain"));
    } finally {
      setCreateBusy(false);
    }
  };

  const onConfirmAction = async () => {
    if (!confirmAction) return;
    const { domainId, action } = confirmAction;
    setConfirmAction(null);
    await runAction(domainId, action);
  };

  const onCancelCreate = () => {
    setNewDomainId("");
    setNewDisplayName("");
    setUseCustomHostPort(false);
    setNewHostPort("");
    setError(null);
  };

  if (!isAdmin) {
    return (
      <div className={panelClassName}>
        <p className="text-sm font-medium text-neutral-900">Admin access required</p>
        <p className="mt-1 text-xs text-neutral-600">
          Sign in with an admin account to manage knowledge graph domains.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white">
      <section className="space-y-3">
        <p className="text-sm font-medium text-neutral-900">Create knowledge graph domain</p>
        <form
          onSubmit={onCreate}
          className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
          aria-label="Create knowledge graph domain dialog"
        >
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="kg-domain-id" className={fieldLabelClassName}>
                  Domain ID
                </Label>
                <Input
                  id="kg-domain-id"
                  placeholder="fatigue"
                  value={newDomainId}
                  onChange={(event) => setNewDomainId(event.target.value)}
                  className={quietUnderlineInputClassName}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kg-display-name" className={fieldLabelClassName}>
                  Display name
                </Label>
                <Input
                  id="kg-display-name"
                  placeholder="Fatigue Manuals"
                  value={newDisplayName}
                  onChange={(event) => setNewDisplayName(event.target.value)}
                  className={quietUnderlineInputClassName}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="kg-embedding-profile" className={fieldLabelClassName}>
                Embedding model
              </Label>
              <Select value={selectedEmbeddingProfileId} onValueChange={setSelectedEmbeddingProfileId}>
                <SelectTrigger id="kg-embedding-profile" className={selectTriggerClassName}>
                  <SelectValue placeholder="Select embedding model" />
                </SelectTrigger>
                <SelectContent className="rounded-md border-neutral-200 shadow-none">
                  {embeddingProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {embeddingProfileLabel(profile)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-neutral-600">
                {selectedEmbeddingProfile?.dimensions
                  ? `Locked after creation · ${selectedEmbeddingProfile.dimensions} dimensions.`
                  : "Locked after creation."}
              </p>
            </div>

            <div className="space-y-2">
              <Label className={fieldLabelClassName}>Host port</Label>
              <div className="space-y-1.5" role="radiogroup" aria-label="Host port mode">
                <HostPortRadioRow
                  checked={!useCustomHostPort}
                  onSelect={() => {
                    setUseCustomHostPort(false);
                    setNewHostPort("");
                  }}
                >
                  Auto-assign available port
                </HostPortRadioRow>
                <HostPortRadioRow checked={useCustomHostPort} onSelect={() => setUseCustomHostPort(true)}>
                  Use custom port
                </HostPortRadioRow>
              </div>
              {useCustomHostPort ? (
                <div className="space-y-1.5">
                  <Label htmlFor="kg-host-port" className={fieldLabelClassName}>
                    Custom port
                  </Label>
                  <Input
                    id="kg-host-port"
                    type="number"
                    min={1}
                    max={65535}
                    placeholder="9621"
                    value={newHostPort}
                    onChange={(event) => setNewHostPort(event.target.value)}
                    className={quietUnderlineInputClassName}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <footer className="border-t border-neutral-200 px-4 py-3">
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" className={ghostButtonClassName} onClick={onCancelCreate}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createBusy} className={primaryButtonClassName}>
                {createBusy ? "Creating..." : "Create"}
              </Button>
            </div>
          </footer>
        </form>
      </section>

      <section className="space-y-3">
        <p className="text-sm font-medium text-neutral-900">Knowledge graph domains</p>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {notice ? <p className="text-sm text-neutral-600">{notice}</p> : null}

        <div className="space-y-2">
          {loading ? (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
              Loading domains...
            </div>
          ) : domains.length === 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
              No domains yet.
            </div>
          ) : (
            domains.map((domain) => {
              const busyAction = actionBusyByDomain[domain.id];
              const runtimeStatus = getRuntimeStatus(domain);
              const canControlRuntime = domain.management_state !== "db_only";
              return (
                <div key={domain.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-neutral-900">{domain.display_name || domain.id}</p>
                      </div>
                      <p className="font-mono text-[11px] text-neutral-500">
                        Domain ID: {domain.id} · Port: {domain.host_port ?? "n/a"}
                      </p>
                    </div>
                    <Badge className={`${statusBadgeClassName} ${runtimeStatus.textClassName}`}>
                      <span className={`mr-1 inline-block size-1.5 rounded-full ${runtimeStatus.dotClassName}`} aria-hidden />
                      {runtimeStatus.label}
                    </Badge>
                  </div>
                  <div className="mt-2 space-y-2 border-t border-neutral-100 pt-2">
                    <p className="font-mono text-[11px] text-neutral-500">
                      Source: {getManagementLabel(domain)}
                      {domain.lifecycle_state ? ` · lifecycle:${domain.lifecycle_state}` : ""}
                      {domain.manifest_status ? ` · manifest:${domain.manifest_status}` : ""}
                    </p>
                    {domain.reachability ? (
                      <p className="font-mono text-[11px] text-neutral-500">
                        Reachability: {getReachabilityLabel(domain)}
                      </p>
                    ) : null}
                    {domain.unavailable_reason ? (
                      <p className="text-xs text-orange-700">{domain.unavailable_reason}</p>
                    ) : null}
                    <p className="font-mono text-[11px] text-neutral-500">
                      Embedding:{" "}
                      {domain.embedding
                        ? `${domain.embedding.model}${domain.embedding.dimensions ? ` · ${domain.embedding.dimensions} dims` : ""} · locked`
                        : "Legacy / unknown"}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {runtimeStatus.isRunning ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(busyAction) || !canControlRuntime}
                        onClick={() => void runAction(domain.id, "down")}
                        className={textButtonClassName}
                      >
                        {busyAction === "down" ? "Stopping..." : "Stop"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(busyAction) || !canControlRuntime}
                        onClick={() => void runAction(domain.id, "up")}
                        className={textButtonClassName}
                      >
                        {busyAction === "up" ? "Starting..." : "Start"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(busyAction)}
                      onClick={() => setConfirmAction({ domainId: domain.id, action: "delete" })}
                      className={destructiveButtonClassName}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent className="rounded-lg border-neutral-200 bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete domain?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the domain from active use and archives its runtime files. Local document records are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm" className={ghostButtonClassName}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction size="sm" variant="destructive" className={textButtonClassName} onClick={() => void onConfirmAction()}>
              Delete domain
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type RuntimeStatus = {
  label: "Running" | "Stopped" | "Error" | "Unhealthy" | "Unreachable";
  isRunning: boolean;
  textClassName: string;
  dotClassName: string;
};

function getRuntimeStatus(domain: KnowledgeGraphDomain): RuntimeStatus {
  const status = domain.status?.toLowerCase();
  const runningByStatus = status === "running" || status === "running_unverified" || (!status && domain.is_healthy === true);
  if (domain.reachability && domain.reachability.ok === false && runningByStatus) {
    return { label: "Unreachable", isRunning: true, textClassName: "text-orange-700", dotClassName: "bg-orange-500" };
  }
  if (status === "error") {
    return { label: "Error", isRunning: false, textClassName: "text-red-700", dotClassName: "bg-red-600" };
  }
  if (status === "unhealthy" || ((status === "running" || status === "running_unverified") && domain.is_healthy === false)) {
    return { label: "Unhealthy", isRunning: false, textClassName: "text-orange-700", dotClassName: "bg-orange-500" };
  }
  if (runningByStatus) {
    return { label: "Running", isRunning: true, textClassName: "text-blue-700", dotClassName: "bg-blue-600" };
  }
  return { label: "Stopped", isRunning: false, textClassName: "text-neutral-700", dotClassName: "bg-neutral-400" };
}

function getManagementLabel(domain: KnowledgeGraphDomain): string {
  if (domain.management_state === "manifest_only") return "Manifest only";
  if (domain.management_state === "db_only") return "Lifecycle row only";
  if (domain.sources?.length) return domain.sources.join(" + ");
  return "Managed";
}

function getReachabilityLabel(domain: KnowledgeGraphDomain): string {
  const reachability = domain.reachability;
  if (!reachability) return "Not checked";
  if (reachability.ok) return "healthy";
  return reachability.reason_code || reachability.code || reachability.reason || "unreachable";
}
