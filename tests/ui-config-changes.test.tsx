/**
 * UI tests for:
 * 3. Opt-in badge has fixed width (w-24) for alignment
 * 4. Sign-out uses window.location.origin + '/login'
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import ClinicOptInToggle from "@/components/ClinicOptInToggle";
import Navbar from "@/components/Navbar";

// ─── Mock next-auth/react for Navbar ─────────────────────────────────────────
const mockSignOut = jest.fn();
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

describe("Navbar - Sign-out uses window.location.origin", () => {
  beforeEach(() => {
    mockSignOut.mockClear();
  });

  test("sign-out button calls signOut with callbackUrl ending in /login", () => {
    render(<Navbar />);
    fireEvent.click(screen.getByText("Sign out"));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    const args = mockSignOut.mock.calls[0][0] as { callbackUrl: string };
    expect(args.callbackUrl).toMatch(/\/login$/);
  });

  test("sign-out callbackUrl is window.location.origin + /login", () => {
    render(<Navbar />);
    fireEvent.click(screen.getByText("Sign out"));

    const args = mockSignOut.mock.calls[0][0] as { callbackUrl: string };
    expect(args.callbackUrl).toBe(`${window.location.origin}/login`);
  });

  test("sign-out does NOT use a hardcoded relative /login path", () => {
    render(<Navbar />);
    fireEvent.click(screen.getByText("Sign out"));

    const args = mockSignOut.mock.calls[0][0] as { callbackUrl: string };
    // Must be an absolute URL built from origin, not just '/login'
    expect(args.callbackUrl).not.toBe("/login");
    expect(args.callbackUrl.startsWith("http")).toBe(true);
  });
});
