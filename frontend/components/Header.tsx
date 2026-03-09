"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FaFacebookF } from "react-icons/fa";
import styles from "../styles/header.module.css";

export default function Header({ headlines = [] }: { headlines?: any[] }) {
  const [weather, setWeather] = useState<any>(null);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=17.3297&longitude=76.8343&current_weather=true",
        );
        const data = await res.json();
        setWeather(data.current_weather);
      } catch (err) {
        console.log("Weather fetch failed");
      }
    }

    fetchWeather();
  }, []);

  const getWeatherIcon = (code: number) => {
    if (!code) return "🌤";
    if (code === 0) return "☀️";
    if ([1, 2].includes(code)) return "🌤";
    if (code === 3) return "☁️";
    if ([45, 48].includes(code)) return "🌫";
    if ([51, 53, 55].includes(code)) return "🌦";
    if ([61, 63, 65].includes(code)) return "🌧";
    if ([71, 73, 75].includes(code)) return "❄️";
    if ([95, 96, 99].includes(code)) return "⛈";
    return "🌤";
  };

  return (
    <header className={styles.header}>
      {/* TOP STRIP */}
      <div className={styles.topStrip}>
        <div className={styles.stripContent}>
          {/* LEFT */}
          <div className={styles.leftStrip}>
            <span>{new Date().toLocaleDateString("ur-PK")}</span>

            {weather && (
              <span className={styles.weather}>
                {getWeatherIcon(weather.weathercode)}{" "}
                {Math.round(weather.temperature)}°C گلبرگہ
              </span>
            )}
          </div>

          {/* CENTER */}
          <div className={styles.centerStrip}>
            <a
              href="https://www.facebook.com/InquilabEDeccan/"
              target="_blank"
              className={styles.iconLink}
            >
              <FaFacebookF />
            </a>
          </div>

          {/* RIGHT */}
          <div className={styles.rightStrip}>
            <span>📞 09449310081</span>
            <span>✉️ inquilabglb@gmail.com</span>
          </div>
        </div>
      </div>

      {/* MASTHEAD */}
      <div className={styles.masthead}>
        <img src="/header.jpg" className={styles.mastheadImage} alt="Header" />
      </div>

      {/* NAVBAR */}
      <nav className={styles.navBar}>
        <NavLink href="/">آج کا اخبار</NavLink>
        <div className={styles.divider}></div>
        <NavLink href="/archive">پچھلے اخبارات</NavLink>
        <div className={styles.divider}></div>
        <NavLink href="/about">تعارف</NavLink>
      </nav>

      {/* TICKER */}
      {headlines.length > 0 && (
        <div className="breaking-wrapper">
          <div className="breaking-label">اہم خبر</div>
          <div className="breaking-viewport">
            <div className="breaking-track">
              {[...headlines, ...headlines].map((h, i) => (
                <div key={i} className="breaking-item">
                  <Link href={`/articles/${h.slug}`}>{h.title}</Link>
                  <span className="breaking-divider">●</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function NavLink({ href, children }: any) {
  return (
    <Link href={href} className={styles.navLink}>
      {children}
    </Link>
  );
}
