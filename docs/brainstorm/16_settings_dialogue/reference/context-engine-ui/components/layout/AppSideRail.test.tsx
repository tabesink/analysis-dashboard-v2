import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AppSideRail } from "@/components/layout/AppSideRail";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { alt = "", src = "" } = props;
    return <img alt={String(alt)} src={String(src)} />;
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/chat",
}));

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: <T,>(selector: (state: { status: "authenticated"; logout: () => void }) => T) =>
    selector({ status: "authenticated", logout: () => undefined }),
}));

vi.mock("@/stores/settings-dialog-store", () => ({
  openSettingsDialog: vi.fn(),
  useSettingsDialogStore: <T,>(selector: (state: { isOpen: boolean }) => T) => selector({ isOpen: false }),
}));

describe("AppSideRail", () => {
  it("keeps core navigation visible without exposing Operations", () => {
    const markup = renderToStaticMarkup(<AppSideRail />);

    expect(markup).toContain('aria-label="Chat"');
    expect(markup).toContain('aria-label="Documents"');
    expect(markup).toContain('href="/documents"');
    expect(markup).toContain('aria-label="Knowledge graph"');
    expect(markup).toContain('aria-label="Settings"');
    expect(markup).not.toContain('aria-label="Operations"');
    expect(markup).not.toContain('href="/operations"');
  });
});
