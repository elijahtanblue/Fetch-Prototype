/**
 * Frontend Interaction Test for ClinicOptInToggle
 *
 * Verifies that the toggle component calls the PATCH API
 * and updates the displayed state on success.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ClinicOptInToggle from "@/components/ClinicOptInToggle";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("ClinicOptInToggle - UI Interaction", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  test("renders toggle button", () => {
    render(<ClinicOptInToggle clinicId="c1" initialOptedIn={false} />);
    const button = screen.getByRole("button", { name: /toggle opt-in/i });
    expect(button).toBeTruthy();
  });

  test("calls PATCH /api/clinics/:id on click", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "c1", name: "City Physio", optedIn: true }),
    });

    render(<ClinicOptInToggle clinicId="c1" initialOptedIn={false} />);
    const button = screen.getByRole("button", { name: /toggle opt-in/i });

    fireEvent.click(button);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/clinics/c1", {
        method: "PATCH",
      });
    });
  });

  test("updates visual state after successful toggle (false → true)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "c1", name: "City Physio", optedIn: true }),
    });

    render(<ClinicOptInToggle clinicId="c1" initialOptedIn={false} />);
    const button = screen.getByRole("button", { name: /toggle opt-in/i });

    // Initially should have gray background (not opted in)
    expect(button.className).toContain("bg-gray-300");

    fireEvent.click(button);

    await waitFor(() => {
      // After toggle, should have green background (opted in)
      expect(button.className).toContain("bg-green-500");
    });
  });

  test("updates visual state after successful toggle (true → false)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "c1", name: "City Physio", optedIn: false }),
    });

    render(<ClinicOptInToggle clinicId="c1" initialOptedIn={true} />);
    const button = screen.getByRole("button", { name: /toggle opt-in/i });

    // Initially green (opted in)
    expect(button.className).toContain("bg-green-500");

    fireEvent.click(button);

    await waitFor(() => {
      // After toggle, should be gray (not opted in)
      expect(button.className).toContain("bg-gray-300");
    });
  });

  test("button is disabled while API call is in progress", async () => {
    let resolvePromise: (value: unknown) => void;
    mockFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );

    render(<ClinicOptInToggle clinicId="c1" initialOptedIn={false} />);
    const button = screen.getByRole("button", { name: /toggle opt-in/i });

    fireEvent.click(button);

    expect(button).toBeDisabled();

    resolvePromise!({
      ok: true,
      json: async () => ({ id: "c1", optedIn: true }),
    });

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });
});
