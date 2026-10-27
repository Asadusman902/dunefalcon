import Script from "next/script";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { ADMIN_HTML } from "@/lib/markup";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin | Dune Falcon", robots: { index: false } };

export default function AdminPage() {
  if (!isAdmin()) redirect("/admin/login");
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: ADMIN_HTML }} />
      <Script src="/admin.js" strategy="afterInteractive" />
    </>
  );
}
