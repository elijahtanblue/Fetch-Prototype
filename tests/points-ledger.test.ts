/**
 * Tests for domain/services/points.ts — awardPoints ledger service.
 *
 * Verifies:
 * - AccessEvent row creation with correct fields
 * - clinic.accessPercent update
 * - Clamping to 0-100
 * - Correct reasonCode stored
 */

import { awardPoints, REASON_CODES } from "@/domain/services/points";

const mockClinicFindUnique = jest.fn();
const mockClinicUpdate = jest.fn(async () => ({}));
const mockAccessEventCreate = jest.fn(async () => ({}));

const mockPrisma = {
  clinic: { findUnique: mockClinicFindUnique, update: mockClinicUpdate },
  accessEvent: { create: mockAccessEventCreate },
} as unknown as Parameters<typeof awardPoints>[0];

describe("awardPoints", () => {
  beforeEach(() => {
    mockClinicFindUnique.mockReset();
    mockClinicUpdate.mockReset();
    mockAccessEventCreate.mockReset();
  });

  test("creates AccessEvent with correct fields", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50 });

    await awardPoints(mockPrisma, {
      clinicId: "c1",
      delta: 6,
      reasonCode: REASON_CODES.STRUCTURED_UPDATE,
      patientId: "p1",
      episodeId: "ep1",
      updateId: "cu1",
    });

    expect(mockAccessEventCreate).toHaveBeenCalledWith({
      data: {
        clinicId: "c1",
        delta: 6,
        reasonCode: "STRUCTURED_UPDATE",
        patientId: "p1",
        episodeId: "ep1",
        updateId: "cu1",
      },
    });
  });

  test("updates clinic accessPercent", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50 });

    const result = await awardPoints(mockPrisma, {
      clinicId: "c1",
      delta: 6,
      reasonCode: REASON_CODES.STRUCTURED_UPDATE,
    });

    expect(result.newAccessPercent).toBe(56);
    expect(mockClinicUpdate).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { accessPercent: 56 },
    });
  });

  test("clamps accessPercent at 100", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 97 });

    const result = await awardPoints(mockPrisma, {
      clinicId: "c1",
      delta: 6,
      reasonCode: REASON_CODES.STRUCTURED_UPDATE,
    });

    expect(result.newAccessPercent).toBe(100);
  });

  test("clamps accessPercent at 0 for negative delta", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 3 });

    const result = await awardPoints(mockPrisma, {
      clinicId: "c1",
      delta: -10,
      reasonCode: REASON_CODES.DECAY,
    });

    expect(result.newAccessPercent).toBe(0);
  });

  test("stores OPT_IN_BONUS reason code", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 0 });

    await awardPoints(mockPrisma, {
      clinicId: "c1",
      delta: 100,
      reasonCode: REASON_CODES.OPT_IN_BONUS,
    });

    expect(mockAccessEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ reasonCode: "OPT_IN_BONUS" }),
    });
  });

  test("stores ADMIN_OVERRIDE reason code", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 80 });

    await awardPoints(mockPrisma, {
      clinicId: "c1",
      delta: -11,
      reasonCode: REASON_CODES.ADMIN_OVERRIDE,
    });

    expect(mockAccessEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ reasonCode: "ADMIN_OVERRIDE", delta: -11 }),
    });
  });

  test("handles null optional fields", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50 });

    await awardPoints(mockPrisma, {
      clinicId: "c1",
      delta: 2,
      reasonCode: REASON_CODES.QUICK_HANDOFF,
    });

    expect(mockAccessEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        patientId: null,
        episodeId: null,
        updateId: null,
      }),
    });
  });

  test("handles clinic not found (defaults to 0)", async () => {
    mockClinicFindUnique.mockResolvedValue(null);

    const result = await awardPoints(mockPrisma, {
      clinicId: "c999",
      delta: 6,
      reasonCode: REASON_CODES.STRUCTURED_UPDATE,
    });

    expect(result.newAccessPercent).toBe(6);
  });
});
