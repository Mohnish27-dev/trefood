import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateCampus: vi.fn(),
  updateRestaurants: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/server/db/collections", () => ({
  campuses: async () => ({ findOneAndUpdate: mocks.updateCampus }),
  restaurants: async () => ({ updateMany: mocks.updateRestaurants }),
}));
vi.mock("@/server/services/audit", () => ({ writeAudit: mocks.audit }));

import { deleteZone } from "@/server/services/admin";

describe("admin gate deletion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes the last gate without requiring a replacement fallback", async () => {
    mocks.updateCampus.mockResolvedValue({ _id: "campus", zones: [] });
    const result = await deleteZone({ campusId: "campus", zoneId: "fallback", actorId: "admin" });
    expect(result?.zones).toEqual([]);
    expect(mocks.updateCampus).toHaveBeenCalledWith(
      { _id: "campus", "zones.id": "fallback" },
      { $pull: { zones: { id: "fallback" } }, $set: { updatedAt: expect.any(Date) } },
      { returnDocument: "after" },
    );
    expect(mocks.updateRestaurants).toHaveBeenCalledWith(
      { campusId: "campus", servedZoneIds: "fallback" },
      { $pull: { servedZoneIds: "fallback" }, $set: { updatedAt: expect.any(Date) } },
    );
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "admin", entityId: "campus", to: "zone:deleted",
    }));
  });

  it("does not change vendor coverage or audit a missing gate", async () => {
    mocks.updateCampus.mockResolvedValue(null);
    expect(await deleteZone({ campusId: "other-campus", zoneId: "gate", actorId: "admin" })).toBeNull();
    expect(mocks.updateRestaurants).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
