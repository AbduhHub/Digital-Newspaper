"use client";

import { useState } from "react";

export default function UploadEpaper() {
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState("");

  async function handleUpload() {
    if (!file || !date) {
      alert("Select date and PDF file");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Unauthorized");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("date", date);

    const res = await fetch(`${process.env.NEXT_PUBLIC_API}/epapers/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      alert("Upload failed");
      return;
    }

    alert("Upload queued!");
    window.location.reload();
  }

  return (
    <section style={{ marginTop: "20px" }}>
      <h2>Upload E-Paper</h2>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      <br />
      <br />

      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
      />

      <br />
      <br />

      <button onClick={handleUpload}>Upload</button>
    </section>
  );
}
