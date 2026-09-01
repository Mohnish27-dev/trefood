import { BottomNav } from "@/components/student/bottom-nav";
import { DeliveryHeader } from "@/components/student/delivery-header";

/**
 * The student PWA shell: sticky delivery header on top, bottom nav below, scrolling
 * content between them.
 *
 * The header is in the layout rather than on each page because the delivery point is
 * a persistent piece of context, not a per-screen control — a student mid-menu must
 * be able to see and change where the food is going.
 */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DeliveryHeader />
      <div className="mx-auto w-full max-w-md flex-1">{children}</div>
      <BottomNav />
    </>
  );
}
