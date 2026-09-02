import { StudentShell } from "@/components/student/student-shell";
import { getSession } from "@/server/auth/session";

/**
 * The student PWA shell.
 *
 * Mobile-first: 360px is the design width, not the fallback. `max-w-lg`
 * centres the column on a desktop rather than stretching a phone layout
 * across 1400px, because a stakeholder will open this on a laptop.
 */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const user = session?.user
    ? {
        _id: session.user._id,
        name: session.user.name,
        email: session.user.email,
        quickUnlock: session.user.quickUnlock ?? null,
      }
    : null;

  return <StudentShell user={user}>{children}</StudentShell>;
}
