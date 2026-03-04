"use client";

import { useEffect, useState } from "react";
import UploadEpaper from "../../../components/admin/UploadEpaper";
import AddArticle from "../../../components/admin/AddArticle";
import ManageAds from "../../../components/admin/ManageAds";
import AddAd from "../../../components/admin/AddAd";
import ManageArticles from "../../../components/admin/ManageArticles";
import ManageEpapers from "../../../components/admin/ManageEpapers";

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/admin/login";
      return;
    }

    // ✅ Validate token with backend
    fetch(`${process.env.NEXT_PUBLIC_API}/auth/validate`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setAuthorized(true);
      })
      .catch(() => {
        localStorage.removeItem("token");
        window.location.href = "/admin/login";
      });
  }, []);

  useEffect(() => {
    if (!authorized) return;

    const token = localStorage.getItem("token");

    fetch(`${process.env.NEXT_PUBLIC_API}/stats`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((r) => r.json())
      .then(setStats);
  }, [authorized]);

  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/admin/login";
  }

  if (!authorized) return null;
  if (!stats) return <div>Loading dashboard...</div>;
  return (
    <main
      style={{
        maxWidth: "1200px",
        margin: "40px auto",
      }}
      className="admin-wrapper"
    >
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <button onClick={logout}>Logout</button>
      </div>

      <div className="admin-stats">
        <div className="stat-card">
          <h3>Article Views</h3>
          <p>{stats.article_views}</p>
        </div>

        <div className="stat-card">
          <h3>Ad Impressions</h3>
          <p>{stats.ad_impressions}</p>
        </div>
      </div>

      <div className="admin-grid">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <UploadEpaper />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <ManageEpapers />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <AddArticle />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <ManageArticles />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <AddAd />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <ManageAds />
        </div>
      </div>
    </main>
  );
}
