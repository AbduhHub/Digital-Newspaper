"use client";

import { useState } from "react";
import { apiFetch } from "lib/api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin() {
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      localStorage.setItem("token", data.access_token);
      window.location.href = "/admin/dashboard";
    } catch {
      alert("Invalid credentials");
    }
  }

  return (
    <main>
      <h1>Admin Login</h1>

      <input
        placeholder="Username"
        onChange={(e) => setUsername(e.target.value)}
      />

      <input
        placeholder="Password"
        type="password"
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={handleLogin}>Login</button>
    </main>
  );
}
