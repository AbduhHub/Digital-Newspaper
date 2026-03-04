"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    localStorage.removeItem("token");
    router.push("/admin/login");
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <h2 className="admin-logo">NEWSPAPER</h2>

        <nav>
          <Link
            href="/admin/dashboard"
            className={pathname.includes("dashboard") ? "active" : ""}
          >
            Dashboard
          </Link>
          <Link
            href="/admin/articles"
            className={pathname.includes("articles") ? "active" : ""}
          >
            Articles
          </Link>
          <Link
            href="/admin/epapers"
            className={pathname.includes("epapers") ? "active" : ""}
          >
            E-Papers
          </Link>
          <Link
            href="/admin/ads"
            className={pathname.includes("ads") ? "active" : ""}
          >
            Advertisements
          </Link>
        </nav>

        <button onClick={logout} className="logout-btn">
          Logout
        </button>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}
