/**
 * Frontend form tests for CreateEpisodeForm and AddUpdateForm
 *
 * Tests happy-path submission and client-side validation.
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateEpisodeForm from "@/components/CreateEpisodeForm";
import AddUpdateForm from "@/components/AddUpdateForm";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const patients = [
  { id: "p1", firstName: "John", lastName: "Smith" },
  { id: "p2", firstName: "Jane", lastName: "Doe" },
];

describe("CreateEpisodeForm", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("renders the Add Patient Visit button initially", () => {
    const onCreated = jest.fn();
    render(<CreateEpisodeForm patients={patients} onCreated={onCreated} />);
    expect(screen.getByText("+ Add Patient Visit")).toBeInTheDocument();
  });

  test("shows form fields when button is clicked", () => {
    const onCreated = jest.fn();
    render(<CreateEpisodeForm patients={patients} onCreated={onCreated} />);
    fireEvent.click(screen.getByText("+ Add Patient Visit"));

    expect(screen.getByLabelText("Patient")).toBeInTheDocument();
    expect(screen.getByLabelText("Reason for Visit")).toBeInTheDocument();
    expect(screen.getByLabelText("Start Date")).toBeInTheDocument();
  });

  test("submits form with valid data and calls onCreated", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "ep1", reason: "Back pain", startDate: "2026-02-22" }),
    });

    const onCreated = jest.fn();
    render(<CreateEpisodeForm patients={patients} onCreated={onCreated} />);
    fireEvent.click(screen.getByText("+ Add Patient Visit"));

    fireEvent.change(screen.getByLabelText("Patient"), { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText("Reason for Visit"), {
      target: { value: "Back pain" },
    });

    fireEvent.click(screen.getByText("Add Visit"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/episodes", expect.objectContaining({
        method: "POST",
      }));
    });
  });

  test("shows error message on failed submission", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Patient not found" }),
    });

    const onCreated = jest.fn();
    render(<CreateEpisodeForm patients={patients} onCreated={onCreated} />);
    fireEvent.click(screen.getByText("+ Add Patient Visit"));

    fireEvent.change(screen.getByLabelText("Patient"), { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText("Reason for Visit"), {
      target: { value: "Back pain" },
    });

    fireEvent.click(screen.getByText("Add Visit"));

    await waitFor(() => {
      expect(screen.getByText("Patient not found")).toBeInTheDocument();
    });
  });
});

describe("AddUpdateForm", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("renders the Add Update button initially", () => {
    const onCreated = jest.fn();
    render(<AddUpdateForm episodeId="ep1" onCreated={onCreated} />);
    expect(screen.getByText("+ Add Update")).toBeInTheDocument();
  });

  test("shows workflow chooser when button is clicked", () => {
    const onCreated = jest.fn();
    render(<AddUpdateForm episodeId="ep1" onCreated={onCreated} />);
    fireEvent.click(screen.getByText("+ Add Update"));

    expect(screen.getByText("Choose Update Type")).toBeInTheDocument();
    expect(screen.getByText("Structured Continuity")).toBeInTheDocument();
    expect(screen.getByText("Quick Handoff")).toBeInTheDocument();
  });

  test("shows structured form fields after choosing Structured", () => {
    const onCreated = jest.fn();
    render(<AddUpdateForm episodeId="ep1" onCreated={onCreated} />);
    fireEvent.click(screen.getByText("+ Add Update"));
    fireEvent.click(screen.getByTestId("chooser-structured"));

    expect(screen.getByLabelText("Pain Region")).toBeInTheDocument();
    expect(screen.getByLabelText("Diagnosis")).toBeInTheDocument();
    expect(screen.getByLabelText("Treatment Modalities")).toBeInTheDocument();
    expect(screen.getByLabelText("Red Flags Present")).toBeInTheDocument();
  });

  test("submits structured form with valid data and calls onCreated", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "cu1" }),
    });

    const onCreated = jest.fn();
    render(<AddUpdateForm episodeId="ep1" onCreated={onCreated} />);
    fireEvent.click(screen.getByText("+ Add Update"));
    fireEvent.click(screen.getByTestId("chooser-structured"));

    fireEvent.change(screen.getByLabelText("Pain Region"), {
      target: { value: "Lower back" },
    });
    fireEvent.change(screen.getByLabelText("Diagnosis"), {
      target: { value: "Disc herniation" },
    });
    fireEvent.change(screen.getByLabelText("Treatment Modalities"), {
      target: { value: "Manual therapy" },
    });

    fireEvent.click(screen.getByText("Save Update"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/updates", expect.objectContaining({
        method: "POST",
      }));
      expect(onCreated).toHaveBeenCalled();
    });
  });

  test("shows error on failed submission", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Episode not found" }),
    });

    const onCreated = jest.fn();
    render(<AddUpdateForm episodeId="ep1" onCreated={onCreated} />);
    fireEvent.click(screen.getByText("+ Add Update"));
    fireEvent.click(screen.getByTestId("chooser-structured"));

    fireEvent.change(screen.getByLabelText("Pain Region"), {
      target: { value: "Lower back" },
    });
    fireEvent.change(screen.getByLabelText("Diagnosis"), {
      target: { value: "Disc herniation" },
    });
    fireEvent.change(screen.getByLabelText("Treatment Modalities"), {
      target: { value: "Manual therapy" },
    });

    fireEvent.click(screen.getByText("Save Update"));

    await waitFor(() => {
      expect(screen.getByText("Episode not found")).toBeInTheDocument();
    });
  });
});
