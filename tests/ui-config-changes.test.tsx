/**
 * UI tests for:
 * 3. Opt-in badge has fixed width (w-24) for alignment
 * 4. Sign-out clears session then redirects to origin/login
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ClinicOptInToggle from "@/components/ClinicOptInToggle";
import Navbar from "@/components/Navbar";

// ─── Mock next-auth/react for Navbar ─────────────────────────────────────────
const mockSignOut = jest.fn().mockResolvedValue(undefined);
jest.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

// ─── Mock next/navigation for Navbar ─────────────────────────────────────────
jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

// ─── Mock next/link ───────────────────────────────────────────────────────────
jest.mock("next/link", () => {
  const Link = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  Link.displayName = "Link";
  return Link;
});

describe("ClinicOptInToggle - Badge Alignment", () => {
  test("status badge has fixed width class (w-24) for alignment", () => {
    const { container } = render(
      <ClinicOptInToggle clinicId="c1" initialOptedIn={true} />
    );
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("w-24");
  });

  test("badge has justify-center so text stays centred at fixed width", () => {
    const { container } = render(
      <ClinicOptInToggle clinicId="c1" initialOptedIn={false} />
    );
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("justify-center");
  });
});

describe("Navbar - Sign-out behavior", () => {
  beforeEach(() => {
    mockSignOut.mockClear().mockResolvedValue(undefined);
  });

  test("sign-out button has prominent gold styling", () => {
    render(<Navbar />);
    const btn = screen.getByText("Sign out");
    expect(btn.className).toContain("bg-[var(--fetch-pink)]");
    expect(btn.className).toContain("text-white");
  });

  test("sign-out calls signOut with redirect: false", async () => {
    render(<Navbar />);
    fireEvent.click(screen.getByText("Sign out"));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
    });
  });

  test("sign-out does NOT use callbackUrl (uses manual redirect instead)", async () => {
    render(<Navbar />);
    fireEvent.click(screen.getByText("Sign out"));

    await waitFor(() => {
      const args = mockSignOut.mock.calls[0][0] as Record<string, unknown>;
      // redirect: false means we handle the redirect ourselves
      expect(args.redirect).toBe(false);
      // Should NOT have callbackUrl since we redirect manually
      expect(args.callbackUrl).toBeUndefined();
    });
  });
});
