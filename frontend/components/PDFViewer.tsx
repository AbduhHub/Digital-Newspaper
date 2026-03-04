"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchAds } from "../lib/fetchAds";
type Props = {
  pdfUrl: string;
  thumbnailPages?: string[];
};

type RenderedPage = {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  naturalWidth: number; // real px width of rendered canvas
  naturalHeight: number;
};

export default function PDFViewer({ pdfUrl, thumbnailPages = [] }: Props) {
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const check = () => setIsMobileDevice(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const RENDER_SCALE = isMobileDevice ? 4 : 5;
  const MIN_ZOOM = 0.6;
  const MAX_ZOOM = isMobileDevice ? 3.5 : 5;

  const dprRef = useRef(1);

  useEffect(() => {
    dprRef.current = window.devicePixelRatio || 1;
  }, []);
  const rootRef = useRef<HTMLDivElement>(null);

  // The "stage" which scrolls in BOTH directions (Drive-like)
  const stageRef = useRef<HTMLDivElement>(null);

  // The element that gets transform: translate + scale
  const zoomLayerRef = useRef<HTMLDivElement>(null);

  // pdf.js doc ref
  const pdfDocRef = useRef<any | null>(null);

  // render cache
  const renderedPagesRef = useRef<Map<number, RenderedPage>>(new Map());
  const renderQueueRef = useRef<number[]>([]);
  const renderingRef = useRef(false);

  // UI state
  const [numPages, setNumPages] = useState(0);
  const [activePage, setActivePage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadingPercent, setLoadingPercent] = useState(0);

  const [showSidebar, setShowSidebar] = useState(true);
  const [readingMode, setReadingMode] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [sidebarAds, setSidebarAds] = useState<any[]>([]);
  const [betweenAds, setBetweenAds] = useState<any[]>([]);
  const betweenAdsRef = useRef<any[]>([]);
  const zoomRef = useRef(1);

  // mobile
  const [isMobile, setIsMobile] = useState(false);

  // zoom state
  const [zoom, setZoom] = useState<number>(1);

  // fit width mode
  const [fitWidth, setFitWidth] = useState(true);

  // smooth page counter animation
  const [pageCounterPulse, setPageCounterPulse] = useState(false);

  const [isDragging, setIsDragging] = useState(false);

  // pinch state
  const pinchRef = useRef({
    active: false,
    startDist: 0,
    startZoom: 1,
    centerX: 0,
    centerY: 0,
  });

  // drag pan state
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
  });

  const uiFont = `'Inter', system-ui, sans-serif`;
  const urduFont = `'Noto Nastaliq Urdu', serif`;

  const zoomPresets = useMemo(
    () => [75, 100, 125, 150, 200, 300, 400, 500],
    [],
  );

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 900);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (isMobile) setShowSidebar(false);
  }, [isMobile]);

  useEffect(() => {
    const handleResize = () => {
      const newDpr = window.devicePixelRatio || 1;

      if (Math.abs(newDpr - dprRef.current) > 0.01) {
        dprRef.current = newDpr;

        // clear rendered pages
        renderedPagesRef.current.clear();

        if (zoomLayerRef.current) {
          zoomLayerRef.current.innerHTML = "";
        }

        // re-render visible pages
        if (pdfDocRef.current) {
          for (let i = 1; i <= numPages; i++) {
            renderPage(i);
          }
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [numPages]);

  /* ------------------- BLOCK BROWSER ZOOM INSIDE VIEWER ------------------- */

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };

    stage.addEventListener("wheel", onWheel, { passive: false });

    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  /* ------------------- LOAD SIDEBAR ADS ------------------- */

  useEffect(() => {
    async function loadAds() {
      const ads = await fetchAds("sidebar");
      setSidebarAds(ads);
    }

    loadAds();
  }, []);

  const [adsReady, setAdsReady] = useState(false);

  useEffect(() => {
    async function loadBetweenAds() {
      const ads = await fetchAds("between_pages");
      setBetweenAds(ads);
      betweenAdsRef.current = ads;
      setAdsReady(true);
    }

    loadBetweenAds();
  }, []);
  /* ------------------- PDF LOAD ------------------- */

  useEffect(() => {
    if (!pdfUrl || !adsReady) return;

    let destroyed = false;

    async function init() {
      setLoading(true);
      setLoadingPercent(0);
      setNumPages(0);
      setActivePage(1);

      setFitWidth(false);
      applyLayoutZoom(1.25);

      renderedPagesRef.current.clear();
      renderQueueRef.current = [];
      renderingRef.current = false;

      if (zoomLayerRef.current) zoomLayerRef.current.innerHTML = "";

      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.mjs`;

      const task = pdfjsLib.getDocument({
        url: pdfUrl,
        disableStream: false,
        disableAutoFetch: false,
      });

      task.onProgress = (p: any) => {
        if (!p?.loaded || !p?.total) return;
        setLoadingPercent(Math.min(99, Math.round((p.loaded / p.total) * 100)));
      };

      const pdfDoc = await task.promise;
      if (destroyed) {
        try {
          await pdfDoc.destroy();
        } catch {}
        return;
      }

      pdfDocRef.current = pdfDoc;
      setNumPages(pdfDoc.numPages);
      setLoadingPercent(100);

      // Render first 2 pages immediately
      await renderPage(1);

      if (pdfDoc.numPages > 1) {
        await renderPage(2);
      }

      // Render rest in background (non-blocking)
      for (let i = 3; i <= pdfDoc.numPages; i++) {
        setTimeout(() => {
          renderPage(i);
        }, 0);
      }

      setLoading(false);

      applyLayoutZoom(1.25);
    }

    init();

    return () => {
      if (zoomLayerRef.current) zoomLayerRef.current.innerHTML = "";
      destroyed = true;

      try {
        pdfDocRef.current?.destroy();
      } catch {}

      pdfDocRef.current = null;
      renderedPagesRef.current.clear();
      renderQueueRef.current = [];
      renderingRef.current = false;
    };
  }, [pdfUrl, adsReady]);

  /* ------------------- PAGE RENDERING ------------------- */

  async function renderPage(pageNumber: number) {
    const doc = pdfDocRef.current;
    const layer = zoomLayerRef.current;
    if (!doc || !layer) return;

    if (renderedPagesRef.current.has(pageNumber)) return;

    const page = await doc.getPage(pageNumber);

    const deviceScale = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: RENDER_SCALE * deviceScale });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // real pixels
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // IMPORTANT: pdfjs newer versions require canvas param
    const renderTask = page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    });

    await renderTask.promise;

    renderedPagesRef.current.set(pageNumber, {
      pageNumber,
      canvas,
      naturalWidth: canvas.width,
      naturalHeight: canvas.height,
    });

    // wrapper (Drive-like)
    const wrapper = document.createElement("div");
    wrapper.id = `page-${pageNumber}`;
    wrapper.dataset.page = String(pageNumber);

    const baseWidth =
      canvas.width / (RENDER_SCALE * (window.devicePixelRatio || 1));

    wrapper.dataset.baseWidth = String(baseWidth);
    wrapper.style.width = `${baseWidth * zoomRef.current}px`;

    wrapper.style.margin = "18px auto";
    wrapper.style.borderRadius = "10px";
    wrapper.style.overflow = "hidden";
    wrapper.style.background = "#fff";
    wrapper.style.boxShadow = "0 10px 28px rgba(0,0,0,0.35)";
    wrapper.style.position = "relative";

    // Canvas: keep crisp
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "auto";

    wrapper.appendChild(canvas);

    // Insert in correct order
    const existing = layer.querySelectorAll("[data-page]");
    let inserted = false;

    for (const el of Array.from(existing)) {
      const p = Number((el as HTMLElement).dataset.page);
      if (p > pageNumber) {
        layer.insertBefore(wrapper, el);
        inserted = true;
        break;
      }
    }

    if (!inserted) layer.appendChild(wrapper);

    // 🔥 BETWEEN PAGE AD INSERTION
    if (pageNumber % 2 === 0 && betweenAdsRef.current?.length) {
      const adWrapper = document.createElement("div");
      adWrapper.style.margin = "24px auto";
      adWrapper.style.textAlign = "center";
      adWrapper.style.maxWidth = "800px";

      const img = document.createElement("img");
      img.src = betweenAdsRef.current[0].image;
      img.style.width = "100%";
      img.style.borderRadius = "8px";
      img.style.boxShadow = "0 8px 24px rgba(0,0,0,0.35)";

      adWrapper.appendChild(img);
      wrapper.after(adWrapper);
    }
  }

  function startIdleRenderLoop() {
    if (renderingRef.current) return;
    renderingRef.current = true;

    const run = async () => {
      if (!pdfDocRef.current) return;

      const next = renderQueueRef.current.shift();
      if (!next) {
        renderingRef.current = false;
        return;
      }

      try {
        await renderPage(next);
      } catch {}

      if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(run, { timeout: 800 });
      } else {
        setTimeout(run, 35);
      }
    };

    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(run, { timeout: 500 });
    } else {
      setTimeout(run, 35);
    }
  }

  /* ------------------- FIT WIDTH ------------------- */

  function applyFitWidth() {
    const stage = stageRef.current;
    const layer = zoomLayerRef.current;
    if (!stage || !layer) return;

    const firstPage = layer.querySelector("#page-1") as HTMLDivElement | null;
    if (!firstPage) return;

    const baseWidth = Number(firstPage.dataset.baseWidth);
    if (!baseWidth) return;

    const usable = stage.clientWidth - 48;
    const targetZoom = usable / baseWidth;

    applyLayoutZoom(targetZoom);
  }

  function toggleFitWidth() {
    const next = !fitWidth;
    setFitWidth(next);

    if (next) {
      requestAnimationFrame(() => applyFitWidth());
    } else {
      applyLayoutZoom(1.25);
    }
  }

  useEffect(() => {
    if (!fitWidth) return;
    const onResize = () => applyFitWidth();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitWidth]);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setReadingMode(false);
        setUiVisible(true);
        if (!isMobile) setShowSidebar(true);
      }
    };

    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [isMobile]);

  /* ------------------- ACTIVE PAGE TRACKING ------------------- */

  useEffect(() => {
    const stage = stageRef.current;
    const layer = zoomLayerRef.current;
    if (!stage || !layer) return;

    const handler = () => {
      const pages = Array.from(
        layer.querySelectorAll("[data-page]"),
      ) as HTMLDivElement[];

      if (!pages.length) return;

      const viewportMid = stage.scrollTop + stage.clientHeight * 0.35;

      let bestPage = activePage;
      let bestDist = Infinity;

      for (const el of pages) {
        const rect = el.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();

        const top = rect.top - stageRect.top + stage.scrollTop;
        const dist = Math.abs(top - viewportMid);

        if (dist < bestDist) {
          bestDist = dist;
          bestPage = Number(el.dataset.page);
        }
      }

      if (bestPage !== activePageRef.current) {
        setActivePage(bestPage);
        setPageCounterPulse(true);
        setTimeout(() => setPageCounterPulse(false), 140);

        // thumbnail auto-scroll
        const thumbEl = document.getElementById(`thumb-${bestPage}`);
        thumbEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    };

    stage.addEventListener("scroll", handler, { passive: true });
    return () => stage.removeEventListener("scroll", handler);
  }, [showSidebar]);
  const activePageRef = useRef(activePage);
  useEffect(() => {
    activePageRef.current = activePage;
  }, [activePage]);

  /* ------------------- NAVIGATION ------------------- */

  function goToPage(page: number) {
    const safe = Math.max(1, Math.min(numPages || 1, page));
    const stage = stageRef.current;
    const layer = zoomLayerRef.current;
    if (!stage || !layer) return;

    renderPage(safe).then(() => {
      const el = layer.querySelector(`#page-${safe}`) as HTMLDivElement | null;
      if (!el) return;

      stage.scrollTo({
        top: el.offsetTop,
        left: 0,
        behavior: "auto",
      });
    });
  }

  function nextPage() {
    goToPage(activePage + 1);
  }
  function prevPage() {
    goToPage(activePage - 1);
  }

  /* ------------------- KEYBOARD ------------------- */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")
        nextPage(); // Urdu reversed
      else if (e.key === "ArrowRight") prevPage();
      else if (e.key === "Escape") {
        if (readingMode) exitReadingMode();
      } else if (e.key === "Home") goToPage(1);
      else if (e.key === "End") goToPage(numPages);
      else if (e.key === "0") {
        setFitWidth(false);
        applyLayoutZoom(1);
      } else if (e.key.toLowerCase() === "f") {
        setFitWidth(true);
        requestAnimationFrame(() => applyFitWidth());
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activePage, numPages, readingMode]);

  /* ------------------- ZOOM AROUND POINT ------------------- */

  function applyLayoutZoom(newZoom: number) {
    const z = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);

    zoomRef.current = z; // 🔥 important
    setZoom(z);

    const pages = zoomLayerRef.current?.querySelectorAll(
      "[data-page]",
    ) as NodeListOf<HTMLDivElement>;

    pages?.forEach((el) => {
      const base = Number(el.dataset.baseWidth);
      if (!base) return;
      el.style.width = `${base * z}px`;
    });
  }

  function onWheel(e: React.WheelEvent) {
    // ctrl+wheel = zoom (Drive style)
    if (e.ctrlKey) {
      e.preventDefault();

      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      applyLayoutZoom(zoom * factor);
      setFitWidth(false);
      return;
    }
  }

  /* ------------------- DRAG PAN ------------------- */

  function onPointerDown(e: React.PointerEvent) {
    const stage = stageRef.current;
    if (!stage) return;
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, select")) return;

    dragRef.current.active = true;
    setIsDragging(true);

    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.startScrollLeft = stage.scrollLeft;
    dragRef.current.startScrollTop = stage.scrollTop;

    stage.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const stage = stageRef.current;
    if (!stage) return;
    if (!dragRef.current.active) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    stage.scrollLeft = dragRef.current.startScrollLeft - dx;
    stage.scrollTop = dragRef.current.startScrollTop - dy;
  }

  function onPointerUp(e: React.PointerEvent) {
    const stage = stageRef.current;
    if (!stage) return;

    dragRef.current.active = false;
    setIsDragging(false);

    try {
      stage.releasePointerCapture(e.pointerId);
    } catch {}
  }

  /* ------------------- TOUCH PINCH ------------------- */

  function distance(t1: React.Touch, t2: React.Touch) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];

      pinchRef.current.active = true;
      pinchRef.current.startDist = distance(t1, t2);
      pinchRef.current.startZoom = zoom;
      pinchRef.current.centerX = (t1.clientX + t2.clientX) / 2;
      pinchRef.current.centerY = (t1.clientY + t2.clientY) / 2;

      setFitWidth(false);
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!pinchRef.current.active) return;
    if (e.touches.length !== 2) return;

    e.preventDefault();

    const t1 = e.touches[0];
    const t2 = e.touches[1];

    const newDist = distance(t1, t2);

    const ratio = newDist / pinchRef.current.startDist;
    const newZoom = pinchRef.current.startZoom * ratio;

    applyLayoutZoom(newZoom);
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchRef.current.active = false;
  }

  /* ------------------- DOUBLE TAP ------------------- */

  const lastTapRef = useRef(0);

  function onTap(e: React.TouchEvent) {
    if (!isMobile) return;

    const now = Date.now();
    const delta = now - lastTapRef.current;
    lastTapRef.current = now;

    if (delta < 280) {
      e.preventDefault();

      const touch = e.changedTouches[0];
      const isZoomed = zoom > 1.05;

      if (!isZoomed) {
        applyLayoutZoom(clamp(zoom * 2, MIN_ZOOM, MAX_ZOOM));

        setFitWidth(false);
      } else {
        setFitWidth(true);
        requestAnimationFrame(() => applyFitWidth());
      }
    }
  }

  /* ------------------- READING MODE ------------------- */

  async function enterReadingMode() {
    setReadingMode(true);
    setUiVisible(false);
    setShowSidebar(false);

    setFitWidth(true);

    requestAnimationFrame(() => {
      applyFitWidth();
    });

    try {
      await document.documentElement.requestFullscreen();
    } catch {}
  }

  async function exitReadingMode() {
    setReadingMode(false);
    setUiVisible(true);

    if (!isMobile) setShowSidebar(true);

    // Return to default view
    setFitWidth(false);
    applyLayoutZoom(1.25);

    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {}
  }

  /* ------------------- UI SHOW/HIDE (MOBILE TOP ZONE) ------------------- */

  function onMobileTopZoneTap() {
    if (!isMobile) return;
    if (readingMode) return;
    setUiVisible((v) => !v);
  }

  const showAnyUI = uiVisible;

  const scalePercent = Math.round(zoom * 100);

  return (
    <div
      ref={rootRef}
      style={{
        display: "flex",
        height: "100vh",
        background: readingMode ? "#000" : "linear-gradient(#1c1c1c, #141414)",
        color: "#fff",
        fontFamily: uiFont,
        overflow: "hidden",
      }}
    >
      {/* SIDEBAR */}
      {showSidebar && showAnyUI && (
        <div
          style={{
            width: 190,
            overflowY: "auto",
            background: "rgba(20,20,20,0.55)",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            padding: 12,
            backdropFilter: "blur(10px)",
          }}
        >
          {(thumbnailPages ?? []).map((thumb: string, index: number) => {
            const p = index + 1;
            const active = p === activePage;

            return (
              <React.Fragment key={p}>
                <div style={{ marginBottom: 14 }}>
                  <img
                    id={`thumb-${p}`}
                    src={thumb}
                    loading="lazy"
                    onClick={() => goToPage(p)}
                    style={{
                      width: "100%",
                      cursor: "pointer",
                      borderRadius: 14,
                      border: "none",
                      opacity: active ? 1 : 0.35,
                      transform: active ? "scale(1.02)" : "scale(1)",
                      boxShadow: active
                        ? "0 0 0 2px rgba(255,255,255,0.18), 0 18px 40px rgba(0,0,0,0.55)"
                        : "0 6px 18px rgba(0,0,0,0.30)",
                      transition:
                        "transform 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease",
                      background: "#0b0b0b",
                    }}
                  />
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      opacity: active ? 0.95 : 0.5,
                      textAlign: "center",
                    }}
                  >
                    {p}
                  </div>
                </div>

                {(index + 1) % 3 === 0 && sidebarAds[0] && (
                  <div
                    style={{
                      marginBottom: 18,
                      padding: 6,
                      background: "#fff",
                      borderRadius: 10,
                    }}
                  >
                    <img
                      src={sidebarAds[0].image}
                      style={{
                        width: "100%",
                        display: "block",
                        borderRadius: 8,
                      }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* MAIN */}
      <div style={{ flex: 1, position: "relative" }}>
        {/* MOBILE TOP ZONE */}
        {isMobile && !readingMode && (
          <div
            onClick={onMobileTopZoneTap}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 40,
              zIndex: 100,
            }}
          />
        )}

        {/* TOP BAR */}
        {(uiVisible || readingMode) && (
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              right: 14,
              zIndex: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              pointerEvents: "none",
            }}
          >
            {/* LEFT */}

            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                pointerEvents: "auto",
              }}
            >
              {/* Sidebar toggle RIGHT */}
              {!isMobile && !readingMode && (
                <button
                  onClick={() => setShowSidebar((s) => !s)}
                  style={miniBtn}
                  title="Toggle thumbnails"
                >
                  ☰
                </button>
              )}
              <div
                style={{
                  pointerEvents: "auto",
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(10px)",
                  padding: "8px 12px",
                  borderRadius: 999,
                  fontSize: 13,
                  opacity: 0.92,
                  transition: "opacity 120ms ease, transform 120ms ease",
                  transform: pageCounterPulse ? "scale(1.02)" : "scale(1)",
                }}
              >
                <span style={{ fontFamily: urduFont, marginRight: 6 }}>
                  صفحہ
                </span>
                <span style={{ fontWeight: 700 }}>{activePage}</span>
                <span style={{ opacity: 0.7 }}> / {numPages || "-"}</span>
              </div>
            </div>

            {/* RIGHT */}
            <div
              style={{
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {/* Zoom */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => {
                    setFitWidth(false);
                    applyLayoutZoom(zoom * 0.9);
                  }}
                  style={miniBtn}
                  title="Zoom out"
                >
                  −
                </button>

                <select
                  value={closestPreset(scalePercent, zoomPresets)}
                  onChange={(e) => {
                    setFitWidth(false);
                    applyLayoutZoom(Number(e.target.value) / 100);
                  }}
                  style={miniSelect}
                >
                  {zoomPresets.map((z) => (
                    <option key={z} value={z}>
                      {z}%
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    setFitWidth(false);
                    applyLayoutZoom(zoom * 1.1);
                  }}
                  style={miniBtn}
                  title="Zoom in"
                >
                  +
                </button>
              </div>

              <div
                style={{
                  width: 1,
                  height: 22,
                  background: "rgba(255,255,255,0.08)",
                }}
              />

              {/* Utility */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Fit width */}
                <button
                  onClick={toggleFitWidth}
                  style={miniBtn}
                  title={fitWidth ? "Exit fit width" : "Fit width"}
                >
                  ↔
                </button>
                {!readingMode ? (
                  <button
                    onClick={enterReadingMode}
                    style={miniBtn}
                    title="Reading mode"
                  >
                    ⛶
                  </button>
                ) : (
                  <button
                    onClick={exitReadingMode}
                    style={miniBtn}
                    title="Exit reading mode"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LOADING */}
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 55,
              flexDirection: "column",
              gap: 12,
              background: "rgba(0,0,0,0.25)",
              backdropFilter: "blur(4px)",
            }}
          >
            <div style={{ fontSize: 14, opacity: 0.9 }}>Loading newspaper…</div>

            <div
              style={{
                width: 280,
                height: 7,
                background: "rgba(255,255,255,0.10)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${loadingPercent}%`,
                  height: "100%",
                  background: "rgba(26,115,232,0.95)",
                  transition: "width 200ms linear",
                }}
              />
            </div>

            <div style={{ fontSize: 12, opacity: 0.7 }}>{loadingPercent}%</div>
          </div>
        )}

        {/* DRIVE-LIKE STAGE (BOTH AXES SCROLL) */}
        <div
          ref={stageRef}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={(e) => {
            const wasPinching = pinchRef.current.active;
            onTouchEnd(e);
            if (!wasPinching) onTap(e);
          }}
          style={{
            position: "absolute",
            inset: 0,
            overflow: "auto",

            paddingTop: readingMode ? 0 : 56,
            paddingBottom: readingMode ? 0 : 90,

            background: "transparent",

            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",

            // critical: disable browser pinch zoom inside viewer
            touchAction: "pan-x pan-y",

            cursor: isDragging ? "grabbing" : "grab",
          }}
        >
          {/* IMPORTANT:
              This spacer gives real scroll area in BOTH directions.
              zoomLayer is NOT centered by flex anymore.
          */}
          <div
            style={{
              position: "relative",
              padding: readingMode ? "0px" : "20px 24px",
            }}
          >
            <div
              ref={zoomLayerRef}
              style={{
                position: "relative",
              }}
            />
          </div>
        </div>

        {/* BOTTOM BAR */}
        {!readingMode && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 16,
              display: "flex",
              justifyContent: "center",
              zIndex: 70,
              pointerEvents: "none",
              opacity: uiVisible ? 1 : 0,
              transform: uiVisible ? "translateY(0px)" : "translateY(10px)",
              transition: "opacity 200ms ease, transform 200ms ease",
            }}
          >
            <div
              style={{
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: 18,
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
                padding: "10px 16px",
                borderRadius: 999,
              }}
            >
              <button
                onClick={nextPage}
                title="Next page"
                style={bottomBtn}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
              >
                ← <span style={{ fontFamily: urduFont }}>اگلا</span>
              </button>

              <div
                style={{
                  fontSize: 13,
                  opacity: 0.85,
                  minWidth: 130,
                  textAlign: "center",
                }}
              >
                <span style={{ fontFamily: urduFont }}>صفحہ</span>{" "}
                <span style={{ fontWeight: 700 }}>{activePage}</span>{" "}
                <span style={{ opacity: 0.7 }}>of {numPages || "-"}</span>
              </div>

              <button
                onClick={prevPage}
                title="Previous page"
                style={bottomBtn}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
              >
                <span style={{ fontFamily: urduFont }}>پچھلا</span> →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- HELPERS + STYLES ---------------- */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function closestPreset(value: number, presets: number[]) {
  let best = presets[0];
  let bestDist = Math.abs(value - presets[0]);

  for (const p of presets) {
    const d = Math.abs(value - p);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

const miniBtn: React.CSSProperties = {
  height: 34,
  minWidth: 34,
  padding: "0 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.35)",
  color: "#fff",
  fontSize: 13,
  cursor: "pointer",
  backdropFilter: "blur(10px)",
};

const miniSelect: React.CSSProperties = {
  height: 34,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.35)",
  color: "#fff",
  padding: "0 12px",
  cursor: "pointer",
  backdropFilter: "blur(10px)",
  outline: "none",
};

const bottomBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#fff",
  cursor: "pointer",
  fontSize: 13,
  opacity: 0.7,
  transition: "opacity 0.2s ease",
  padding: "6px 10px",
};
