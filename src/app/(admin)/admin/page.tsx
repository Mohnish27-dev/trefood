import { redirect } from "next/navigation";

/** The radar is where an admin starts, because it is where the problems are. */
export default function AdminIndexPage() {
  redirect("/admin/orders");
}
