"use client";

import * as React from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { aiSettingsApi } from "@/lib/api/ai-settings";
import { documentParserSettingsApi } from "@/lib/api/document-parser-settings";
import { cn, errorMessage as getErrorMessage } from "@/lib/utils";
import { selectIsAdmin, useAuthStore } from "@/stores/auth-store";
import type { AISettingsResponse, ProviderKind } from "@/types/ai-settings";
import type {
  DocumentParserProfile,
  DocumentParserSettingsResponse,
  SecretStatus,
} from "@/types/document-parser-settings";

const panelClassName = "rounded-lg border border-neutral-200 bg-white p-4 shadow-none";
const metaClassName = "text-[12px] font-mono text-neutral-500";
const statusClassName = "inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700";
const inputClassName =
  "h-8 rounded-none border-0 border-b border-neutral-300 bg-neutral-50 px-2 text-sm text-neutral-900 shadow-none placeholder:text-neutral-400 focus-visible:border-neutral-500 focus-visible:ring-0";
const sectionDividerClassName = "border-t border-neutral-100 pt-5";
const providerCardSpecs: Record<
  ProviderKind,
  {
    description: string;
    runtimeLabel: string;
    capabilities: string[];
  }
> = {
  openai: {
    description: "Hosted frontier models for chat and embeddings.",
    runtimeLabel: "Cloud API",
    capabilities: ["LLM", "Embeddings", "Managed"],
  },
  bedrock_openai: {
    description: "AWS Bedrock endpoint using the OpenAI-compatible profile.",
    runtimeLabel: "AWS runtime",
    capabilities: ["LLM", "AWS", "OpenAI shape"],
  },
  ollama: {
    description: "Local model runtime for development and private workloads.",
    runtimeLabel: "Local runtime",
    capabilities: ["Local", "No key", "Dev"],
  },
};
const providerSecrets = [
  {
    provider: "openai" as ProviderKind,
    secretName: "OPENAI_API_KEY",
    label: "OpenAI",
  },
  {
    provider: "bedrock_openai" as ProviderKind,
    secretName: "AWS_BEARER_TOKEN_BEDROCK",
    label: "AWS Bedrock",
  },
];

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function providerStatusLabel(provider: ProviderKind, secretStatus: "present" | "missing"): string {
  if (provider === "ollama") return "Local";
  if (secretStatus === "present") return "Ready";
  return "Missing key";
}

function providerStatusDotClass(provider: ProviderKind, secretStatus: "present" | "missing"): string {
  if (provider === "ollama") return "bg-emerald-500";
  if (secretStatus === "present") return "bg-emerald-500";
  return "bg-red-500";
}

function ProviderLogo({ provider, size = 40 }: { provider: ProviderKind; size?: number }) {
  if (provider === "bedrock_openai") {
    return (
      <Image
        src="/aws_logo_transparent.png"
        alt="AWS logo"
        width={size}
        height={size}
        unoptimized
        className="object-contain"
        style={{ height: size, width: size }}
      />
    );
  }

  if (provider === "ollama") {
    return (
      <Image
        src="/ollama_logo_transparent.png"
        alt="Ollama logo"
        width={size}
        height={size}
        unoptimized
        className="object-contain"
        style={{ height: size, width: size }}
      />
    );
  }

  return (
    <Image
      src="/openai_logo.svg"
      alt="OpenAI logo"
      width={size}
      height={size}
      unoptimized
      className="object-contain"
      style={{ height: size, width: size }}
    />
  );
}

function ProviderOverviewCard({
  provider,
  label,
  profileMeta,
  secretStatus,
  selected,
  onSelect,
}: {
  provider: ProviderKind;
  label: string;
  profileMeta: string;
  secretStatus: "present" | "missing";
  selected: boolean;
  onSelect: () => void;
}) {
  const cardSpec = providerCardSpecs[provider];

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      data-slot="card"
      className={cn(
        "text-card-foreground grid min-h-32 w-full cursor-pointer grid-rows-[auto_1fr_auto] gap-4 rounded-lg border p-4 text-left shadow-none transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        selected
          ? "border-neutral-900 bg-neutral-50"
          : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-neutral-900" : "border-neutral-300",
          )}
          aria-hidden
        >
          {selected ? <span className="size-1.5 rounded-full bg-neutral-900" /> : null}
        </span>

        <div className="flex min-w-0 items-center justify-end gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center">
            <ProviderLogo provider={provider} />
          </div>
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-medium text-neutral-900">{label}</p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-neutral-500">{cardSpec.runtimeLabel}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="max-w-[26ch] text-xs leading-4 text-neutral-600">{cardSpec.description}</p>
        <div className="flex flex-wrap gap-1.5">
          {cardSpec.capabilities.map((capability) => (
            <span
              key={capability}
              className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-neutral-600"
            >
              {capability}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-end justify-between gap-2">
        <p className={metaClassName}>{profileMeta}</p>
        <p className={statusClassName}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${providerStatusDotClass(provider, secretStatus)}`}
            aria-hidden
          />
          {providerStatusLabel(provider, secretStatus)}
        </p>
      </div>
    </button>
  );
}

export function AIModelSettingsPanel() {
  const isAdmin = useAuthStore(selectIsAdmin);
  const [settings, setSettings] = React.useState<AISettingsResponse | null>(null);
  const [parserSettings, setParserSettings] = React.useState<DocumentParserSettingsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [parserActionBusyById, setParserActionBusyById] = React.useState<Record<string, boolean>>({});
  const [parserTestResultById, setParserTestResultById] = React.useState<Record<string, string>>({});
  const [secretInputs, setSecretInputs] = React.useState<Record<string, string>>({});
  const [secretBusyByName, setSecretBusyByName] = React.useState<Record<string, boolean>>({});
  const [secretVisibleByName, setSecretVisibleByName] = React.useState<Record<string, boolean>>({});
  const [selectedProvider, setSelectedProvider] = React.useState<ProviderKind>("openai");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSettings, nextParserSettings] = await Promise.all([
        aiSettingsApi.get(),
        documentParserSettingsApi.get(),
      ]);
      setSettings(nextSettings);
      setParserSettings(nextParserSettings);
    } catch (nextError) {
      setError(getErrorMessage(nextError, "Failed to load AI settings"));
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

  const setSecretInput = (secretName: string, value: string) => {
    setSecretInputs((current) => ({ ...current, [secretName]: value }));
  };

  const toggleSecretVisible = (secretName: string) => {
    setSecretVisibleByName((current) => ({ ...current, [secretName]: !current[secretName] }));
  };

  const onSaveSecret = async (secretName: string) => {
    const value = (secretInputs[secretName] || "").trim();
    if (!value) return;
    setSecretBusyByName((current) => ({ ...current, [secretName]: true }));
    setError(null);
    try {
      const next = await aiSettingsApi.setProviderSecret(secretName, { value });
      setSettings(next);
      setSecretInput(secretName, "");
    } catch (nextError) {
      setError(getErrorMessage(nextError, `Failed to save ${secretName}`));
    } finally {
      setSecretBusyByName((current) => ({ ...current, [secretName]: false }));
    }
  };

  const onActivateParserProfile = async (profileId: string) => {
    setParserActionBusyById((current) => ({ ...current, [profileId]: true }));
    setError(null);
    try {
      const next = await documentParserSettingsApi.update({ active_profile_id: profileId });
      setParserSettings(next);
      setParserTestResultById((current) => ({
        ...current,
        [profileId]: "Profile activated",
      }));
    } catch (nextError) {
      setError(getErrorMessage(nextError, `Failed to activate parser profile '${profileId}'`));
    } finally {
      setParserActionBusyById((current) => ({ ...current, [profileId]: false }));
    }
  };

  const onTestParserProfile = async (profileId: string) => {
    setParserActionBusyById((current) => ({ ...current, [profileId]: true }));
    setError(null);
    try {
      const result = await documentParserSettingsApi.testProfile(profileId);
      setParserTestResultById((current) => ({
        ...current,
        [profileId]: result.message,
      }));
    } catch (nextError) {
      setError(getErrorMessage(nextError, `Failed to validate parser profile '${profileId}'`));
    } finally {
      setParserActionBusyById((current) => ({ ...current, [profileId]: false }));
    }
  };

  if (!isAdmin) {
    return (
      <div className={panelClassName}>
        <p className="text-sm font-medium text-neutral-900">Admin access required</p>
        <p className="mt-1 text-xs text-neutral-600">
          Sign in with an admin account to configure model providers.
        </p>
      </div>
    );
  }

  const profiles = settings?.profiles ?? [];
  const parserProfiles = parserSettings?.profiles ?? [];
  const openAiProfileCount = profiles.filter((item) => item.provider === "openai" && item.is_enabled).length;
  const bedrockProfileCount = profiles.filter((item) => item.provider === "bedrock_openai" && item.is_enabled).length;
  const ollamaProfileCount = profiles.filter((item) => item.provider === "ollama" && item.is_enabled).length;
  const openAiSecretStatus = settings?.secret_status.OPENAI_API_KEY ?? "missing";
  const bedrockSecretStatus = settings?.secret_status.AWS_BEARER_TOKEN_BEDROCK ?? "missing";
  const reductoSecretStatus: SecretStatus = parserSettings?.secret_status.REDUCTO_API_KEY ?? "missing";

  const parserStatusDotClass = (profile: DocumentParserProfile) => {
    if (!profile.is_enabled) return "bg-orange-500";
    if (profile.is_active) return "bg-blue-500";
    if (profile.api_key_status === "missing") return "bg-red-500";
    return "bg-emerald-500";
  };

  const parserStatusLabel = (profile: DocumentParserProfile) => {
    if (!profile.is_enabled) return "Disabled";
    if (profile.is_active) return "Active";
    if (profile.api_key_status === "missing") return "Missing key";
    return "Ready";
  };

  return (
    <div>
      <section className="space-y-3 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">Model Providers</p>
            <p className="mt-1 text-xs leading-4 text-neutral-600">
              Select a provider and compare runtime, credential, and profile coverage.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-[1.1fr_1fr_1fr]" role="radiogroup" aria-label="Active provider">
          <ProviderOverviewCard
            provider="openai"
            label="OpenAI"
            profileMeta={countLabel(openAiProfileCount, "profile", "profiles")}
            secretStatus={openAiSecretStatus}
            selected={selectedProvider === "openai"}
            onSelect={() => setSelectedProvider("openai")}
          />
          <ProviderOverviewCard
            provider="bedrock_openai"
            label="AWS Bedrock"
            profileMeta={countLabel(bedrockProfileCount, "profile", "profiles")}
            secretStatus={bedrockSecretStatus}
            selected={selectedProvider === "bedrock_openai"}
            onSelect={() => setSelectedProvider("bedrock_openai")}
          />
          <ProviderOverviewCard
            provider="ollama"
            label="Ollama"
            profileMeta={countLabel(ollamaProfileCount, "profile", "profiles")}
            secretStatus="present"
            selected={selectedProvider === "ollama"}
            onSelect={() => setSelectedProvider("ollama")}
          />
        </div>
      </section>

      <section className={`${sectionDividerClassName} pb-5`}>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">Document Parsing</p>
            <p className="mt-1 text-xs leading-4 text-neutral-600">
              Manage parser profiles used during ingestion and validate provider readiness.
            </p>
          </div>

          <p className={`${metaClassName} inline-flex items-center gap-2`}>
            <span className={`h-1.5 w-1.5 rounded-full ${reductoSecretStatus === "present" ? "bg-emerald-500" : "bg-red-500"}`} />
            REDUCTO_API_KEY {reductoSecretStatus}
          </p>

          <div className="space-y-2.5">
            {parserProfiles.map((profile) => {
              const actionBusy = Boolean(parserActionBusyById[profile.id]);
              const testMessage = parserTestResultById[profile.id];

              return (
                <Card
                  key={profile.id}
                  className="grid gap-3 rounded-lg border-neutral-200 bg-white p-4 shadow-none md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-neutral-900">{profile.display_name}</p>
                      <p className={statusClassName}>
                        <span className={`h-1.5 w-1.5 rounded-full ${parserStatusDotClass(profile)}`} aria-hidden />
                        {parserStatusLabel(profile)}
                      </p>
                    </div>
                    <p className={metaClassName}>{profile.provider}</p>
                    {testMessage ? <p className="text-xs text-neutral-600">{testMessage}</p> : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-md border-neutral-300 px-3"
                      onClick={() => void onTestParserProfile(profile.id)}
                      disabled={actionBusy}
                    >
                      {actionBusy ? "Testing..." : "Test"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 rounded-md border border-neutral-950 bg-neutral-950 px-3 text-white shadow-none hover:bg-neutral-800"
                      onClick={() => void onActivateParserProfile(profile.id)}
                      disabled={actionBusy || profile.is_active || !profile.is_enabled}
                      aria-label={`Activate ${profile.display_name}`}
                    >
                      {profile.is_active ? "Active" : "Activate"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className={`${sectionDividerClassName} pb-5`}>
        <details className="group space-y-3">
          <summary className="-mx-1 flex cursor-pointer list-none items-start justify-between gap-3 rounded-md px-1 py-1 transition-colors hover:bg-neutral-50 [&::-webkit-details-marker]:hidden">
            <div>
              <p className="text-sm font-medium text-neutral-900">Credential management</p>
              <p className="mt-1 text-xs leading-4 text-neutral-600">
                Save write-only credentials for external providers.
              </p>
            </div>
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-neutral-500 transition-transform group-open:rotate-180" />
          </summary>

          <div className="space-y-2.5">
            {providerSecrets.map((provider) => {
              const busy = Boolean(secretBusyByName[provider.secretName]);
              const typedValue = secretInputs[provider.secretName] || "";
              const canSave = typedValue.trim().length > 0 && !busy;
              const isVisible = Boolean(secretVisibleByName[provider.secretName]);

              return (
                <Card key={provider.secretName} className="grid gap-3 rounded-lg border-neutral-200 bg-white p-4 shadow-none md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-center">
                  <div className="flex h-full items-center gap-2.5 self-center">
                    <div className="grid h-8 w-8 place-items-center">
                      <ProviderLogo provider={provider.provider} size={32} />
                    </div>
                    <p className="text-sm font-medium text-neutral-900">{provider.label}</p>
                  </div>

                  <div>
                    <div className="relative">
                      <Input
                        id={`provider-secret-${provider.secretName}`}
                        type={isVisible ? "text" : "password"}
                        value={typedValue}
                        onChange={(event) => setSecretInput(provider.secretName, event.target.value)}
                        placeholder="Enter API Key..."
                        className={`${inputClassName} pr-9`}
                        autoComplete="off"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleSecretVisible(provider.secretName)}
                        className="absolute right-0 top-0 h-8 w-8 rounded-md border border-transparent text-neutral-500 hover:border-neutral-200 hover:bg-neutral-50 hover:text-neutral-800"
                        aria-label={isVisible ? `Hide ${provider.label} credential` : `Show ${provider.label} credential`}
                      >
                        {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void onSaveSecret(provider.secretName)}
                    disabled={!canSave}
                    className="h-8 rounded-md border border-neutral-950 bg-neutral-950 px-3 text-white shadow-none hover:bg-neutral-800"
                  >
                    {busy ? "Saving..." : "Save"}
                  </Button>
                </Card>
              );
            })}
          </div>
        </details>
      </section>

      {loading || error ? (
        <div className="space-y-3 border-t border-neutral-100 pt-4">
          {loading ? (
            <p className="text-xs text-neutral-500">Loading provider settings...</p>
          ) : null}

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
