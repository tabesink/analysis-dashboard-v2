"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  adminDocumentsApi,
  type AdminDocument,
  type ProcessingDocumentStatus,
} from "@/lib/api/admin-documents";
import { knowledgeGraphAdminApi, type KnowledgeGraphDomain } from "@/lib/api/knowledge-graph-admin";
import { errorMessage as getErrorMessage } from "@/lib/utils";
import { selectIsAdmin, useAuthStore } from "@/stores/auth-store";

const panelClassName = "rounded-lg border border-neutral-200 bg-white";
const labelClassName = "text-xs font-medium text-neutral-900";
const selectTriggerClassName =
  "h-9 w-full rounded-md border border-neutral-200 bg-white text-sm text-neutral-800 shadow-none [&_svg]:text-neutral-500";
const textButtonClassName = "h-8 rounded-md px-3 text-sm shadow-none";
const primaryButtonClassName =
  "h-8 rounded-md border border-neutral-950 bg-neutral-950 px-3 text-sm text-white shadow-none hover:bg-neutral-800";

type DocumentRow = {
  document: AdminDocument;
  processing?: ProcessingDocumentStatus;
};

const terminalStatuses = new Set(["ready", "failed", "deleted"]);

export function DocumentsSettingsPanel() {
  const isAdmin = useAuthStore(selectIsAdmin);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [domains, setDomains] = React.useState<KnowledgeGraphDomain[]>([]);
  const [selectedDomainId, setSelectedDomainId] = React.useState("");
  const [rows, setRows] = React.useState<DocumentRow[]>([]);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [documentList, domainList] = await Promise.all([
        adminDocumentsApi.list(),
        knowledgeGraphAdminApi.list(),
      ]);
      setRows(documentList.map((document) => ({ document })));
      setDomains(domainList);
      setSelectedDomainId((current) => current || domainList[0]?.id || "");
    } catch (nextError) {
      setError(getErrorMessage(nextError, "Failed to load documents"));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isAdmin) return;
    const task = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(task);
  }, [isAdmin, load]);

  React.useEffect(() => {
    if (!isAdmin || rows.length === 0) return;
    const activeIds = rows
      .filter((row) => !terminalStatuses.has(row.processing?.status || row.document.status))
      .map((row) => row.document.id);
    if (activeIds.length === 0) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const statuses = await Promise.all(activeIds.map((id) => adminDocumentsApi.processingStatus(id)));
        if (cancelled) return;
        setRows((currentRows) =>
          currentRows.map((row) => {
            const status = statuses.find((item) => item.document.document_id === row.document.id);
            if (!status) return row;
            return {
              document: { ...row.document, status: status.document.status, updated_at: status.document.updated_at },
              processing: status.document,
            };
          }),
        );
      } catch {
        // Keep the latest local row state when a transient polling request fails.
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isAdmin, rows]);

  const onUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile || !selectedDomainId) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await adminDocumentsApi.uploadToDomain(selectedFile, selectedDomainId);
      let processing: ProcessingDocumentStatus | undefined;
      try {
        const status = await adminDocumentsApi.processingStatusFromUpload(response);
        processing = status.document;
      } catch {
        // Upload is durable even if first status read fails; polling will fill this in.
      }
      setRows((currentRows) => [{ document: response.document, processing }, ...currentRows]);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotice(
        `${response.document.filename} queued for processing${response.operation_id ? ` (operation ${response.operation_id})` : ""}.`,
      );
    } catch (nextError) {
      setError(getErrorMessage(nextError, "Failed to upload document"));
    } finally {
      setUploading(false);
    }
  };

  const retry = async (documentId: string) => {
    setError(null);
    setNotice(null);
    try {
      const response = await adminDocumentsApi.retryIngestion(documentId);
      setRows((currentRows) =>
        currentRows.map((row) =>
          row.document.id === documentId ? { document: response.document } : row,
        ),
      );
      setNotice(`${response.document.filename} queued for retry.`);
    } catch (nextError) {
      setError(getErrorMessage(nextError, "Failed to retry ingestion"));
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <p className="text-sm font-medium text-neutral-900">Admin access required</p>
        <p className="mt-1 text-xs text-neutral-600">Sign in with an admin account to manage documents.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white">
      <form className={`${panelClassName} overflow-hidden`} onSubmit={onUpload}>
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[1fr_220px_auto] md:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="document-upload-file" className={labelClassName}>
              Document
            </Label>
            <Input
              ref={fileInputRef}
              id="document-upload-file"
              type="file"
              className="h-9 rounded-md border-neutral-200 bg-white text-sm shadow-none"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="document-upload-domain" className={labelClassName}>
              Domain
            </Label>
            <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
              <SelectTrigger id="document-upload-domain" className={selectTriggerClassName}>
                <SelectValue placeholder="Select domain" />
              </SelectTrigger>
              <SelectContent className="rounded-md border-neutral-200 shadow-none">
                {domains.map((domain) => (
                  <SelectItem key={domain.id} value={domain.id}>
                    {domain.display_name || domain.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!selectedFile || !selectedDomainId || uploading}
            className={primaryButtonClassName}
          >
            <Upload className="mr-1.5 size-3.5" aria-hidden />
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </form>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="text-sm text-neutral-600">{notice}</p> : null}

      <section className={panelClassName}>
        <div className="border-b border-neutral-100 px-4 py-3">
          <p className="text-sm font-medium text-neutral-900">Documents</p>
          <p className="mt-1 text-xs text-neutral-600">
            Upload status follows document processing until each file is ready or failed.
          </p>
        </div>
        {loading ? (
          <p className="p-4 text-sm text-neutral-600">Loading documents...</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-neutral-600">No documents yet.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {rows.map((row) => {
              const status = row.processing?.status ?? row.document.status;
              const canRetry = row.processing?.can_retry ?? status === "failed";
              return (
                <div key={row.document.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <StatusDot status={status} />
                      <p className="truncate text-sm font-medium text-neutral-900">{row.document.filename}</p>
                      <span className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] text-neutral-700">
                        {statusLabel(status)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600">
                      {row.processing?.message || row.document.error_message || "Waiting for processing update"}
                    </p>
                    <p className="font-mono text-[11px] text-neutral-500">
                      {row.processing?.stage || "stage n/a"} · {row.document.id}
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    {status === "ready" ? (
                      <Button type="button" size="sm" variant="outline" className={textButtonClassName}>
                        Open
                      </Button>
                    ) : null}
                    {canRetry ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={textButtonClassName}
                        onClick={() => void retry(row.document.id)}
                      >
                        Retry
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusDot({ status }: { status: AdminDocument["status"] }) {
  const className =
    status === "ready"
      ? "bg-green-600"
      : status === "failed"
        ? "bg-red-600"
        : status === "indexing"
          ? "bg-blue-600"
          : "bg-neutral-400";
  return <span className={`size-1.5 shrink-0 rounded-full ${className}`} aria-hidden />;
}

function statusLabel(status: AdminDocument["status"]): string {
  if (status === "indexing") return "Processing";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

