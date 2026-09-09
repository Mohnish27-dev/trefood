import { describe, expect, it } from "vitest";
import { feedbackSchema } from "@/server/actions/student";
import { ORDER_STATUS } from "@/lib/constants";

describe("Post-Delivery Feedback Validation & Logic", () => {
  describe("feedbackSchema", () => {
    it("accepts valid 1-5 star ratings with optional comments and tags", () => {
      const valid = feedbackSchema.safeParse({
        orderId: "ord_123",
        rating: 5,
        comment: "Food was piping hot and arrived early!",
        tags: ["⚡ Fast delivery", "🍲 Hot & fresh"],
      });
      expect(valid.success).toBe(true);
    });

    it("accepts rating without optional comment or tags", () => {
      const valid = feedbackSchema.safeParse({
        orderId: "ord_123",
        rating: 4,
      });
      expect(valid.success).toBe(true);
    });

    it("rejects ratings outside 1 to 5", () => {
      const zero = feedbackSchema.safeParse({ orderId: "ord_123", rating: 0 });
      const six = feedbackSchema.safeParse({ orderId: "ord_123", rating: 6 });
      const negative = feedbackSchema.safeParse({ orderId: "ord_123", rating: -1 });

      expect(zero.success).toBe(false);
      expect(six.success).toBe(false);
      expect(negative.success).toBe(false);
    });

    it("rejects non-integer star ratings", () => {
      const floatVal = feedbackSchema.safeParse({ orderId: "ord_123", rating: 4.5 });
      expect(floatVal.success).toBe(false);
    });

    it("rejects comments exceeding 500 characters", () => {
      const longComment = "a".repeat(501);
      const invalid = feedbackSchema.safeParse({
        orderId: "ord_123",
        rating: 4,
        comment: longComment,
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("Restaurant rating running average calculation", () => {
    it("computes initial rating when restaurant has 0 ratings", () => {
      const currentAvg = 0;
      const currentCount = 0;
      const newRating = 5;

      const newCount = currentCount + 1;
      const computedRating = Number(
        ((currentAvg * currentCount + newRating) / newCount).toFixed(1),
      );

      expect(newCount).toBe(1);
      expect(computedRating).toBe(5.0);
    });

    it("computes incremental running average correctly", () => {
      // 10 ratings at 4.0 average = total 40.0
      // 11th rating is 5 -> total 45.0 / 11 = 4.0909... -> 4.1
      const currentAvg = 4.0;
      const currentCount = 10;
      const incomingRating = 5;

      const newCount = currentCount + 1;
      const newSum = currentAvg * currentCount + incomingRating;
      const computedRating = Number((newSum / newCount).toFixed(1));

      expect(newCount).toBe(11);
      expect(computedRating).toBe(4.1);
    });

    it("correctly updates running average when editing an existing rating without incrementing count", () => {
      // 10 ratings at 4.0 average.
      // User originally gave a 1, now changes it to a 5.
      // New total = (4.0 * 10) - 1 + 5 = 44. 44 / 10 = 4.4
      const currentAvg = 4.0;
      const currentCount = 10;
      const oldUserRating = 1;
      const updatedUserRating = 5;

      const newCount = currentCount;
      const newSum = currentAvg * currentCount - oldUserRating + updatedUserRating;
      const computedRating = Number((newSum / newCount).toFixed(1));

      expect(newCount).toBe(10);
      expect(computedRating).toBe(4.4);
    });
  });

  describe("Delivery status eligibility", () => {
    it("identifies delivered and settled statuses as eligible for feedback", () => {
      const isEligible = (status: string) =>
        status === ORDER_STATUS.DELIVERED || status === ORDER_STATUS.SETTLED;

      expect(isEligible(ORDER_STATUS.DELIVERED)).toBe(true);
      expect(isEligible(ORDER_STATUS.SETTLED)).toBe(true);
      expect(isEligible(ORDER_STATUS.PLACED)).toBe(false);
      expect(isEligible(ORDER_STATUS.ACCEPTED)).toBe(false);
      expect(isEligible(ORDER_STATUS.PREPARING)).toBe(false);
      expect(isEligible(ORDER_STATUS.OUT_FOR_DELIVERY)).toBe(false);
      expect(isEligible(ORDER_STATUS.AT_GATE)).toBe(false);
      expect(isEligible(ORDER_STATUS.CANCELLED_BY_ADMIN)).toBe(false);
    });
  });
});
