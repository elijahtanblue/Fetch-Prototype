/**
 * API tests for DELETE /api/episodes/[id]
 *
 * Verifies:
 * - Auth required (401)
 * - Clinician can delete own-clinic episode (200)
 * - Clinician cannot delete another clinic's episode (403)
 * - Admin can delete any episode (200)
 * - Episode not found (404)
 * - Cascade deletes clinical updates
 */

import "./helpers/polyfills";

const mockEpisodeFindUnique = jest.fn();
const mockEpisodeDelete = jest.fn();
const mockUpdateDeleteMany = jest.fn();

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    episode: {
      findUnique: mockEpisodeFindUnique,
      delete: mockEpisodeDelete,
    },
    clinicalUpdate: {
      deleteMany: mockUpdateDeleteMany,
    },
  })),
}));

const mockAuth = jest.fn();
jest.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

describe("DELETE /api/episodes/[id]", () => {
  let DELETE: (
    req: Request,
    ctx: { params: Promise<{ id: string }> }
  ) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/episodes/[id]/route");
    DELETE = mod.DELETE as unknown as typeof DELETE;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    });
  });

  const ctx = { params: Promise.resolve({ id: "ep1" }) };
  const req = new Request("http://localhost") as unknown as Request;

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce({ user: null });
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 404 when episode not found", async () => {
    mockEpisodeFindUnique.mockResolvedValueOnce(null);
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 403 when clinician deletes another clinic's episode", async () => {
    mockEpisodeFindUnique.mockResolvedValueOnce({
      id: "ep1",
      clinicId: "c2",
      _count: { clinicalUpdates: 0 },
    });
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(403);
  });

  it("allows clinician to delete own-clinic episode", async () => {
    mockEpisodeFindUnique.mockResolvedValueOnce({
      id: "ep1",
      clinicId: "c1",
      _count: { clinicalUpdates: 2 },
    });
    mockUpdateDeleteMany.mockResolvedValueOnce({ count: 2 });
    mockEpisodeDelete.mockResolvedValueOnce({});

    const res = await DELETE(req, ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateDeleteMany).toHaveBeenCalledWith({
      where: { episodeId: "ep1" },
    });
    expect(mockEpisodeDelete).toHaveBeenCalledWith({
      where: { id: "ep1" },
    });
  });

  it("allows admin to delete any clinic's episode", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "u1", role: "admin", clinicId: "c1" },
    });
    mockEpisodeFindUnique.mockResolvedValueOnce({
      id: "ep1",
      clinicId: "c2",
      _count: { clinicalUpdates: 0 },
    });
    mockUpdateDeleteMany.mockResolvedValueOnce({ count: 0 });
    mockEpisodeDelete.mockResolvedValueOnce({});

    const res = await DELETE(req, ctx);
    expect(res.status).toBe(200);
  });

  it("cascade-deletes clinical updates before episode", async () => {
    mockEpisodeFindUnique.mockResolvedValueOnce({
      id: "ep1",
      clinicId: "c1",
      _count: { clinicalUpdates: 3 },
    });
    mockUpdateDeleteMany.mockResolvedValueOnce({ count: 3 });
    mockEpisodeDelete.mockResolvedValueOnce({});

    await DELETE(req, ctx);

    // deleteMany called before episode delete
    const deleteManyOrder = mockUpdateDeleteMany.mock.invocationCallOrder[0];
    const deleteOrder = mockEpisodeDelete.mock.invocationCallOrder[0];
    expect(deleteManyOrder).toBeLessThan(deleteOrder);
  });
});
