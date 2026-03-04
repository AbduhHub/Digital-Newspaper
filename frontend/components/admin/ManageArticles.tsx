"use client";

import { useEffect, useState } from "react";

export default function ManageArticles() {
  const [articles, setArticles] = useState<any[]>([]);

  async function load() {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API}/articles/`);
    if (!res.ok) return;
    setArticles(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteArticle(slug: string) {
    const token = localStorage.getItem("token");
    if (!token) return;

    await fetch(`${process.env.NEXT_PUBLIC_API}/articles/${slug}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    load();
  }

  return (
    <section style={{ marginTop: 30 }}>
      <h2>Manage Articles</h2>

      {articles.map((a) => (
        <div key={a.slug} style={{ marginBottom: 10 }}>
          <b>{a.title}</b>
          <button onClick={() => deleteArticle(a.slug)}>Delete</button>
        </div>
      ))}
    </section>
  );
}
