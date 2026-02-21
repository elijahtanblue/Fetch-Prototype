/**
 * API Behavior Tests for PATCH /api/clinics/[id]
 *
 * Verifies that optInStatus toggles correctly from false→true and true→false,
 * and returns the updated clinic data.
 */

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockEventCreate = jest.fn(async () => ({}));

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    clinic: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    simulationEvent: {
      create: mockEventCreate,
    },
  })),
}));

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(async () => ({
    user: { id: "u3", role: "admin", clinicId: "c3" },
  })),
}));

describe("PATCH /api/clinics/[id] - Toggle Behavior", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
    mockEventCreate.mockClear();
  });

  test("toggles optedIn from false to true", async () => {
    mockFindUnique.mockResolvedValue({
      id: "c1",
      name: "City Physio",
      optedIn: false,
    });
    mockUpdate.mockResolvedValue({
      id: "c1",
      name: "City Physio",
      optedIn: true,
    });

    const { PATCH } = await import("@/app/api/clinics/[id]/route");
    const request = new Request("http://localhost/api/clinics/c1", {
      method: "PATCH",
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "c1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.optedIn).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { optedIn: true },
    });
  });

  test("toggles optedIn from true to false", async () => {
    mockFindUnique.mockResolvedValue({
      id: "c1",
      name: "City Physio",
      optedIn: true,
    });
    mockUpdate.mockResolvedValue({
      id: "c1",
      name: "City Physio",
      optedIn: false,
    });

    const { PATCH } = await import("@/app/api/clinics/[id]/route");
    const request = new Request("http://localhost/api/clinics/c1", {
      method: "PATCH",
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "c1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.optedIn).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { optedIn: false },
    });
  });

  test("returns 404 for non-existent clinic", async () => {
    mockFindUnique.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/clinics/[id]/route");
    const request = new Request("http://localhost/api/clinics/nonexist", {
      method: "PATCH",
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "nonexist" }),
    });
    expect(response.status).toBe(404);
  });

  test("response contains id, name, and optedIn fields", async () => {
    mockFindUnique.mockResolvedValue({
      id: "c1",
      name: "City Physio",
      optedIn: false,
    });
    mockUpdate.mockResolvedValue({
      id: "c1",
      name: "City Physio",
      optedIn: true,
    });

    const { PATCH } = await import("@/app/api/clinics/[id]/route");
    const request = new Request("http://localhost/api/clinics/c1", {
      method: "PATCH",
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "c1" }),
    });
    const data = await response.json();

    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("name");
    expect(data).toHaveProperty("optedIn");
  });
});
