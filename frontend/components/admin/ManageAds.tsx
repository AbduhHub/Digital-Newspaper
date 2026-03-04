"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "lib/api";

export default function ManageAds() {
  const [ads, setAds] = useState<any[]>([]);

  async function loadAds() {
    try {
      const data = await apiFetch("/ads/");
      setAds(data);
    } catch {
      setAds([]);
    }
  }

  useEffect(() => {
    loadAds();
  }, []);

  async function toggleAd(image: string) {
    await apiFetch(`/ads/${image}`, {
      method: "PUT",
    });
    loadAds();
  }

  async function updatePriority(image: string, priority: number) {
    await apiFetch(`/ads/${image}/priority`, {
      method: "PUT",
      body: JSON.stringify({ priority }),
    });
    loadAds();
  }

  async function deleteAd(image: string) {
    await apiFetch(`/ads/${image}`, {
      method: "DELETE",
    });
    loadAds();
  }

  return (
    <section>
      <h2>Manage Advertisements</h2>

      {ads.map((ad) => {
        const filename = ad.image.split("/").pop();

        return (
          <div key={ad.image} style={{ marginBottom: 20 }}>
            <img src={ad.image} style={{ width: 120 }} />

            <div>Placement: {ad.placement}</div>
            <div>Status: {ad.active ? "Active" : "Hidden"}</div>

            <input
              type="number"
              defaultValue={ad.priority}
              onBlur={(e) => updatePriority(filename!, Number(e.target.value))}
            />

            <button onClick={() => toggleAd(filename!)}>
              {ad.active ? "Disable" : "Enable"}
            </button>

            <button onClick={() => deleteAd(filename!)}>Delete</button>
          </div>
        );
      })}
    </section>
  );
}
