import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  insertOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  deleteOne: vi.fn(),
  countRestaurants: vi.fn(),
  countOrders: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/server/db/collections", () => ({
  campuses: async () => ({
    findOne: mocks.findOne,
    insertOne: mocks.insertOne,
    findOneAndUpdate: mocks.findOneAndUpdate,
    deleteOne: mocks.deleteOne,
  }),
  restaurants: async () => ({
    countDocuments: mocks.countRestaurants,
  }),
  orders: async () => ({
    countDocuments: mocks.countOrders,
  }),
}));

vi.mock("@/server/services/audit", () => ({ writeAudit: mocks.audit }));

import {
  createCampus,
  updateCampusDetails,
  deleteCampus,
  setCampusActive,
} from "@/server/services/admin";

describe("admin campus management", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("createCampus", () => {
    it("creates a new campus with initial 24x7 fallback gate and audits", async () => {
      mocks.findOne.mockResolvedValue(null);
      mocks.insertOne.mockResolvedValue({ acknowledged: true });

      const res = await createCampus({
        name: "IIT Patna",
        city: "Bihta",
        slug: "iit-patna",
        center: { lat: 25.5357, lng: 84.8512 },
        initialZone: {
          name: "Main Gate",
          instructions: "Security post at entrance",
        },
        actorId: "admin_1",
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.campus.name).toBe("IIT Patna");
        expect(res.campus.slug).toBe("iit-patna");
        expect(res.campus.city).toBe("Bihta");
        expect(res.campus.zones).toHaveLength(1);
        expect(res.campus.zones[0]?.isFallback).toBe(true);
        expect(res.campus.zones[0]?.curfewMinutes).toBeNull();
      }

      expect(mocks.insertOne).toHaveBeenCalled();
      expect(mocks.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: "CAMPUS",
          to: "campus:created",
          actorId: "admin_1",
        }),
      );
    });

    it("rejects duplicate slug", async () => {
      mocks.findOne.mockResolvedValueOnce({ _id: "campus_nitp", slug: "nit-patna" });

      const res = await createCampus({
        name: "NIT Patna Two",
        city: "Patna",
        slug: "nit-patna",
        center: { lat: 25.6206, lng: 85.1721 },
        actorId: "admin_1",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toContain("already exists");
      }
      expect(mocks.insertOne).not.toHaveBeenCalled();
    });
  });

  describe("updateCampusDetails", () => {
    it("updates campus name, city and coordinates", async () => {
      mocks.findOne.mockResolvedValueOnce({
        _id: "campus_1",
        name: "Old Name",
        city: "Old City",
      });
      mocks.findOneAndUpdate.mockResolvedValueOnce({
        _id: "campus_1",
        name: "New Name",
        city: "New City",
      });

      const res = await updateCampusDetails({
        campusId: "campus_1",
        name: "New Name",
        city: "New City",
        timezone: "Asia/Kolkata",
        center: { lat: 26.0, lng: 85.0 },
        actorId: "admin_1",
      });

      expect(res.ok).toBe(true);
      expect(mocks.findOneAndUpdate).toHaveBeenCalled();
      expect(mocks.audit).toHaveBeenCalled();
    });
  });

  describe("deleteCampus", () => {
    it("refuses to delete a campus if restaurants are attached", async () => {
      mocks.findOne.mockResolvedValueOnce({ _id: "campus_1", name: "IIT Patna" });
      mocks.countRestaurants.mockResolvedValueOnce(3);

      const res = await deleteCampus({ campusId: "campus_1", actorId: "admin_1" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toContain("3 restaurant(s) attached");
      }
      expect(mocks.deleteOne).not.toHaveBeenCalled();
    });

    it("deletes an empty campus cleanly", async () => {
      mocks.findOne.mockResolvedValueOnce({ _id: "campus_1", name: "Empty Campus" });
      mocks.countRestaurants.mockResolvedValueOnce(0);
      mocks.countOrders.mockResolvedValueOnce(0);

      const res = await deleteCampus({ campusId: "campus_1", actorId: "admin_1" });
      expect(res.ok).toBe(true);
      expect(mocks.deleteOne).toHaveBeenCalledWith({ _id: "campus_1" });
      expect(mocks.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "campus:deleted",
        }),
      );
    });
  });

  describe("setCampusActive", () => {
    it("toggles active state and audits", async () => {
      mocks.findOneAndUpdate.mockResolvedValueOnce({
        _id: "campus_1",
        name: "Campus",
        isActive: false,
      });

      const res = await setCampusActive({
        campusId: "campus_1",
        isActive: false,
        actorId: "admin_1",
      });

      expect(res?.isActive).toBe(false);
      expect(mocks.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "campus:active",
          to: "campus:inactive",
        }),
      );
    });
  });
});

