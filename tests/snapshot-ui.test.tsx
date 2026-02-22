/**
 * Frontend conditional rendering tests for PatientSnapshot component.
 *
 * Tests that the component correctly renders:
 * - Snapshot data when access is allowed
 * - Denial panel with explanation when access is denied
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PatientSnapshot from "@/components/PatientSnapshot";

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("PatientSnapshot - Conditional Rendering", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("renders View Shared History button initially", () => {
    render(
      <PatientSnapshot patientId="p1" patientName="Winston Liang" />
    );
    expect(screen.getByText("View Shared History")).toBeInTheDocument();
  });

  test("shows denial panel when access is denied (OPTED_OUT)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        accessDecision: "denied",
        reasonCode: "OPTED_OUT",
        explanation: "Your clinic has not opted in.",
      }),
    });

    render(
      <PatientSnapshot patientId="p1" patientName="Winston Liang" />
    );
    fireEvent.click(screen.getByText("View Shared History"));

    await waitFor(() => {
      expect(screen.getByTestId("denial-panel")).toBeInTheDocument();
      expect(screen.getByText("Access Denied")).toBeInTheDocument();
      expect(screen.getByText("(OPTED_OUT)")).toBeInTheDocument();
      expect(
        screen.getByText("Your clinic has not opted in.")
      ).toBeInTheDocument();
    });
  });

  test("shows denial panel when access is denied (INACTIVE_CONTRIBUTOR)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        accessDecision: "denied",
        reasonCode: "INACTIVE_CONTRIBUTOR",
        explanation: "Your clinic has not contributed recently.",
      }),
    });

    render(
      <PatientSnapshot patientId="p1" patientName="Winston Liang" />
    );
    fireEvent.click(screen.getByText("View Shared History"));

    await waitFor(() => {
      expect(screen.getByTestId("denial-panel")).toBeInTheDocument();
      expect(screen.getByText("(INACTIVE_CONTRIBUTOR)")).toBeInTheDocument();
    });
  });

  test("shows denial panel when access is denied (NO_SNAPSHOT)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        accessDecision: "denied",
        reasonCode: "NO_SNAPSHOT",
        explanation: "No shared patient history is available.",
      }),
    });

    render(
      <PatientSnapshot patientId="p1" patientName="Winston Liang" />
    );
    fireEvent.click(screen.getByText("View Shared History"));

    await waitFor(() => {
      expect(screen.getByTestId("denial-panel")).toBeInTheDocument();
      expect(screen.getByText("(NO_SNAPSHOT)")).toBeInTheDocument();
    });
  });

  test("shows snapshot data when access is allowed", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        accessDecision: "allowed",
        snapshot: [
          {
            id: "cu1",
            clinicName: "Harbour Health",
            episodeReason: "Back pain",
            episodeStartDate: "2026-02-15",
            painRegion: "Lower back",
            diagnosis: "Disc herniation",
            treatmentModalities: "Manual therapy",
            redFlags: true,
            notes: "Improving",
            createdAt: "2026-02-20",
          },
        ],
      }),
    });

    render(
      <PatientSnapshot patientId="p1" patientName="Winston Liang" />
    );
    fireEvent.click(screen.getByText("View Shared History"));

    await waitFor(() => {
      expect(screen.getByTestId("snapshot-panel")).toBeInTheDocument();
      expect(screen.getByText("Harbour Health")).toBeInTheDocument();
      expect(screen.getByText("Red Flag")).toBeInTheDocument();
      expect(screen.getByText(/Disc herniation/)).toBeInTheDocument();
    });
  });

  test("shows snapshot panel with patient name context", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        accessDecision: "allowed",
        snapshot: [
          {
            id: "cu1",
            clinicName: "Other Clinic",
            episodeReason: "Shoulder pain",
            episodeStartDate: "2026-01-10",
            painRegion: "Right shoulder",
            diagnosis: "Rotator cuff",
            treatmentModalities: "Exercise",
            redFlags: false,
            notes: "",
            createdAt: "2026-01-15",
          },
        ],
      }),
    });

    render(
      <PatientSnapshot patientId="p1" patientName="Winston Liang" />
    );
    fireEvent.click(screen.getByText("View Shared History"));

    await waitFor(() => {
      expect(
        screen.getByText(/Shared history for Winston Liang/)
      ).toBeInTheDocument();
    });
  });

  test("toggles between show and hide", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        accessDecision: "allowed",
        snapshot: [],
      }),
    });

    render(
      <PatientSnapshot patientId="p1" patientName="Winston Liang" />
    );

    fireEvent.click(screen.getByText("View Shared History"));

    await waitFor(() => {
      expect(screen.getByText("Hide Shared History")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Hide Shared History"));
    expect(screen.getByText("View Shared History")).toBeInTheDocument();
  });
});
