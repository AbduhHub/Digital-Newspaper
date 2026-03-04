"use client";

import { useEffect } from "react";

export default function AdminGate() {
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/admin/login";
      return;
    }

    window.location.href = "/admin/dashboard";
  }, []);

  return null;
}
