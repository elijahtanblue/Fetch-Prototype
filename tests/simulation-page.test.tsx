/**
 * Frontend interaction tests for SimulationPanel component.
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SimulationPanel from "@/components/SimulationPanel";

const mockClinics = [
  { id: "c1", name: "City Physio", optedIn: true },
  { id: "c2", name: "Harbour Health", optedIn: false },
];

const mockPatients = [
  { id: "p1", firstName: "John", lastName: "Smith" },
  { id: "p2", firstName: "Winston", lastName: "Liang" },
];

describe("SimulationPanel", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock) = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("renders clinic and patient dropdowns with options", () => {
    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);

    expect(screen.getByTestId("clinic-selector")).toBeInTheDocument();
    expect(screen.getByTestId("patient-selector")).toBeInTheDocument();
    expect(screen.getAllByText("City Physio").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Harbour Health").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("John Smith").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Winston Liang").length).toBeGreaterThanOrEqual(1);
  });

  test("renders action buttons", () => {
    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);

    expect(screen.getByTestId("toggle-btn")).toHaveTextContent("Toggle Opt-In");
    expect(screen.getByTestId("visit-btn")).toHaveTextContent("Simulate Visit");
    expect(screen.getByTestId("update-btn")).toHaveTextContent("Add Clinical Update");
    expect(screen.getByTestId("check-access-btn")).toHaveTextContent("Check Access");
    expect(screen.getByTestId("replay-btn")).toHaveTextContent("Replay All Events");
  });

  test("clicking Toggle Opt-In calls simulation toggle API", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ action: "TOGGLE_OPT_IN", success: true, data: { name: "City Physio", optedIn: true } }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [] }); // fetchEvents

    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);

    fireEvent.click(screen.getByTestId("toggle-btn"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/simulation/toggle", expect.objectContaining({
        method: "POST",
      }));
    });
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

  test("clicking Simulate Visit calls visit API", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ action: "VISIT", success: true, data: { episodeId: "ep1" } }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [] }); // fetchEvents

    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);

    fireEvent.click(screen.getByTestId("visit-btn"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/simulation/visit", expect.objectContaining({
        method: "POST",
      }));
    });
  });

  test("replay button calls replay API and displays timeline", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        { action: "TOGGLE_OPT_IN", success: true, data: { clinicId: "c1" }, accessDecision: { allowed: false, reasonCode: "INACTIVE_CONTRIBUTOR" } },
        { action: "VISIT", success: true, data: { clinicId: "c1" }, accessDecision: { allowed: false, reasonCode: "NO_SNAPSHOT" } },
      ]),
    });

    render(<SimulationPanel clinics={mockClinics} patients={mockPatients} />);

    fireEvent.click(screen.getByTestId("replay-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("replay-timeline")).toBeInTheDocument();
      expect(screen.getByText("TOGGLE_OPT_IN")).toBeInTheDocument();
    });
  });
});
