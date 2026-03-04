"use client";

import { useState } from "react";
import { apiFetch } from "lib/api";

export default function AddAd() {
  const [image, setImage] = useState<File | null>(null);
  const [placement, setPlacement] = useState("sidebar");

  async function handleUpload() {
    if (!image) {
      alert("Select image");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Unauthorized");
      return;
    }

    const formData = new FormData();
    formData.append("file", image);

    const uploadRes = await fetch(
      `${process.env.NEXT_PUBLIC_API}/upload/ad-image`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      },
    );

    if (!uploadRes.ok) {
      alert("Image upload failed");
      return;
    }

    const uploadData = await uploadRes.json();

    await apiFetch("/ads/", {
      method: "POST",
      body: JSON.stringify({
        image: uploadData.image,
        placement,
      }),
    });

    alert("Ad Added!");
  }

  return (
    <div>
      <h3>Add Advertisement</h3>

      <select onChange={(e) => setPlacement(e.target.value)}>
        <option value="sidebar">Sidebar</option>
        <option value="between_pages">Between Pages</option>
        <option value="homepage">Homepage</option>
        <option value="article_top">Article Top</option>
      </select>

      <br />
      <br />

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setImage(e.target.files ? e.target.files[0] : null)}
      />

      <br />
      <br />

      <button onClick={handleUpload}>Upload Ad</button>
    </div>
  );
}
