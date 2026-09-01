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
import { clearStudentStrikes, toggleStudentCod } from "@/server/actions/admin";

export interface StudentRowView {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  strikes: number;
  codBlocked: boolean;
  codBlockedReason: string | null;
  orderCount: number;
  noShowCount: number;
  lastOrderAt: string | null;
}

/**
 * Student management.
 *
 * The only lever here is cash on delivery, and it is deliberately reversible
 * in both directions. A student who missed two gates is not a fraudster — they
 * had an exam, or fell asleep — and a blocked-COD student who must prepay is a
 * better customer than a lost one. There is no ban button on this screen
 * because there is no ban.
 */
export function StudentTable({ students }: { students: StudentRowView[] }) {
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

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, email or phone"
          className="pl-9"
          aria-label="Search students"
        />
      </div>

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
              <TH>Student</TH>
              <TH className="text-right">Orders</TH>
              <TH className="text-right">No-shows</TH>
              <TH className="text-right">Strikes</TH>
              <TH>Cash on delivery</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {filtered.map((student) => (
              <TR key={student.userId}>
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
                  {student.codBlocked ? (
                    <span className="inline-flex flex-col gap-1">
                      <Badge tone="danger">Blocked</Badge>
                      {student.codBlockedReason ? (
                        <span className="max-w-56 text-[11px] leading-tight text-muted">
                          {student.codBlockedReason}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <Badge tone="success">Allowed</Badge>
                  )}
                </TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-2">
                    <CodDialog student={student} />
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

function CodDialog({ student }: { student: StudentRowView }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const blocking = !student.codBlocked;

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    const result = await toggleStudentCod({
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
          {blocking ? "Block COD" : "Restore COD"}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {blocking ? "Disable" : "Restore"} cash on delivery for {student.name}?
          </DialogTitle>
          <DialogDescription>
            {blocking
              ? "They can still order — the cash option simply disappears at checkout, and they see the reason you write here on their account page."
              : "The cash option reappears at checkout immediately."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              blocking
                ? "Refused to pay at the gate on 12 Sep"
                : "Spoke to the student; two no-shows were an exam clash"
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
            {blocking ? "Disable cash" : "Restore cash"}
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
