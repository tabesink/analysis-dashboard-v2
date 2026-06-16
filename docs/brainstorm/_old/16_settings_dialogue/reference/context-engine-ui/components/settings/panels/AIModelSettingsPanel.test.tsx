/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AIModelSettingsPanel } from "@/components/settings/panels/AIModelSettingsPanel";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { alt = "", src = "" } = props;
    return <img alt={String(alt)} src={String(src)} />;
  },
}));

vi.mock("@/stores/auth-store", () => ({
  selectIsAdmin: () => true,
  useAuthStore: () => true,
}));

const { aiSettingsApiMock, documentParserSettingsApiMock } = vi.hoisted(() => ({
  aiSettingsApiMock: {
    get: vi.fn(),
    setProviderSecret: vi.fn(),
  },
  documentParserSettingsApiMock: {
    get: vi.fn(),
    update: vi.fn(),
    testProfile: vi.fn(),
  },
}));

vi.mock("@/lib/api/ai-settings", () => ({
  aiSettingsApi: aiSettingsApiMock,
}));

vi.mock("@/lib/api/document-parser-settings", () => ({
  documentParserSettingsApi: documentParserSettingsApiMock,
}));

describe("AIModelSettingsPanel document parsing section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiSettingsApiMock.get.mockResolvedValue({
      defaults: {
        llm_profile_id: "openai",
        embedding_profile_id: "openai-embedding",
      },
      profiles: [],
      secret_status: {
        OPENAI_API_KEY: "missing",
        AWS_BEARER_TOKEN_BEDROCK: "missing",
      },
    });
    aiSettingsApiMock.setProviderSecret.mockResolvedValue({
      defaults: {
        llm_profile_id: "openai",
        embedding_profile_id: "openai-embedding",
      },
      profiles: [],
      secret_status: {
        OPENAI_API_KEY: "present",
        AWS_BEARER_TOKEN_BEDROCK: "missing",
      },
    });
    documentParserSettingsApiMock.get.mockResolvedValue({
      active_profile_id: "docling-local",
      profiles: [
        {
          id: "docling-local",
          provider: "docling",
          display_name: "Docling Local",
          base_url: null,
          api_key_env_var: null,
          api_key_status: "not_required",
          is_enabled: true,
          is_active: true,
          config: {},
        },
        {
          id: "reducto-cloud",
          provider: "reducto",
          display_name: "Reducto Cloud",
          base_url: "https://platform.reducto.ai",
          api_key_env_var: "REDUCTO_API_KEY",
          api_key_status: "missing",
          is_enabled: true,
          is_active: false,
          config: {},
        },
      ],
      secret_status: {
        REDUCTO_API_KEY: "missing",
      },
    });
    documentParserSettingsApiMock.update.mockResolvedValue({
      active_profile_id: "reducto-cloud",
      profiles: [
        {
          id: "docling-local",
          provider: "docling",
          display_name: "Docling Local",
          base_url: null,
          api_key_env_var: null,
          api_key_status: "not_required",
          is_enabled: true,
          is_active: false,
          config: {},
        },
        {
          id: "reducto-cloud",
          provider: "reducto",
          display_name: "Reducto Cloud",
          base_url: "https://platform.reducto.ai",
          api_key_env_var: "REDUCTO_API_KEY",
          api_key_status: "missing",
          is_enabled: true,
          is_active: true,
          config: {},
        },
      ],
      secret_status: {
        REDUCTO_API_KEY: "missing",
      },
    });
  });

  it("renders document parsing section with parser profiles and missing-secret state", async () => {
    render(<AIModelSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Document Parsing")).toBeTruthy();
    });
    expect(screen.getByText("Docling Local")).toBeTruthy();
    expect(screen.getByText("Reducto Cloud")).toBeTruthy();
    expect(screen.getByText("REDUCTO_API_KEY missing")).toBeTruthy();
  });

  it("allows selecting active parser profile", async () => {
    render(<AIModelSettingsPanel />);

    const activateReducto = await screen.findByRole("button", { name: "Activate Reducto Cloud" });
    fireEvent.click(activateReducto);

    await waitFor(() => {
      expect(documentParserSettingsApiMock.update).toHaveBeenCalledWith({
        active_profile_id: "reducto-cloud",
      });
    });
  });
});
