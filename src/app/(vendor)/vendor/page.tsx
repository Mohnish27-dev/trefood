import { redirect } from "next/navigation";

/** The board is the console. Nothing else is a landing page. */
export default function VendorIndexPage() {
  redirect("/vendor/orders");
}
