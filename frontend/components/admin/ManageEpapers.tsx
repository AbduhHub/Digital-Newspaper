"use client";

import { useEffect, useState } from "react";

export default function ManageEpapers() {
  const [papers, setPapers] = useState<any[]>([]);

  async function load() {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API}/epapers/`);
    if (!res.ok) return;
    setPapers(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function deletePaper(date: string) {
    const token = localStorage.getItem("token");
    if (!token) return;

    await fetch(`${process.env.NEXT_PUBLIC_API}/epapers/${date}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    load();
  }

  return (
    <section style={{ marginTop: 30 }}>
      <h2>Manage E-Papers</h2>

      {papers.map((p) => (
        <div key={p.date} style={{ marginBottom: 10 }}>
          <b>{p.date}</b>
          <button onClick={() => deletePaper(p.date)}>Delete</button>
        </div>
      ))}
    </section>
  );
}
