"use client";

import { Loader2, Search, ShieldOff, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/states";
import { clearStudentStrikes, toggleStudentOrdering } from "@/server/actions/admin";

export interface StudentRowView {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  strikes: number;
  ordersBlocked: boolean;
  ordersBlockedReason: string | null;
  orderCount: number;
  noShowCount: number;
  lastOrderAt: string | null;
}

/**
 * Student management.
 *
 * Cash on delivery is the only way to order, so pausing an account is a ban —
 * which is exactly why nothing automatic does it. Strikes accumulate on their
 * own and bring an account to the top of this list; a person reads the history
 * and decides. A student who missed two gates is usually not a fraudster: they
 * had an exam, or fell asleep. Clearing their strikes costs nothing, and it is
 * the first thing to reach for.
 */
export function StudentTable({
  students,
  total,
}: {
  students: StudentRowView[];
  /** Every student in the database, in case fewer were loaded. */
  total: number;
}) {
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const filtered =
    needle.length === 0
      ? students
      : students.filter(
          (student) =>
            student.name.toLowerCase().includes(needle) ||
            student.email.toLowerCase().includes(needle) ||
            (student.phone ?? "").includes(needle),
        );

  const pausedCount = students.filter((student) => student.ordersBlocked).length;
  const withStrikesCount = students.filter((student) => student.strikes > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, email or phone"
            className="pl-9"
            aria-label="Search students"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted" aria-live="polite">
          <span className="rounded-full border border-line bg-surface px-3 py-1">
            {needle.length > 0 ? (
              <>
                <span className="tabular font-semibold text-bone">{filtered.length}</span> of{" "}
                <span className="tabular">{total}</span> students
              </>
            ) : (
              <>
                <span className="tabular font-semibold text-bone">{total}</span>{" "}
                {total === 1 ? "student" : "students"}
              </>
            )}
          </span>
          {withStrikesCount > 0 ? (
            <span className="rounded-full border border-line bg-surface px-3 py-1">
              <span className="tabular font-semibold text-amber">{withStrikesCount}</span> with strikes
            </span>
          ) : null}
          {pausedCount > 0 ? (
            <span className="rounded-full border border-line bg-surface px-3 py-1">
              <span className="tabular font-semibold text-chili">{pausedCount}</span> paused
            </span>
          ) : null}
        </div>
      </div>

      {students.length < total ? (
        <p className="text-xs text-amber">
          Showing the first {students.length} of {total} students — search only covers those.
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={needle.length > 0 ? "Nobody matches that" : "No students yet"}
            description={
              needle.length > 0
                ? "Try a shorter search."
                : "Students appear here after they sign in for the first time."
            }
          />
        </Card>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH className="w-12 text-right">#</TH>
              <TH>Student</TH>
              <TH className="text-right">Orders</TH>
              <TH className="text-right">No-shows</TH>
              <TH className="text-right">Strikes</TH>
              <TH>Ordering</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {filtered.map((student, index) => (
              <TR key={student.userId}>
                <TD className="text-right tabular text-faint">{index + 1}</TD>
                <TD>
                  <p className="font-medium">{student.name}</p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    {student.email}
                    {student.phone ? ` · ${student.phone}` : ""}
                  </p>
                </TD>
                <TD className="text-right tabular">{student.orderCount}</TD>
                <TD className="text-right tabular">
                  {student.noShowCount > 0 ? (
                    <span className="text-chili">{student.noShowCount}</span>
                  ) : (
                    <span className="text-faint">0</span>
                  )}
                </TD>
                <TD className="text-right tabular">
                  {student.strikes > 0 ? (
                    <span className="text-amber">{student.strikes}</span>
                  ) : (
                    <span className="text-faint">0</span>
                  )}
                </TD>
                <TD>
                  {student.ordersBlocked ? (
                    <span className="inline-flex flex-col gap-1">
                      <Badge tone="danger">Paused</Badge>
                      {student.ordersBlockedReason ? (
                        <span className="max-w-56 text-[11px] leading-tight text-muted">
                          {student.ordersBlockedReason}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <Badge tone="success">Allowed</Badge>
                  )}
                </TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-2">
                    <OrderingDialog student={student} />
                    {student.strikes > 0 ? <ClearStrikesButton student={student} /> : null}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function OrderingDialog({ student }: { student: StudentRowView }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const blocking = !student.ordersBlocked;

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    const result = await toggleStudentOrdering({
      userId: student.userId,
      blocked: blocking,
      reason,
    });
    setSubmitting(false);

    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setOpen(false);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          {blocking ? <ShieldOff /> : null}
          {blocking ? "Pause ordering" : "Restore ordering"}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {blocking ? "Pause" : "Restore"} ordering for {student.name}?
          </DialogTitle>
          <DialogDescription>
            {blocking
              ? "This stops them ordering at all — cash on delivery is the only way to order, so there is no lesser option. They see the reason you write here on their account page. Consider clearing their strikes instead."
              : "They can order again immediately."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              blocking
                ? "Refused to pay at the gate on 12 Sep, third time this month"
                : "Spoke to the student; the no-shows were an exam clash"
            }
            maxLength={200}
          />
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant={blocking ? "danger" : "success"}
            disabled={reason.trim().length < 3 || submitting}
            onClick={() => void submit()}
          >
            {submitting ? <Loader2 className="animate-spin" /> : null}
            {blocking ? "Pause ordering" : "Restore ordering"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClearStrikesButton({ student }: { student: StudentRowView }) {
  const [submitting, setSubmitting] = useState(false);

  const clear = async (): Promise<void> => {
    setSubmitting(true);
    const result = await clearStudentStrikes({
      userId: student.userId,
      reason: "Strikes cleared by admin review",
    });
    setSubmitting(false);

    if (result.status === "error") toast.error(result.message);
    else toast.success(result.message);
  };

  return (
    <Button size="sm" variant="ghost" disabled={submitting} onClick={() => void clear()}>
      {submitting ? <Loader2 className="animate-spin" /> : null}
      Clear strikes
    </Button>
  );
}
