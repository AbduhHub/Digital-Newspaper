"use client";

import { useState } from "react";

export default function AddArticle() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);

  async function handlePublish() {
    const token = localStorage.getItem("token");
    if (!token) return alert("Unauthorized");

    let imagePath = null;

    if (image) {
      const formData = new FormData();
      formData.append("file", image);

      const uploadRes = await fetch(
        `${process.env.NEXT_PUBLIC_API}/upload/article-image`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
      );

      if (!uploadRes.ok) return alert("Image upload failed");

      const uploadData = await uploadRes.json();
      imagePath = uploadData.image;
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_API}/articles/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        content,
        image: imagePath,
      }),
    });

    if (!res.ok) return alert("Failed to publish article");

    alert("Article Published!");
    window.location.reload();
  }

  return (
    <section style={{ background: "#fff", padding: 15, marginTop: 20 }}>
      <h2>Add Important News</h2>

      <input
        placeholder="Headline"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <textarea
        placeholder="News Content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        style={{ width: "100%", height: 120 }}
      />

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setImage(e.target.files ? e.target.files[0] : null)}
      />

      <button onClick={handlePublish}>Publish</button>
    </section>
  );
}
