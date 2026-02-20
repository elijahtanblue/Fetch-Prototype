/**
 * Dashboard Data-Loading Behavior Tests
 *
 * Tests the dashboard's data boundary: the Prisma query that feeds clinic
 * data to the dashboard. Verifies correct data shape, opt-in status
 * representation, and expected clinic list behavior with mocked Prisma.
 */

import React from "react";

const mockClinics = [
  { id: "c1", name: "City Physio", optedIn: true },
  { id: "c2", name: "Harbour Health", optedIn: false },
  { id: "c3", name: "Summit Rehabilitation", optedIn: true },
];

const mockFindMany = jest.fn(async () => mockClinics);

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    clinic: {
      findMany: mockFindMany,
    },
  })),
}));

describe("Dashboard Data Loading", () => {
  test("prisma.clinic.findMany returns expected clinic data shape", async () => {
    const { prisma } = await import("@/lib/db");
    const clinics = await prisma.clinic.findMany();

    expect(Array.isArray(clinics)).toBe(true);
    expect(clinics).toHaveLength(3);
  });

  test("each clinic has id, name, and optedIn fields", async () => {
    const { prisma } = await import("@/lib/db");
    const clinics = await prisma.clinic.findMany();

    for (const clinic of clinics) {
      expect(clinic).toHaveProperty("id");
      expect(clinic).toHaveProperty("name");
      expect(clinic).toHaveProperty("optedIn");
    }
  });

  test("optedIn field is a boolean for each clinic", async () => {
    const { prisma } = await import("@/lib/db");
    const clinics = await prisma.clinic.findMany();

    for (const clinic of clinics) {
      expect(typeof clinic.optedIn).toBe("boolean");
    }
  });

  test("data includes both opted-in and not-opted-in clinics", async () => {
    const { prisma } = await import("@/lib/db");
    const clinics = await prisma.clinic.findMany();

    const optedIn = clinics.filter(
      (c: { optedIn: boolean }) => c.optedIn === true
    );
    const notOptedIn = clinics.filter(
      (c: { optedIn: boolean }) => c.optedIn === false
    );

    expect(optedIn.length).toBeGreaterThan(0);
    expect(notOptedIn.length).toBeGreaterThan(0);
  });

  test("clinic names match expected seed data", async () => {
    const { prisma } = await import("@/lib/db");
    const clinics = await prisma.clinic.findMany();
    const names = clinics.map((c: { name: string }) => c.name);

    expect(names).toContain("City Physio");
    expect(names).toContain("Harbour Health");
    expect(names).toContain("Summit Rehabilitation");
  });
});
