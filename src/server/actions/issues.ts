"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/server/auth/session";
import {
  assignIssueTeammate,
  reopenIssueDeskItem,
  resolveIssueDeskItem,
} from "@/server/services/issues";

export type IssueActionState =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

const assignTeammateSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  teammateName: z.string().trim().nullable(),
});

export async function assignTeammateAction(input: unknown): Promise<IssueActionState> {
  const parsed = assignTeammateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid teammate assignment.",
    };
  }

  const { user } = await requireAdmin();
  const result = await assignIssueTeammate({
    orderId: parsed.data.orderId,
    teammateName: parsed.data.teammateName,
    actorId: user._id,
  });

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath("/admin/issues");
  return {
    status: "ok",
    message: parsed.data.teammateName
      ? `Assigned to ${parsed.data.teammateName}`
      : "Teammate assignment cleared",
  };
}

const resolveIssueSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  resolutionNote: z.string().trim().optional(),
});

export async function resolveIssueAction(input: unknown): Promise<IssueActionState> {
  const parsed = resolveIssueSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid resolution input.",
    };
  }

  const { user } = await requireAdmin();
  const result = await resolveIssueDeskItem({
    orderId: parsed.data.orderId,
    resolutionNote: parsed.data.resolutionNote,
    actorId: user._id,
  });

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath("/admin/issues");
  return { status: "ok", message: "Issue marked as resolved" };
}

const reopenIssueSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
});

export async function reopenIssueAction(input: unknown): Promise<IssueActionState> {
  const parsed = reopenIssueSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Invalid request." };
  }

  const { user } = await requireAdmin();
  const result = await reopenIssueDeskItem({
    orderId: parsed.data.orderId,
    actorId: user._id,
  });

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath("/admin/issues");
  return { status: "ok", message: "Issue reopened" };
}
