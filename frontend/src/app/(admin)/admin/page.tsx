import { redirect } from "next/navigation";

// The radar is what an admin opens the console for.
export default function AdminIndexPage() {
  redirect("/admin/orders");
}
