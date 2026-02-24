/**
 * Frontend tests for SimulationPanel (Check Access console).
 *
 * Verifies:
 * - Simulate Actions section is ABSENT
 * - Check Access + Replay functionality works
 * - Timestamps render in DD/MM/YYYY, HH:MM format
 * - Event log displays correctly
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SimulationPanel, { formatTimestamp } from "@/components/SimulationPanel";

const mockClinics = [
  { id: "c1", name: "City Physio", optedIn: true },
  { id: "c2", name: "Harbour Health", optedIn: false },
];

const mockPatients = [
  { id: "p1", firstName: "John", lastName: "Smith" },
  { id: "p2", firstName: "Winston", lastName: "Liang" },
];

describe("SimulationPanel — Check Access Console", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock) = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---- Simulate Actions section is ABSENT ----
  test("does NOT render Simulate Actions heading", () => {
    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);
    expect(screen.queryByText("Simulate Actions")).not.toBeInTheDocument();
  });

  test("does NOT render Toggle Opt-In button", () => {
    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);
    expect(screen.queryByTestId("toggle-btn")).not.toBeInTheDocument();
  });

  test("does NOT render Simulate Visit button", () => {
    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);
    expect(screen.queryByTestId("visit-btn")).not.toBeInTheDocument();
  });

  test("does NOT render Add Clinical Update button", () => {
    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);
    expect(screen.queryByTestId("update-btn")).not.toBeInTheDocument();
  });

  test("does NOT render clinic-selector or patient-selector (simulate section)", () => {
    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);
    expect(screen.queryByTestId("clinic-selector")).not.toBeInTheDocument();
    expect(screen.queryByTestId("patient-selector")).not.toBeInTheDocument();
  });

  // ---- Check Access section present ----
  test("renders Check Access Decision section with selectors", () => {
    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);

    expect(screen.getByText("Check Access Decision")).toBeInTheDocument();
    expect(screen.getByTestId("access-clinic-selector")).toBeInTheDocument();
    expect(screen.getByTestId("access-patient-selector")).toBeInTheDocument();
    expect(screen.getByTestId("check-access-btn")).toHaveTextContent("Check Access");
    expect(screen.getByTestId("replay-btn")).toHaveTextContent("Replay All Events");
  });

  test("clicking Check Access displays access result", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);
    fireEvent.click(screen.getByTestId("check-access-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("access-result")).toBeInTheDocument();
      expect(screen.getByText("Allowed")).toBeInTheDocument();
    });
  });

  test("displays denied access with reason code", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        allowed: false,
        reasonCode: "OPTED_OUT",
        explanation: "Clinic not opted in",
      }),
    });

    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);
    fireEvent.click(screen.getByTestId("check-access-btn"));

    await waitFor(() => {
      expect(screen.getByText("Denied")).toBeInTheDocument();
      expect(screen.getByText("OPTED_OUT")).toBeInTheDocument();
      expect(screen.getByText("Clinic not opted in")).toBeInTheDocument();
    });
  });

  // ---- Replay ----
  test("replay button calls replay API and displays timeline", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          action: "TOGGLE_OPT_IN",
          success: true,
          data: { clinicId: "c1" },
          accessDecision: { allowed: false, reasonCode: "INACTIVE_CONTRIBUTOR" },
          timestamp: "2026-02-24T10:30:00.000Z",
        },
        {
          action: "VISIT",
          success: true,
          data: { clinicId: "c1" },
          accessDecision: { allowed: false, reasonCode: "NO_SNAPSHOT" },
          timestamp: "2026-02-24T11:45:00.000Z",
        },
      ]),
    });

    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);
    fireEvent.click(screen.getByTestId("replay-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("replay-timeline")).toBeInTheDocument();
      expect(screen.getByText("TOGGLE_OPT_IN")).toBeInTheDocument();
    });
  });

  test("replay timestamps render in DD/MM/YYYY, HH:MM format", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          action: "TOGGLE_OPT_IN",
          success: true,
          data: { clinicId: "c1" },
          timestamp: "2026-02-24T10:30:00.000Z",
        },
      ]),
    });

    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);
    fireEvent.click(screen.getByTestId("replay-btn"));

    await waitFor(() => {
      const ts = screen.getByTestId("replay-timestamp-0");
      expect(ts.textContent).toMatch(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/);
    });
  });

  // ---- Event Log ----
  test("renders event log with DD/MM/YYYY, HH:MM timestamps", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          id: "ev1",
          type: "TOGGLE_OPT_IN",
          clinicId: "c1",
          userId: "u1",
          metadata: "{}",
          createdAt: "2026-02-24T14:30:00.000Z",
          clinic: { name: "City Physio" },
          user: { name: "Ed Sun" },
        },
      ]),
    });

    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);
    fireEvent.click(screen.getByTestId("refresh-events-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("event-log")).toBeInTheDocument();
      const timestamp = screen.getByTestId("event-timestamp-ev1");
      expect(timestamp.textContent).toMatch(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/);
    });
  });

  test("empty event log shows placeholder text", () => {
    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);
    expect(screen.getByText("No events recorded yet.")).toBeInTheDocument();
  });
});

// ---- Scroll containers ----
describe("SimulationPanel — Scroll Containers", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock) = jest.fn();
  });

  test("event log container has scroll classes", async () => {
    const manyEvents = Array.from({ length: 10 }, (_, i) => ({
      id: `ev${i}`,
      type: "CLINICAL_UPDATE",
      clinicId: "c1",
      userId: "u1",
      metadata: "{}",
      createdAt: `2026-02-24T${String(i + 8).padStart(2, "0")}:00:00.000Z`,
      clinic: { name: "City Physio" },
      user: { name: "Ed Sun" },
    }));

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => manyEvents,
    });

    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);
    fireEvent.click(screen.getByTestId("refresh-events-btn"));

    await waitFor(() => {
      const log = screen.getByTestId("event-log");
      expect(log.className).toContain("overflow-y-auto");
      expect(log.className).toContain("max-h-");
    });
  });

  test("all 10 event log items render (reachable via scroll)", async () => {
    const manyEvents = Array.from({ length: 10 }, (_, i) => ({
      id: `ev${i}`,
      type: i % 2 === 0 ? "TOGGLE_OPT_IN" : "CLINICAL_UPDATE",
      clinicId: "c1",
      userId: "u1",
      metadata: "{}",
      createdAt: `2026-02-24T${String(i + 8).padStart(2, "0")}:00:00.000Z`,
      clinic: { name: "City Physio" },
      user: { name: "Ed Sun" },
    }));

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => manyEvents,
    });

    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);
    fireEvent.click(screen.getByTestId("refresh-events-btn"));

    await waitFor(() => {
      for (let i = 0; i < 10; i++) {
        expect(screen.getByTestId(`event-timestamp-ev${i}`)).toBeInTheDocument();
      }
    });
  });

  test("event log timestamps and badges render with >6 items", async () => {
    const manyEvents = Array.from({ length: 8 }, (_, i) => ({
      id: `ev${i}`,
      type: "TOGGLE_OPT_IN",
      clinicId: "c1",
      userId: "u1",
      metadata: "{}",
      createdAt: `2026-02-24T${String(i + 8).padStart(2, "0")}:30:00.000Z`,
      clinic: { name: "City Physio" },
      user: { name: "Ed Sun" },
    }));

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => manyEvents,
    });

    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);
    fireEvent.click(screen.getByTestId("refresh-events-btn"));

    await waitFor(() => {
      // All timestamps still render
      const ts = screen.getByTestId("event-timestamp-ev7");
      expect(ts.textContent).toMatch(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/);
      // All type badges render
      const badges = screen.getAllByText("TOGGLE_OPT_IN");
      expect(badges.length).toBe(8);
    });
  });

  test("replay timeline container has scroll classes", async () => {
    const manyReplays = Array.from({ length: 10 }, (_, i) => ({
      action: "CLINICAL_UPDATE",
      success: true,
      data: { clinicId: "c1" },
      accessDecision: { allowed: true },
      timestamp: `2026-02-24T${String(i + 8).padStart(2, "0")}:00:00.000Z`,
    }));

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => manyReplays,
    });

    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);
    fireEvent.click(screen.getByTestId("replay-btn"));

    await waitFor(() => {
      const timeline = screen.getByTestId("replay-timeline");
      expect(timeline.className).toContain("overflow-y-auto");
      expect(timeline.className).toContain("max-h-");
    });
  });

  test("all 10 replay items render with timestamps and badges", async () => {
    const manyReplays = Array.from({ length: 10 }, (_, i) => ({
      action: i % 2 === 0 ? "TOGGLE_OPT_IN" : "VISIT",
      success: true,
      data: { clinicId: "c1" },
      accessDecision: { allowed: i < 5, reasonCode: i >= 5 ? "OPTED_OUT" : undefined },
      timestamp: `2026-02-24T${String(i + 8).padStart(2, "0")}:15:00.000Z`,
    }));

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => manyReplays,
    });

    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);
    fireEvent.click(screen.getByTestId("replay-btn"));

    await waitFor(() => {
      // All 10 timestamps render
      for (let i = 0; i < 10; i++) {
        expect(screen.getByTestId(`replay-timestamp-${i}`)).toBeInTheDocument();
      }
      // Status badges render
      expect(screen.getAllByText("Access: Allowed").length).toBe(5);
      expect(screen.getAllByText(/Access: Denied/).length).toBe(5);
    });
  });
});

// ---- formatTimestamp unit tests ----
describe("formatTimestamp", () => {
  test("formats Date to DD/MM/YYYY, HH:MM", () => {
    const d = new Date(2026, 1, 24, 14, 5); // Feb 24, 2026, 14:05 local
    expect(formatTimestamp(d)).toBe("24/02/2026, 14:05");
  });

  test("pads single-digit day and month", () => {
    const d = new Date(2026, 0, 3, 9, 7); // Jan 3, 2026, 09:07 local
    expect(formatTimestamp(d)).toBe("03/01/2026, 09:07");
  });

  test("formats midnight correctly", () => {
    const d = new Date(2026, 11, 25, 0, 0); // Dec 25, 2026, 00:00 local
    expect(formatTimestamp(d)).toBe("25/12/2026, 00:00");
  });
});
