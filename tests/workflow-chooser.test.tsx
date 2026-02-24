/**
 * UI tests for the AddUpdateForm workflow chooser.
 *
 * Verifies:
 * - Chooser renders both options
 * - Structured form shows all fields
 * - Quick Handoff form shows minimal fields
 * - Submit includes correct updateType
 * - Cancel returns to closed state
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AddUpdateForm from "@/components/AddUpdateForm";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("AddUpdateForm - Workflow Chooser", () => {
  const mockOnCreated = jest.fn();

  beforeEach(() => {
    mockOnCreated.mockReset();
    mockFetch.mockReset();
  });

  test("shows + Add Update button initially", () => {
    render(<AddUpdateForm episodeId="ep1" onCreated={mockOnCreated} />);
    expect(screen.getByText("+ Add Update")).toBeInTheDocument();
  });

  test("clicking + Add Update shows workflow chooser", () => {
    render(<AddUpdateForm episodeId="ep1" onCreated={mockOnCreated} />);
    fireEvent.click(screen.getByText("+ Add Update"));

    expect(screen.getByText("Choose Update Type")).toBeInTheDocument();
    expect(screen.getByText("Structured Continuity")).toBeInTheDocument();
    expect(screen.getByText("Quick Handoff")).toBeInTheDocument();
  });

  test("chooser shows Recommended tag on Structured option", () => {
    render(<AddUpdateForm episodeId="ep1" onCreated={mockOnCreated} />);
    fireEvent.click(screen.getByText("+ Add Update"));

    expect(screen.getByText("(Recommended)")).toBeInTheDocument();
  });

  test("chooser shows ~30s tag on Quick Handoff option", () => {
    render(<AddUpdateForm episodeId="ep1" onCreated={mockOnCreated} />);
    fireEvent.click(screen.getByText("+ Add Update"));

    expect(screen.getByText("(~30s)")).toBeInTheDocument();
  });

  test("selecting Structured shows full form with new fields", () => {
    render(<AddUpdateForm episodeId="ep1" onCreated={mockOnCreated} />);
    fireEvent.click(screen.getByText("+ Add Update"));
    fireEvent.click(screen.getByTestId("chooser-structured"));

    expect(screen.getByText("Structured Continuity Update")).toBeInTheDocument();
    expect(screen.getByLabelText("Pain Region")).toBeInTheDocument();
    expect(screen.getByLabelText("Diagnosis")).toBeInTheDocument();
    expect(screen.getByLabelText("Treatment Modalities")).toBeInTheDocument();
    expect(screen.getByLabelText("Red Flags Present")).toBeInTheDocument();
    expect(screen.getByLabelText("Precautions (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Response Pattern (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Suggested Next Steps (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Clinical Notes (optional)")).toBeInTheDocument();
  });

  test("selecting Quick Handoff shows form with treatment and notes", () => {
    render(<AddUpdateForm episodeId="ep1" onCreated={mockOnCreated} />);
    fireEvent.click(screen.getByText("+ Add Update"));
    fireEvent.click(screen.getByTestId("chooser-quick"));

    expect(screen.getByText("Quick Handoff")).toBeInTheDocument();
    expect(screen.getByLabelText("Pain Region")).toBeInTheDocument();
    expect(screen.getByLabelText("Diagnosis")).toBeInTheDocument();
    expect(screen.getByLabelText("Treatment Modalities")).toBeInTheDocument();
    expect(screen.getByLabelText("Clinical Notes (optional)")).toBeInTheDocument();

    // Should NOT show structured-only fields
    expect(screen.queryByLabelText("Red Flags Present")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Precautions (optional)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Response Pattern (optional)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Suggested Next Steps (optional)")).not.toBeInTheDocument();
  });

  test("Structured form submits with updateType STRUCTURED", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "u1", pointsEarned: 6 }),
    });

    render(<AddUpdateForm episodeId="ep1" onCreated={mockOnCreated} />);
    fireEvent.click(screen.getByText("+ Add Update"));
    fireEvent.click(screen.getByTestId("chooser-structured"));

    fireEvent.change(screen.getByLabelText("Pain Region"), { target: { value: "Lower back" } });
    fireEvent.change(screen.getByLabelText("Diagnosis"), { target: { value: "Herniation" } });
    fireEvent.change(screen.getByLabelText("Treatment Modalities"), { target: { value: "Manual therapy" } });

    fireEvent.click(screen.getByText("Save Update"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/updates", expect.objectContaining({
        method: "POST",
      }));
    });

    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.updateType).toBe("STRUCTURED");
    expect(callBody.episodeId).toBe("ep1");
  });

  test("Quick Handoff form submits with updateType QUICK_HANDOFF and treatmentModalities", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "u1", pointsEarned: 2 }),
    });

    render(<AddUpdateForm episodeId="ep1" onCreated={mockOnCreated} />);
    fireEvent.click(screen.getByText("+ Add Update"));
    fireEvent.click(screen.getByTestId("chooser-quick"));

    fireEvent.change(screen.getByLabelText("Pain Region"), { target: { value: "Neck" } });
    fireEvent.change(screen.getByLabelText("Diagnosis"), { target: { value: "Strain" } });
    fireEvent.change(screen.getByLabelText("Treatment Modalities"), { target: { value: "Ice therapy" } });

    fireEvent.click(screen.getByText("Save Update"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.updateType).toBe("QUICK_HANDOFF");
    expect(callBody.episodeId).toBe("ep1");
    expect(callBody.treatmentModalities).toBe("Ice therapy");
  });

  test("Cancel from chooser returns to closed state", () => {
    render(<AddUpdateForm episodeId="ep1" onCreated={mockOnCreated} />);
    fireEvent.click(screen.getByText("+ Add Update"));

    expect(screen.getByText("Choose Update Type")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.getByText("+ Add Update")).toBeInTheDocument();
    expect(screen.queryByText("Choose Update Type")).not.toBeInTheDocument();
  });

  test("Cancel from form returns to closed state", () => {
    render(<AddUpdateForm episodeId="ep1" onCreated={mockOnCreated} />);
    fireEvent.click(screen.getByText("+ Add Update"));
    fireEvent.click(screen.getByTestId("chooser-structured"));

    expect(screen.getByText("Structured Continuity Update")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.getByText("+ Add Update")).toBeInTheDocument();
  });
});
