"use client";

import { useEffect, useState, useRef } from "react";
import { apiFetch } from "../lib/api";
import { trackEvent } from "../lib/analytics";

export default function AdSlot({ placement }: { placement: string }) {
  const [ads, setAds] = useState<any[]>([]);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch ads
  useEffect(() => {
    apiFetch(`/ads/${placement}`)
      .then(setAds)
      .catch(() => setAds([]));
  }, [placement]);

  // Track only when visible
  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (visible && ads.length) {
      trackEvent("ad_impression", { placement });
    }
  }, [visible, ads, placement]);

  if (!ads.length) return null;

  return (
    <div ref={ref} className="ad-slot">
      {ads.map((ad) => (
        <img
          key={ad.image}
          src={ad.image}
          alt="Advertisement"
          loading="lazy"
          className="ad-image"
        />
      ))}
    </div>
  );
}
