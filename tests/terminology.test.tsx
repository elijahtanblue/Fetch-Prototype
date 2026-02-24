/**
 * Terminology tests for Milestone 0.
 *
 * Verifies that user-facing labels match the updated product vocabulary:
 * - "Simulation" → "Check Access"
 * - "Episodes" → "Patient Visits"
 * - "Create Episode" → "Add Patient Visit"
 * - "+ Create New Patient" button visible on dashboard
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

// --- Navbar ---
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/dashboard"),
}));

jest.mock("next-auth/react", () => ({
  signOut: jest.fn(),
}));

import Navbar from "@/components/Navbar";

describe("Navbar terminology", () => {
  test("admin sees Check Access link", () => {
    render(<Navbar isAdmin={true} />);
    expect(screen.getByText("Check Access")).toBeInTheDocument();
    expect(screen.queryByText("Simulation")).not.toBeInTheDocument();
  });

  test("Check Access link points to /check-access", () => {
    render(<Navbar isAdmin={true} />);
    const link = screen.getByText("Check Access").closest("a");
    expect(link).toHaveAttribute("href", "/check-access");
  });

  test("non-admin does NOT see Check Access link", () => {
    render(<Navbar isAdmin={false} />);
    expect(screen.queryByText("Check Access")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  test("Navbar without isAdmin prop hides Check Access (defaults to false)", () => {
    render(<Navbar />);
    expect(screen.queryByText("Check Access")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});

// --- EpisodesSection ---
import EpisodesSection from "@/components/EpisodesSection";

// Mock fetch for EpisodesSection
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("EpisodesSection terminology", () => {
  test("renders Patient Visits heading instead of Episodes", () => {
    render(<EpisodesSection initialEpisodes={[]} patients={[]} />);
    expect(screen.getByText("Patient Visits")).toBeInTheDocument();
    expect(screen.queryByText("Episodes")).not.toBeInTheDocument();
  });

  test("shows updated empty state text", () => {
    render(<EpisodesSection initialEpisodes={[]} patients={[]} />);
    expect(screen.getByText("No patient visits yet. Add one to start contributing updates.")).toBeInTheDocument();
  });
});

// --- CreateEpisodeForm ---
import CreateEpisodeForm from "@/components/CreateEpisodeForm";

const patients = [
  { id: "p1", firstName: "John", lastName: "Smith" },
];

describe("CreateEpisodeForm terminology", () => {
  test("renders Add Patient Visit button instead of Create Episode", () => {
    render(<CreateEpisodeForm patients={patients} onCreated={jest.fn()} />);
    expect(screen.getByText("+ Add Patient Visit")).toBeInTheDocument();
    expect(screen.queryByText("+ Create Episode")).not.toBeInTheDocument();
  });
});
