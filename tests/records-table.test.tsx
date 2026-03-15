/**
 * RecordsTable filter behavior tests
 *
 * Verifies that the three client-side filters (customer name, pet name,
 * vet clinic) correctly narrow the rendered rows, compose together, and
 * show the empty state when nothing matches.
 */
import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import RecordsTable from "@/components/RecordsTable";

const mockClinics = [
  { id: "c1", name: "City Vet Clinic" },
  { id: "c2", name: "Harbour Vet" },
];

const mockPatients = [
  {
    id: "p1",
    firstName: "John",
    lastName: "Smith",
    dateOfBirth: "1985-03-15T00:00:00.000Z",
    address: null,
    insuranceCommencementDate: null,
    petName: "Buddy",
    petBreed: "Golden Retriever",
    petType: "DOG",
    petGender: "Male",
    petDesexed: true,
    petDateOfBirth: "2020-06-01T00:00:00.000Z",
    episodes: [
      {
        startDate: "2026-01-15T00:00:00.000Z",
        reason: "Annual checkup",
        clinic: { name: "City Vet Clinic" },
        clinicalUpdates: [
          {
            diagnosis: "Healthy",
            painRegion: "None",
            treatmentModalities: "Vaccination",
            redFlags: false,
            dateOfVisit: "2026-01-15T00:00:00.000Z",
          },
        ],
      },
    ],
  },
  {
    id: "p2",
    firstName: "Winston",
    lastName: "Liang",
    dateOfBirth: "1990-07-20T00:00:00.000Z",
    address: null,
    insuranceCommencementDate: null,
    petName: "Mochi",
    petBreed: "British Shorthair",
    petType: "CAT",
    petGender: "Female",
    petDesexed: true,
    petDateOfBirth: "2021-03-15T00:00:00.000Z",
    episodes: [
      {
        startDate: "2026-02-10T00:00:00.000Z",
        reason: "Dental cleaning",
        clinic: { name: "Harbour Vet" },
        clinicalUpdates: [
          {
            diagnosis: "Dental disease",
            painRegion: "Mouth",
            treatmentModalities: "Cleaning",
            redFlags: false,
            dateOfVisit: "2026-02-10T00:00:00.000Z",
          },
        ],
      },
    ],
  },
];

describe("RecordsTable", () => {
  it("renders all patients with no filters applied", () => {
    render(<RecordsTable patients={mockPatients} clinics={mockClinics} />);
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("Winston Liang")).toBeInTheDocument();
  });

  it("filters by customer name (case-insensitive)", () => {
    render(<RecordsTable patients={mockPatients} clinics={mockClinics} />);
    fireEvent.change(screen.getByTestId("customer-filter"), {
      target: { value: "john" },
    });
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.queryByText("Winston Liang")).not.toBeInTheDocument();
  });

  it("filters by pet name (case-insensitive)", () => {
    render(<RecordsTable patients={mockPatients} clinics={mockClinics} />);
    fireEvent.change(screen.getByTestId("pet-filter"), {
      target: { value: "mochi" },
    });
    expect(screen.getByText("Winston Liang")).toBeInTheDocument();
    expect(screen.queryByText("John Smith")).not.toBeInTheDocument();
  });

  it("filters by vet clinic dropdown", () => {
    render(<RecordsTable patients={mockPatients} clinics={mockClinics} />);
    fireEvent.change(screen.getByTestId("clinic-filter"), {
      target: { value: "Harbour Vet" },
    });
    expect(screen.getByText("Winston Liang")).toBeInTheDocument();
    expect(screen.queryByText("John Smith")).not.toBeInTheDocument();
  });

  it("shows empty state when no records match filters", () => {
    render(<RecordsTable patients={mockPatients} clinics={mockClinics} />);
    fireEvent.change(screen.getByTestId("customer-filter"), {
      target: { value: "zzznomatch" },
    });
    expect(
      screen.getByText("No records match your filters.")
    ).toBeInTheDocument();
  });

  it("shows diagnosis from most recent clinical update", () => {
    render(<RecordsTable patients={mockPatients} clinics={mockClinics} />);
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Dental disease")).toBeInTheDocument();
  });

  it("all three filters compose — only shows rows satisfying all active filters", () => {
    render(<RecordsTable patients={mockPatients} clinics={mockClinics} />);
    fireEvent.change(screen.getByTestId("customer-filter"), {
      target: { value: "john" },
    });
    fireEvent.change(screen.getByTestId("clinic-filter"), {
      target: { value: "Harbour Vet" },
    });
    // John is at City Vet Clinic, not Harbour Vet — so no rows match
    expect(
      screen.getByText("No records match your filters.")
    ).toBeInTheDocument();
  });
});
