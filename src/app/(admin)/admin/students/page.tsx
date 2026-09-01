import type { Metadata } from "next";

import { StudentTable, type StudentRowView } from "@/components/admin/student-table";
import { requireAdmin } from "@/server/auth/session";
import { listStudents } from "@/server/services/students";

export const metadata: Metadata = { title: "Students" };
export const dynamic = "force-dynamic";

export default async function AdminStudentsPage() {
  await requireAdmin();

  const students = await listStudents({ limit: 200 });

  const rows: StudentRowView[] = students.map((row) => ({
    userId: row.user._id,
    name: row.user.name,
    email: row.user.email,
    phone: row.user.phone,
    strikes: row.user.strikes,
    codBlocked: row.user.codBlocked,
    codBlockedReason: row.user.codBlockedReason,
    orderCount: row.orderCount,
    noShowCount: row.noShowCount,
    lastOrderAt: row.lastOrderAt?.toISOString() ?? null,
  }));

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-xl font-semibold text-bone">Students</h1>
        <p className="mt-1 text-sm text-muted">
          Cash on delivery is the only lever here, and it is reversible. Nobody is ever banned.
        </p>
      </header>

      <StudentTable students={rows} />
    </>
  );
}
