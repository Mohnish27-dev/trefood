"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { students as seedStudents, type IUser } from "@trefood/shared";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Student management: strike history and the COD block.
 *
 * The two ways a student loses COD are deliberately different, and the table shows
 * which applied:
 *   F8 — two no-shows accumulate into a block. Accidental, so it takes twice.
 *   F9 — refusing to hand over the cash blocks immediately. Deliberate, so once.
 *
 * An account is NEVER banned. A student who must prepay is a better customer than a
 * lost one, and prepaid orders carry zero collection risk — so the only control here
 * is the COD toggle, and unblocking is always one click away.
 */
export default function StudentsPage() {
  const [students, setStudents] = useState<IUser[]>(seedStudents);

  function toggleCod(userId: string) {
    setStudents((current) =>
      current.map((student) =>
        student._id === userId ? { ...student, codBlocked: !student.codBlocked } : student,
      ),
    );
  }

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Students</h1>
        <p className="text-muted-foreground text-sm">
          Accounts are never banned — only cash on delivery is switched off.
        </p>
      </div>

      <table className="w-full text-sm">
        <thead className="text-muted-foreground border-b text-xs uppercase">
          <tr>
            <th className="py-2 text-start font-medium">Student</th>
            <th className="py-2 text-start font-medium">Contact</th>
            <th className="py-2 text-center font-medium">No-show strikes</th>
            <th className="py-2 text-start font-medium">Cash on delivery</th>
            <th className="py-2 text-end font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {students.map((student) => {
            const isOneStrikeAway = !student.codBlocked && student.noShowStrikes === 1;

            return (
              <tr key={student._id}>
                <td className="py-3 font-medium">{student.name}</td>
                <td className="text-muted-foreground text-xs">
                  {student.email}
                  <span className="block">{student.phone ?? "no phone yet"}</span>
                </td>
                <td className="text-center">
                  <span className={cn(student.noShowStrikes > 0 && "text-status-cooking font-medium")}>
                    {student.noShowStrikes}
                  </span>
                  {isOneStrikeAway ? (
                    <span className="text-status-cooking flex items-center justify-center gap-1 text-[10px]">
                      <AlertTriangle className="size-3" aria-hidden />
                      one more blocks COD
                    </span>
                  ) : null}
                </td>
                <td>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      student.codBlocked ? "text-status-failed" : "text-status-done",
                    )}
                  >
                    {student.codBlocked ? "Blocked" : "Allowed"}
                  </span>
                  {student.codBlocked ? (
                    <span className="text-muted-foreground block text-[10px]">
                      can still order by paying online
                    </span>
                  ) : null}
                </td>
                <td className="text-end">
                  <Button
                    variant={student.codBlocked ? "outline" : "destructive"}
                    size="sm"
                    onClick={() => toggleCod(student._id)}
                  >
                    {student.codBlocked ? "Allow COD" : "Block COD"}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
