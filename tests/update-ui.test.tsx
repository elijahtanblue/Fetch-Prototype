/**
 * UI Tests for update lifecycle:
 * - Red flag emoji rendering
 * - dateOfVisit display
 * - Edit/delete controls
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

const mockFetch = jest.fn();
global.fetch = mockFetch;

import EpisodesSection from "@/components/EpisodesSection";

const baseEpisode = {
  id: "ep1",
  patientId: "p1",
  reason: "Back pain",
  startDate: "2026-02-15T00:00:00.000Z",
  createdAt: "2026-02-15T00:00:00.000Z",
  patient: { firstName: "John", lastName: "Smith" },
};

const baseUpdate = {
  id: "cu1",
  painRegion: "Lower back",
  diagnosis: "Disc herniation",
  treatmentModalities: "Manual therapy",
  redFlags: false,
  notes: "Improving",
  updateType: "STRUCTURED",
  createdAt: "2026-02-20T00:00:00.000Z",
};

describe("Red flag emoji", () => {
  it("renders red flag emoji with warning text", () => {
    render(
      <EpisodesSection
        initialEpisodes={[{
          ...baseEpisode,
          clinicalUpdates: [{ ...baseUpdate, redFlags: true }],
        }]}
        patients={[]}
      />
    );

    const badge = screen.getByTestId("red-flag-cu1");
    expect(badge).toHaveTextContent("\u{1F6A9}");
    expect(badge).toHaveTextContent("Red Flag");
  });

  it("does not show red flag badge when redFlags is false", () => {
    render(
      <EpisodesSection
        initialEpisodes={[{
          ...baseEpisode,
          clinicalUpdates: [{ ...baseUpdate, redFlags: false }],
        }]}
        patients={[]}
      />
    );

    expect(screen.queryByTestId("red-flag-cu1")).not.toBeInTheDocument();
  });
});

describe("dateOfVisit display", () => {
  it("renders date of visit when provided", () => {
    render(
      <EpisodesSection
        initialEpisodes={[{
          ...baseEpisode,
          clinicalUpdates: [{
            ...baseUpdate,
            dateOfVisit: "2026-02-20T00:00:00.000Z",
          }],
        }]}
        patients={[]}
      />
    );

    const visitDate = screen.getByTestId("visit-date-cu1");
    expect(visitDate).toBeInTheDocument();
    expect(visitDate.textContent).toContain("Visit:");
  });

  it("does not render visit date when null", () => {
    render(
      <EpisodesSection
        initialEpisodes={[{
          ...baseEpisode,
          clinicalUpdates: [{ ...baseUpdate, dateOfVisit: null }],
        }]}
        patients={[]}
      />
    );

    expect(screen.queryByTestId("visit-date-cu1")).not.toBeInTheDocument();
  });
});

describe("Edit/delete controls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders Edit and Delete buttons for each update", () => {
    render(
      <EpisodesSection
        initialEpisodes={[{
          ...baseEpisode,
          clinicalUpdates: [baseUpdate],
        }]}
        patients={[]}
      />
    );

    expect(screen.getByTestId("edit-update-cu1")).toHaveTextContent("Edit");
    expect(screen.getByTestId("delete-update-cu1")).toHaveTextContent("Delete");
  });

  it("shows inline edit form when Edit is clicked", () => {
    render(
      <EpisodesSection
        initialEpisodes={[{
          ...baseEpisode,
          clinicalUpdates: [baseUpdate],
        }]}
        patients={[]}
      />
    );

    fireEvent.click(screen.getByTestId("edit-update-cu1"));
    expect(screen.getByTestId("edit-form-cu1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lower back")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Disc herniation")).toBeInTheDocument();
  });

  it("calls PATCH API on edit save", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "cu1" }),
    });
    // Mock refreshEpisodes
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(
      <EpisodesSection
        initialEpisodes={[{
          ...baseEpisode,
          clinicalUpdates: [baseUpdate],
        }]}
        patients={[]}
      />
    );

    fireEvent.click(screen.getByTestId("edit-update-cu1"));
    fireEvent.change(screen.getByDisplayValue("Lower back"), {
      target: { value: "Upper back" },
    });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/updates/cu1",
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  it("shows delete confirmation on Delete click", () => {
    render(
      <EpisodesSection
        initialEpisodes={[{
          ...baseEpisode,
          clinicalUpdates: [baseUpdate],
        }]}
        patients={[]}
      />
    );

    fireEvent.click(screen.getByTestId("delete-update-cu1"));
    expect(screen.getByText("Delete?")).toBeInTheDocument();
    expect(screen.getByTestId("confirm-delete-update-cu1")).toBeInTheDocument();
  });

  it("calls DELETE API on confirm", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(
      <EpisodesSection
        initialEpisodes={[{
          ...baseEpisode,
          clinicalUpdates: [baseUpdate],
        }]}
        patients={[]}
      />
    );

    fireEvent.click(screen.getByTestId("delete-update-cu1"));
    fireEvent.click(screen.getByTestId("confirm-delete-update-cu1"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/updates/cu1",
        { method: "DELETE" }
      );
    });
  });
});
